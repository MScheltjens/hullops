import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { PrismaService } from './../src/prisma/prisma.service';
import { createUserAndLogin, graphql } from './auth-helpers';

/**
 * Runs the real app against the test database (see test-database.ts).
 * The suite creates its own users (logged in through the real login) and
 * vessel, and deletes everything it created afterwards.
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

  // One GraphQL client per user, each sending that user's token.
  type Gql = ReturnType<typeof graphql>;
  let asLead: Gql;
  let asCleaner: Gql;
  let asProtector: Gql;

  const ORDER_FIELDS = `
    id title status serviceType overdue dueDate
    vessel { id }
    createdBy { id }
    team { id }
    history { status note author { id } }
    comments { text source author { id } }
    cleaningDetails { method surface }
    protectionDetails { kind materials coatingProduct layers }
  `;

  const createOrder = (input: Record<string, unknown>, as = asLead) =>
    as(
      `mutation ($input: CreateOrderInput!) { createOrder(input: $input) { ${ORDER_FIELDS} } }`,
      { input },
    );

  const addStatusUpdate = (input: Record<string, unknown>, as = asCleaner) =>
    as(
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

    asLead = graphql(
      app,
      await createUserAndLogin(app, {
        id: ids.lead,
        role: 'PROJECT_LEAD',
        serviceTypes: ['CLEANING', 'PROTECTION'],
      }),
    );
    asCleaner = graphql(
      app,
      await createUserAndLogin(app, {
        id: ids.cleaner,
        role: 'WORKER',
        serviceTypes: ['CLEANING'],
      }),
    );
    asProtector = graphql(
      app,
      await createUserAndLogin(app, {
        id: ids.protector,
        role: 'WORKER',
        serviceTypes: ['PROTECTION'],
      }),
    );
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
    const response = await createOrder(cleaningOrder(), asCleaner);
    expect(response.body.errors[0].extensions.code).toBe('FORBIDDEN');
  });

  it('only lets the team and project leads update an order', async () => {
    const created = await createOrder(cleaningOrder());
    const orderId = created.body.data.createOrder.id;

    // The protector isn't on this cleaning order's team.
    const outsider = await addStatusUpdate(
      { orderId, status: 'IN_PROGRESS' },
      asProtector,
    );
    expect(outsider.body.errors[0].extensions.code).toBe('FORBIDDEN');

    const byLead = await addStatusUpdate(
      { orderId, status: 'IN_PROGRESS', note: 'Started by the lead' },
      asLead,
    );
    expect(byLead.body.data.addStatusUpdate.history.at(-1).author).toEqual({
      id: ids.lead,
    });
  });

  it('walks an order through PLANNED → IN_PROGRESS → DONE', async () => {
    const created = await createOrder(cleaningOrder());
    const orderId = created.body.data.createOrder.id;

    const skip = await addStatusUpdate({
      orderId,
      status: 'DONE',
    });
    expect(skip.body.errors[0].message).toBe(
      'Cannot change status from PLANNED to DONE',
    );

    await addStatusUpdate({
      orderId,
      status: 'IN_PROGRESS',
    });
    await addStatusUpdate({
      orderId,
      status: 'IN_PROGRESS',
      note: 'Port side done',
    });
    const done = await addStatusUpdate({
      orderId,
      status: 'DONE',
      note: 'Finished',
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

    const overdue = await asCleaner(
      'query ($vesselId: ID) { orders(vesselId: $vesselId, overdue: true) { id overdue } }',
      { vesselId: ids.vessel },
    );
    expect(overdue.body.data.orders).toEqual([{ id: lateId, overdue: true }]);
  });

  it('lets project leads add comments that the team can read', async () => {
    const created = await createOrder(cleaningOrder());
    const orderId = created.body.data.createOrder.id;
    const addComment = (input: Record<string, unknown>, as = asLead) =>
      as(
        `mutation ($input: AddOrderCommentInput!) { addOrderComment(input: $input) { comments { text source author { id } } } }`,
        { input },
      );

    await addComment({ orderId, text: 'Crane booked until 10:00' });
    const second = await addComment({
      orderId,
      text: 'Access via gate 3',
      source: 'Lürssen, by mail',
    });
    // Oldest first.
    expect(second.body.data.addOrderComment.comments).toEqual([
      {
        text: 'Crane booked until 10:00',
        source: null,
        author: { id: ids.lead },
      },
      {
        text: 'Access via gate 3',
        source: 'Lürssen, by mail',
        author: { id: ids.lead },
      },
    ]);

    // A worker on the team can read them…
    const read = await asCleaner(
      'query ($id: ID!) { order(id: $id) { commentCount comments { text } } }',
      { id: orderId },
    );
    expect(read.body.data.order.comments).toHaveLength(2);
    expect(read.body.data.order.commentCount).toBe(2);

    // …but not write them, and blank or unknown input is rejected.
    const byWorker = await addComment({ orderId, text: 'Hi' }, asCleaner);
    expect(byWorker.body.errors[0].extensions.code).toBe('FORBIDDEN');
    const blank = await addComment({ orderId, text: '   ' });
    expect(blank.body.errors[0].extensions.code).toBe('BAD_REQUEST');
    const unknown = await addComment({ orderId: 'nope', text: 'Hi' });
    expect(unknown.body.errors[0].extensions.code).toBe('NOT_FOUND');
  });

  it('adds and removes team members', async () => {
    const created = await createOrder(cleaningOrder({ teamIds: [] }));
    const orderId = created.body.data.createOrder.id;
    const teamMutation = (name: string, as = asLead) =>
      as(
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

    // Workers can't change teams.
    const byWorker = await teamMutation('assignTeamMember', asCleaner);
    expect(byWorker.body.errors[0].extensions.code).toBe('FORBIDDEN');
  });

  it('lists users by service area', async () => {
    const response = await asCleaner(
      '{ users(serviceType: PROTECTION) { id } }',
    );
    const userIds = response.body.data.users.map((u: { id: string }) => u.id);
    expect(userIds).toEqual(expect.arrayContaining([ids.lead, ids.protector]));
    expect(userIds).not.toContain(ids.cleaner);
  });
});
