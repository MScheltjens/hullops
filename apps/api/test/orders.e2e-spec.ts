import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { PrismaService } from './../src/prisma/prisma.service';

/**
 * Runs the real app against the test database (see test-database.ts).
 * The suite creates its own users and vessel and deletes everything it
 * created afterwards.
 */
describe('Orders GraphQL API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  // Unique per run, so leftovers from an aborted run can't collide.
  const run = Date.now().toString(36);
  const ids = {
    lead: `e2e-${run}-lead`,
    cleaner: `e2e-${run}-cleaner`,
    protector: `e2e-${run}-protector`,
    vessel: `e2e-${run}-vessel`,
  };

  const gql = (query: string, variables?: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/graphql')
      .send({ query, variables })
      .expect(200);

  const ORDER_FIELDS = `
    id title status serviceType overdue dueDate
    vessel { id }
    createdBy { id }
    team { id }
    history { status note author { id } }
    cleaningDetails { method surface }
    protectionDetails { kind materials coatingProduct layers }
  `;

  const createOrder = (input: Record<string, unknown>) =>
    gql(
      `mutation ($input: CreateOrderInput!) { createOrder(input: $input) { ${ORDER_FIELDS} } }`,
      { input },
    );

  const addStatusUpdate = (input: Record<string, unknown>) =>
    gql(
      `mutation ($input: AddStatusUpdateInput!) { addStatusUpdate(input: $input) { ${ORDER_FIELDS} } }`,
      { input },
    );

  const daysFromNow = (days: number) =>
    new Date(Date.now() + days * 86_400_000).toISOString();

  const cleaningOrder = (overrides: Record<string, unknown> = {}) => ({
    title: 'E2E hull cleaning',
    serviceType: 'CLEANING',
    shipyard: 'Blohm+Voss',
    startDate: daysFromNow(-1),
    dueDate: daysFromNow(3),
    vesselId: ids.vessel,
    createdById: ids.lead,
    cleaning: { method: 'High-pressure water', surface: 'Hull' },
    teamIds: [ids.cleaner],
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

    const user = (id: string, role: string, serviceTypes: string[]) =>
      prisma.user.create({
        data: {
          id,
          email: `${id}@hullops.example`,
          name: id,
          passwordHash: 'not-used-in-these-tests',
          role: role as 'PROJECT_LEAD' | 'WORKER',
          serviceTypes: serviceTypes as ('CLEANING' | 'PROTECTION')[],
        },
      });
    await user(ids.lead, 'PROJECT_LEAD', ['CLEANING', 'PROTECTION']);
    await user(ids.cleaner, 'WORKER', ['CLEANING']);
    await user(ids.protector, 'WORKER', ['PROTECTION']);
    await prisma.vessel.create({
      data: { id: ids.vessel, name: 'E2E Vessel' },
    });
  });

  afterAll(async () => {
    // Orders first: they reference the vessel and users. Deleting an order
    // cascades to its details, team and history.
    await prisma.order.deleteMany({ where: { vesselId: ids.vessel } });
    await prisma.vessel.deleteMany({ where: { id: ids.vessel } });
    await prisma.user.deleteMany({
      where: { id: { in: [ids.lead, ids.cleaner, ids.protector] } },
    });
    await app.close();
  });

  it('creates a cleaning order with its team and first history entry', async () => {
    const response = await createOrder(cleaningOrder());
    const order = response.body.data.createOrder;

    expect(order).toMatchObject({
      status: 'PLANNED',
      serviceType: 'CLEANING',
      overdue: false,
      vessel: { id: ids.vessel },
      createdBy: { id: ids.lead },
      team: [{ id: ids.cleaner }],
      history: [{ status: 'PLANNED', note: null, author: { id: ids.lead } }],
      cleaningDetails: { method: 'High-pressure water', surface: 'Hull' },
      protectionDetails: null,
    });
  });

  it('creates a coating order with its coating fields', async () => {
    const response = await createOrder({
      title: 'E2E antifouling',
      serviceType: 'PROTECTION',
      shipyard: 'Lürssen',
      startDate: daysFromNow(0),
      dueDate: daysFromNow(5),
      vesselId: ids.vessel,
      createdById: ids.lead,
      protection: {
        kind: 'COATING',
        coatingProduct: 'Antifouling',
        layers: 2,
      },
      teamIds: [ids.protector],
    });

    expect(response.body.data.createOrder.protectionDetails).toEqual({
      kind: 'COATING',
      materials: [],
      coatingProduct: 'Antifouling',
      layers: 2,
    });
  });

  it('reports cross-field and nested validation errors together', async () => {
    const response = await createOrder(
      cleaningOrder({
        startDate: daysFromNow(5),
        dueDate: daysFromNow(1),
        cleaning: { method: '', surface: 'Hull' },
      }),
    );
    const [error] = response.body.errors;

    // The nested rule (empty method) is caught by the ValidationPipe first;
    // the cross-field rules run in the service afterwards.
    expect(error.extensions.code).toBe('BAD_REQUEST');
    expect(error.extensions.validationErrors).toEqual([
      'cleaning.method should not be empty',
    ]);

    const crossField = await createOrder(
      cleaningOrder({ startDate: daysFromNow(5), dueDate: daysFromNow(1) }),
    );
    expect(crossField.body.errors[0].extensions.validationErrors).toEqual([
      'startDate must not be after dueDate',
    ]);
  });

  it('refuses a worker from another service area on the team', async () => {
    const response = await createOrder(
      cleaningOrder({ teamIds: [ids.protector] }),
    );
    const [error] = response.body.errors;
    expect(error.extensions.code).toBe('BAD_REQUEST');
    expect(error.extensions.validationErrors).toEqual([
      `${ids.protector} does not work in cleaning`,
    ]);
  });

  it('only lets project leads create orders', async () => {
    const response = await createOrder(
      cleaningOrder({ createdById: ids.cleaner }),
    );
    expect(response.body.errors[0].extensions.code).toBe('FORBIDDEN');
  });

  it('walks an order through PLANNED → IN_PROGRESS → DONE', async () => {
    const created = await createOrder(cleaningOrder());
    const orderId = created.body.data.createOrder.id;

    const skip = await addStatusUpdate({
      orderId,
      status: 'DONE',
      authorId: ids.cleaner,
    });
    expect(skip.body.errors[0].message).toBe(
      'Cannot change status from PLANNED to DONE',
    );

    await addStatusUpdate({
      orderId,
      status: 'IN_PROGRESS',
      authorId: ids.cleaner,
    });
    await addStatusUpdate({
      orderId,
      status: 'IN_PROGRESS',
      note: 'Port side done',
      authorId: ids.cleaner,
    });
    const done = await addStatusUpdate({
      orderId,
      status: 'DONE',
      note: 'Finished',
      authorId: ids.cleaner,
    });

    const order = done.body.data.addStatusUpdate;
    expect(order.status).toBe('DONE');
    expect(order.history.map((h: { status: string }) => h.status)).toEqual([
      'PLANNED',
      'IN_PROGRESS',
      'IN_PROGRESS',
      'DONE',
    ]);
  });

  it('computes overdue and filters on it', async () => {
    const late = await createOrder(
      cleaningOrder({
        title: 'E2E late order',
        startDate: daysFromNow(-5),
        dueDate: daysFromNow(-1),
      }),
    );
    const lateId = late.body.data.createOrder.id;
    expect(late.body.data.createOrder.overdue).toBe(true);

    const overdue = await gql(
      'query ($vesselId: ID) { orders(vesselId: $vesselId, overdue: true) { id overdue } }',
      { vesselId: ids.vessel },
    );
    expect(overdue.body.data.orders).toEqual([{ id: lateId, overdue: true }]);
  });

  it('adds and removes team members', async () => {
    const created = await createOrder(cleaningOrder({ teamIds: [] }));
    const orderId = created.body.data.createOrder.id;
    const teamMutation = (name: string) =>
      gql(
        `mutation ($orderId: ID!, $userId: ID!) { ${name}(orderId: $orderId, userId: $userId) { team { id } } }`,
        { orderId, userId: ids.cleaner },
      );

    const added = await teamMutation('assignTeamMember');
    expect(added.body.data.assignTeamMember.team).toEqual([
      { id: ids.cleaner },
    ]);
    // Assigning twice changes nothing.
    const again = await teamMutation('assignTeamMember');
    expect(again.body.data.assignTeamMember.team).toHaveLength(1);

    const removed = await teamMutation('removeTeamMember');
    expect(removed.body.data.removeTeamMember.team).toEqual([]);
  });

  it('lists users by service area', async () => {
    const response = await gql('{ users(serviceType: PROTECTION) { id } }');
    const userIds = response.body.data.users.map((u: { id: string }) => u.id);
    expect(userIds).toEqual(expect.arrayContaining([ids.lead, ids.protector]));
    expect(userIds).not.toContain(ids.cleaner);
  });
});
