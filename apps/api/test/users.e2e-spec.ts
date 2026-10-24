import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { PrismaService } from './../src/prisma/prisma.service';
import { createUserAndLogin, graphql, TEST_PASSWORD } from './auth-helpers';

/**
 * Runs the real app against the test database. The suite creates its own
 * users and deletes everything it created afterwards.
 */
describe('User management (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  // Unique per run, so leftovers from an aborted run can't collide.
  const run = Date.now().toString(36);
  const ids = {
    admin: `e2e-${run}-admin`,
    lead: `e2e-${run}-lead`,
    worker: `e2e-${run}-worker`,
  };
  const newEmail = `e2e-${run}-new@hullops.example`;
  const newPassword = 'a-brand-new-password-1';

  type Gql = ReturnType<typeof graphql>;
  let asAdmin: Gql;
  let asLead: Gql;
  let asWorker: Gql;

  const USER_FIELDS = 'id name email role serviceTypes locale active';
  const createUser = (input: Record<string, unknown>, as = asAdmin) =>
    as(
      `mutation ($input: CreateUserInput!) { createUser(input: $input) { ${USER_FIELDS} } }`,
      { input },
    );
  const login = (email: string, password: string) =>
    graphql(app)(
      'mutation ($input: LoginInput!) { login(input: $input) { accessToken } }',
      { input: { email, password } },
    );
  const newUser = (overrides: Record<string, unknown> = {}) => ({
    name: 'New Person',
    email: newEmail,
    password: newPassword,
    role: 'WORKER',
    serviceTypes: ['CLEANING'],
    ...overrides,
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const make = async (
      id: string,
      role: 'ADMIN' | 'PROJECT_LEAD' | 'WORKER',
    ) =>
      graphql(
        app,
        await createUserAndLogin(app, { id, role, serviceTypes: ['CLEANING'] }),
      );
    asAdmin = await make(ids.admin, 'ADMIN');
    asLead = await make(ids.lead, 'PROJECT_LEAD');
    asWorker = await make(ids.worker, 'WORKER');
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        OR: [
          { id: { in: Object.values(ids) } },
          { email: { startsWith: `e2e-${run}-` } },
        ],
      },
    });
    await app.close();
  });

  it('lets an administrator create a user who can then log in', async () => {
    const created = await createUser(newUser());
    expect(created.body.data.createUser).toMatchObject({
      name: 'New Person',
      email: newEmail,
      role: 'WORKER',
      serviceTypes: ['CLEANING'],
      active: true,
    });

    const response = await login(newEmail, newPassword);
    expect(response.body.data.login.accessToken).toEqual(expect.any(String));
  });

  it('keeps user management to administrators', async () => {
    for (const as of [asLead, asWorker]) {
      const response = await createUser(
        newUser({ email: `x-${run}@h.example` }),
        as,
      );
      expect(response.body.errors[0].extensions.code).toBe('FORBIDDEN');
    }
    // The same for the other three mutations.
    const rest = await asLead(
      `mutation { setUserActive(userId: "${ids.worker}", active: false) { id } }`,
    );
    expect(rest.body.errors[0].extensions.code).toBe('FORBIDDEN');
    // And no peeking at deactivated users.
    const list = await asLead('{ users(includeInactive: true) { id } }');
    expect(list.body.errors[0].extensions.code).toBe('FORBIDDEN');
  });

  it('rejects a duplicate email and a short password', async () => {
    const duplicate = await createUser(
      newUser({ email: newEmail.toUpperCase() }),
    );
    expect(duplicate.body.errors[0].extensions.code).toBe('CONFLICT');

    const short = await createUser(
      newUser({ email: `s-${run}@h.example`, password: 'short' }),
    );
    expect(short.body.errors[0].extensions.code).toBe('BAD_REQUEST');
  });

  it('changes role and service areas, but not your own role', async () => {
    const target = await prisma.user.findUniqueOrThrow({
      where: { email: newEmail },
    });

    const updated = await asAdmin(
      `mutation ($input: UpdateUserInput!) { updateUser(input: $input) { role serviceTypes } }`,
      {
        input: {
          userId: target.id,
          role: 'PROJECT_LEAD',
          serviceTypes: ['CLEANING', 'PROTECTION'],
        },
      },
    );
    expect(updated.body.data.updateUser).toEqual({
      role: 'PROJECT_LEAD',
      serviceTypes: ['CLEANING', 'PROTECTION'],
    });

    const self = await asAdmin(
      `mutation ($input: UpdateUserInput!) { updateUser(input: $input) { role } }`,
      { input: { userId: ids.admin, role: 'WORKER' } },
    );
    expect(self.body.errors[0].extensions.validationErrors).toEqual([
      'You cannot change your own role',
    ]);
  });

  it('resets a password: the old one stops working, the new one works', async () => {
    const target = await prisma.user.findUniqueOrThrow({
      where: { email: newEmail },
    });
    const reset = await asAdmin(
      `mutation ($input: ResetPasswordInput!) { resetUserPassword(input: $input) { id } }`,
      { input: { userId: target.id, password: 'another-password-123' } },
    );
    expect(reset.body.errors).toBeUndefined();

    expect(
      (await login(newEmail, newPassword)).body.errors[0].extensions.code,
    ).toBe('UNAUTHENTICATED');
    expect(
      (await login(newEmail, 'another-password-123')).body.data.login
        .accessToken,
    ).toEqual(expect.any(String));
  });

  it('deactivates a user: their token stops working at once, and they leave the lists', async () => {
    // A token issued while the user was still active.
    const target = await prisma.user.findUniqueOrThrow({
      where: { email: newEmail },
    });
    const token = (await login(newEmail, 'another-password-123')).body.data
      .login.accessToken;
    const asTarget = graphql(app, token);
    expect((await asTarget('{ me { id } }')).body.data.me.id).toBe(target.id);

    const off = await asAdmin(
      `mutation { setUserActive(userId: "${target.id}", active: false) { active } }`,
    );
    expect(off.body.data.setUserActive.active).toBe(false);

    // The old token no longer works, and neither does logging in again.
    expect(
      (await asTarget('{ me { id } }')).body.errors[0].extensions.code,
    ).toBe('UNAUTHENTICATED');
    expect(
      (await login(newEmail, 'another-password-123')).body.errors[0].extensions
        .code,
    ).toBe('UNAUTHENTICATED');

    // Left out of the normal list (e.g. the team picker); admins can still find them.
    const normal = await asLead('{ users { id } }');
    expect(
      normal.body.data.users.map((u: { id: string }) => u.id),
    ).not.toContain(target.id);
    const all = await asAdmin('{ users(includeInactive: true) { id active } }');
    expect(all.body.data.users).toContainEqual({
      id: target.id,
      active: false,
    });

    // And they can be brought back.
    await asAdmin(
      `mutation { setUserActive(userId: "${target.id}", active: true) { id } }`,
    );
    expect(
      (await login(newEmail, 'another-password-123')).body.data.login
        .accessToken,
    ).toEqual(expect.any(String));
  });

  it('refuses to let an administrator deactivate themselves', async () => {
    const response = await asAdmin(
      `mutation { setUserActive(userId: "${ids.admin}", active: false) { id } }`,
    );
    expect(response.body.errors[0].extensions.validationErrors).toEqual([
      'You cannot deactivate yourself',
    ]);
  });

  it('keeps the work to project leads and workers: an administrator cannot create orders', async () => {
    const response = await asAdmin(
      `mutation ($input: CreateOrderInput!) { createOrder(input: $input) { id } }`,
      {
        input: {
          title: 'x',
          serviceType: 'CLEANING',
          shipyard: 's',
          startDate: new Date().toISOString(),
          dueDate: new Date().toISOString(),
          vesselId: 'nope',
          cleaning: { method: 'm', surface: 's' },
          teamIds: [],
        },
      },
    );
    expect(response.body.errors[0].extensions.code).toBe('FORBIDDEN');
    // …but can read them.
    const read = await asAdmin('{ orders(take: 1) { id } vessels { id } }');
    expect(read.body.errors).toBeUndefined();
  });

  it('never exposes password hashes', async () => {
    const response = await asAdmin(
      '{ users(includeInactive: true) { passwordHash } }',
    );
    expect(response.status).toBe(400);
    expect(TEST_PASSWORD).toBeDefined();
  });
});
