import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { PrismaService } from './../src/prisma/prisma.service';
import { createUserAndLogin, graphql } from './auth-helpers';

/**
 * Runs the real app against the test database. The suite creates its own
 * users and vessels and deletes everything it created afterwards.
 */
describe('Staffing requests (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  // Unique per run, so leftovers from an aborted run can't collide.
  const run = Date.now().toString(36);
  const ids = {
    lead: `e2e-${run}-lead`,
    admin: `e2e-${run}-admin`,
    worker1: `e2e-${run}-w1`,
    worker2: `e2e-${run}-w2`,
    teamLead: `e2e-${run}-tl`,
    otherTeamLead: `e2e-${run}-tl2`,
    vesselA: `e2e-${run}-vessel-a`,
    vesselB: `e2e-${run}-vessel-b`,
  };
  const WEEK = '2026-10-26'; // a Monday

  type Gql = ReturnType<typeof graphql>;
  let asLead: Gql;
  let asAdmin: Gql;
  let asWorker: Gql;
  let asTeamLead: Gql;
  let asOtherTeamLead: Gql;

  const FIELDS = `weekStart workersNeeded workersActual note
    vessel { id } requestedWorkers { id } enteredBy { id }`;
  const save = (input: Record<string, unknown>, as = asLead) =>
    as(
      `mutation ($input: SaveStaffingRequestInput!) { saveStaffingRequest(input: $input) { ${FIELDS} } }`,
      { input },
    );
  const forWeek = (week: string, as = asLead) =>
    as(
      `query ($week: String!) { staffingRequests(weekStart: $week) { ${FIELDS} } }`,
      { week },
    );

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
      role: 'ADMIN' | 'PROJECT_LEAD' | 'WORKER' | 'TEAM_LEAD',
    ) =>
      graphql(
        app,
        await createUserAndLogin(app, { id, role, serviceTypes: ['CLEANING'] }),
      );
    asLead = await make(ids.lead, 'PROJECT_LEAD');
    asAdmin = await make(ids.admin, 'ADMIN');
    asWorker = await make(ids.worker1, 'WORKER');
    await make(ids.worker2, 'WORKER');
    asTeamLead = await make(ids.teamLead, 'TEAM_LEAD');
    asOtherTeamLead = await make(ids.otherTeamLead, 'TEAM_LEAD');
    // Vessel A has a team lead; vessel B doesn't.
    await prisma.vessel.create({
      data: {
        id: ids.vesselA,
        name: `e2e ${ids.vesselA}`,
        teamLeadId: ids.teamLead,
      },
    });
    await prisma.vessel.create({
      data: { id: ids.vesselB, name: `e2e ${ids.vesselB}` },
    });
  });

  afterAll(async () => {
    // Requests reference the vessels and users; their named workers cascade.
    await prisma.staffingRequest.deleteMany({
      where: { vesselId: { in: [ids.vesselA, ids.vesselB] } },
    });
    await prisma.vessel.deleteMany({
      where: { id: { in: [ids.vesselA, ids.vesselB] } },
    });
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [
            ids.lead,
            ids.admin,
            ids.worker1,
            ids.worker2,
            ids.teamLead,
            ids.otherTeamLead,
          ],
        },
      },
    });
    await app.close();
  });

  it('saves a request with named workers, and everyone can read it', async () => {
    const saved = await save({
      vesselId: ids.vesselA,
      weekStart: WEEK,
      workersNeeded: 6,
      requestedWorkerIds: [ids.worker1, ids.worker2],
      note: 'Same crew as last week, please',
    });
    expect(saved.body.data.saveStaffingRequest).toMatchObject({
      weekStart: WEEK,
      workersNeeded: 6,
      workersActual: null,
      vessel: { id: ids.vesselA },
      enteredBy: { id: ids.lead },
    });
    expect(
      saved.body.data.saveStaffingRequest.requestedWorkers.map(
        (w: { id: string }) => w.id,
      ),
    ).toEqual(expect.arrayContaining([ids.worker1, ids.worker2]));

    // A worker and an administrator can read it.
    for (const as of [asWorker, asAdmin]) {
      const read = await forWeek(WEEK, as);
      expect(read.body.errors).toBeUndefined();
      expect(
        read.body.data.staffingRequests.map(
          (r: { vessel: { id: string } }) => r.vessel.id,
        ),
      ).toContain(ids.vesselA);
    }
  });

  it('replaces the request when it is saved again (one per vessel and week)', async () => {
    await save({
      vesselId: ids.vesselB,
      weekStart: WEEK,
      workersNeeded: 4,
      requestedWorkerIds: [ids.worker1],
    });
    const again = await save({
      vesselId: ids.vesselB,
      weekStart: WEEK,
      workersNeeded: 3,
      workersActual: 3,
      requestedWorkerIds: [],
    });
    expect(again.body.data.saveStaffingRequest).toMatchObject({
      workersNeeded: 3,
      workersActual: 3,
      requestedWorkers: [],
    });

    const count = await prisma.staffingRequest.count({
      where: { vesselId: ids.vesselB },
    });
    expect(count).toBe(1);
  });

  it('keeps the weeks apart', async () => {
    const other = await forWeek('2026-11-02');
    const mine = other.body.data.staffingRequests.filter(
      (r: { vessel: { id: string } }) =>
        [ids.vesselA, ids.vesselB].includes(r.vessel.id),
    );
    expect(mine).toEqual([]);
  });

  it('reports every broken rule at once', async () => {
    const response = await save({
      vesselId: ids.vesselA,
      weekStart: '2026-10-27', // a Tuesday
      workersNeeded: 1,
      requestedWorkerIds: [ids.worker1, ids.worker2],
    });
    expect(response.body.errors[0].extensions.validationErrors).toEqual([
      'weekStart must be a Monday',
      '2 workers are requested by name, but only 1 are needed in total',
    ]);
  });

  it('only accepts active workers by name', async () => {
    const response = await save({
      vesselId: ids.vesselA,
      weekStart: WEEK,
      workersNeeded: 5,
      requestedWorkerIds: [ids.lead],
    });
    expect(response.body.errors[0].extensions.code).toBe('BAD_REQUEST');
    expect(response.body.errors[0].extensions.validationErrors).toEqual([
      `${ids.lead} is not an active worker`,
    ]);
  });

  it('rejects an unknown vessel', async () => {
    const response = await save({
      vesselId: 'nope',
      weekStart: WEEK,
      workersNeeded: 1,
    });
    expect(response.body.errors[0].extensions.code).toBe('NOT_FOUND');
  });

  it('lets a team lead enter requests for his own vessel only', async () => {
    const own = await save(
      {
        vesselId: ids.vesselA,
        weekStart: '2026-11-02',
        workersNeeded: 4,
        requestedWorkerIds: [ids.worker1],
      },
      asTeamLead,
    );
    expect(own.body.errors).toBeUndefined();
    expect(own.body.data.saveStaffingRequest.enteredBy).toEqual({
      id: ids.teamLead,
    });

    // Vessel B has no team lead, and vessel A is not the other team lead's.
    const notHis = await save(
      { vesselId: ids.vesselB, weekStart: '2026-11-02', workersNeeded: 1 },
      asTeamLead,
    );
    expect(notHis.body.errors[0].extensions.code).toBe('FORBIDDEN');
    const otherLead = await save(
      { vesselId: ids.vesselA, weekStart: '2026-11-02', workersNeeded: 1 },
      asOtherTeamLead,
    );
    expect(otherLead.body.errors[0].extensions.code).toBe('FORBIDDEN');
  });

  it('keeps workers and administrators from entering requests', async () => {
    for (const as of [asWorker, asAdmin]) {
      const response = await save(
        { vesselId: ids.vesselA, weekStart: WEEK, workersNeeded: 1 },
        as,
      );
      expect(response.body.errors[0].extensions.code).toBe('FORBIDDEN');
    }
  });

  it('lets a project lead choose the team lead of a vessel', async () => {
    const setLead = (userId: string | null, as = asLead) =>
      as(
        `mutation ($vesselId: ID!, $userId: ID) { setVesselTeamLead(vesselId: $vesselId, userId: $userId) { teamLead { id } } }`,
        { vesselId: ids.vesselB, userId },
      );

    const chosen = await setLead(ids.otherTeamLead);
    expect(chosen.body.data.setVesselTeamLead.teamLead).toEqual({
      id: ids.otherTeamLead,
    });
    // The new team lead can enter requests for it now.
    const now = await save(
      { vesselId: ids.vesselB, weekStart: '2026-11-09', workersNeeded: 2 },
      asOtherTeamLead,
    );
    expect(now.body.errors).toBeUndefined();

    // Only team leads can be chosen, only project leads can choose.
    const worker = await setLead(ids.worker1);
    expect(worker.body.errors[0].extensions.code).toBe('BAD_REQUEST');
    const byTeamLead = await setLead(null, asTeamLead);
    expect(byTeamLead.body.errors[0].extensions.code).toBe('FORBIDDEN');

    // And the choice can be cleared.
    const cleared = await setLead(null);
    expect(cleared.body.data.setVesselTeamLead.teamLead).toBeNull();
  });
});
