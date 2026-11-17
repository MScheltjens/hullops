import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import type { Role } from './../src/generated/prisma/client';
import { PrismaService } from './../src/prisma/prisma.service';
import { addWeeks, formatDateOnly, weekStartOf } from './../src/staffing/week';
import { createUserAndLogin, graphql, runId } from './auth-helpers';

/**
 * Who sees which vessel, through the real API: the rule in vessel-scope.ts,
 * the weekly crew plan that feeds it, and the team lead handing out tasks to
 * his planned workers. Two vessels, each with its own team lead and order.
 */
describe('Vessel visibility and the crew plan (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const run = runId();
  const ids = {
    lead: `e2e-${run}-lead`,
    hr: `e2e-${run}-hr`,
    leadA: `e2e-${run}-tl-a`,
    leadB: `e2e-${run}-tl-b`,
    onA: `e2e-${run}-w-on-a`, // planned on A this week
    onBNext: `e2e-${run}-w-on-b-next`, // planned on B next week only
    unplanned: `e2e-${run}-w-unplanned`,
    vesselA: `e2e-${run}-vessel-a`,
    vesselB: `e2e-${run}-vessel-b`,
    orderA: `e2e-${run}-order-a`,
    orderB: `e2e-${run}-order-b`,
  };
  const userIds = [
    ids.lead,
    ids.hr,
    ids.leadA,
    ids.leadB,
    ids.onA,
    ids.onBNext,
    ids.unplanned,
  ];
  const vesselIds = [ids.vesselA, ids.vesselB];

  const thisWeek = weekStartOf(new Date());
  const THIS_WEEK = formatDateOnly(thisWeek);
  const NEXT_WEEK = formatDateOnly(addWeeks(thisWeek, 1));

  type Gql = ReturnType<typeof graphql>;
  const as: Record<string, Gql> = {};

  /** The vessel and order ids a user gets from the list queries. */
  const visibleTo = async (gql: Gql) => {
    const response = await gql('{ vessels { id } orders { id } }');
    expect(response.body.errors).toBeUndefined();
    const idsOf = (rows: { id: string }[]) =>
      rows
        .map((row) => row.id)
        .filter((id) => id.includes(run))
        .sort();
    return {
      vessels: idsOf(response.body.data.vessels),
      orders: idsOf(response.body.data.orders),
    };
  };

  const plan = (userId: string, vesselId: string, weekStart = THIS_WEEK) =>
    as.lead(
      `mutation ($input: PlanCrewMemberInput!) { planCrewMember(input: $input) { weekStart user { id } vessel { id } } }`,
      { input: { userId, vesselId, weekStart } },
    );

  const assign = (gql: Gql, orderId: string, userId: string) =>
    gql(
      `mutation ($orderId: ID!, $userId: ID!) { assignTeamMember(orderId: $orderId, userId: $userId) { team { id } } }`,
      { orderId, userId },
    );

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const make = async (key: keyof typeof ids, role: Role) => {
      as[key] = graphql(
        app,
        await createUserAndLogin(app, {
          id: ids[key],
          role,
          serviceTypes: ['CLEANING'],
        }),
      );
    };
    await make('lead', 'PROJECT_LEAD');
    await make('hr', 'HR');
    await make('leadA', 'TEAM_LEAD');
    await make('leadB', 'TEAM_LEAD');
    await make('onA', 'WORKER');
    await make('onBNext', 'WORKER');
    await make('unplanned', 'WORKER');

    for (const [vesselId, teamLeadId, orderId] of [
      [ids.vesselA, ids.leadA, ids.orderA],
      [ids.vesselB, ids.leadB, ids.orderB],
    ]) {
      await prisma.vessel.create({
        data: { id: vesselId, name: `e2e ${vesselId}`, teamLeadId },
      });
      await prisma.order.create({
        data: {
          id: orderId,
          title: `e2e ${orderId}`,
          serviceType: 'CLEANING',
          status: 'PLANNED',
          shipyard: 'E2E yard',
          startDate: new Date(),
          dueDate: new Date(Date.now() + 7 * 86_400_000),
          vesselId,
          createdById: ids.lead,
        },
      });
    }
    await prisma.crewAssignment.createMany({
      data: [
        { userId: ids.onA, vesselId: ids.vesselA, weekStart: thisWeek },
        {
          userId: ids.onBNext,
          vesselId: ids.vesselB,
          weekStart: addWeeks(thisWeek, 1),
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { vesselId: { in: vesselIds } } });
    await prisma.crewAssignment.deleteMany({
      where: { vesselId: { in: vesselIds } },
    });
    await prisma.vessel.deleteMany({ where: { id: { in: vesselIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  describe('reading', () => {
    it('shows a project lead every vessel and order', async () => {
      expect(await visibleTo(as.lead)).toEqual({
        vessels: [ids.vesselA, ids.vesselB],
        orders: [ids.orderA, ids.orderB],
      });
    });

    it('shows a team lead only his own vessel', async () => {
      expect(await visibleTo(as.leadA)).toEqual({
        vessels: [ids.vesselA],
        orders: [ids.orderA],
      });
    });

    it('shows a worker the vessel he is planned on this week', async () => {
      expect(await visibleTo(as.onA)).toEqual({
        vessels: [ids.vesselA],
        orders: [ids.orderA],
      });
    });

    it('shows a worker next week’s vessel once it is planned', async () => {
      expect(await visibleTo(as.onBNext)).toEqual({
        vessels: [ids.vesselB],
        orders: [ids.orderB],
      });
    });

    it('shows an unplanned worker nothing', async () => {
      expect(await visibleTo(as.unplanned)).toEqual({
        vessels: [],
        orders: [],
      });
    });

    it('answers null for a single vessel or order out of sight', async () => {
      const response = await as.leadA(
        'query ($v: ID!, $o: ID!) { vessel(id: $v) { id } order(id: $o) { id } }',
        { v: ids.vesselB, o: ids.orderB },
      );
      expect(response.body.errors).toBeUndefined();
      expect(response.body.data).toEqual({ vessel: null, order: null });
    });

    it('keeps HR out of the work', async () => {
      const response = await as.hr('{ vessels { id } }');
      expect(response.body.errors[0].extensions.code).toBe('FORBIDDEN');
    });
  });

  describe('the crew plan', () => {
    it('lets a project lead plan a worker, which shows him the vessel', async () => {
      const planned = await plan(ids.unplanned, ids.vesselA);
      expect(planned.body.data.planCrewMember).toEqual({
        weekStart: THIS_WEEK,
        user: { id: ids.unplanned },
        vessel: { id: ids.vesselA },
      });
      expect((await visibleTo(as.unplanned)).vessels).toEqual([ids.vesselA]);
    });

    it('moves a worker who is planned again in the same week', async () => {
      await plan(ids.unplanned, ids.vesselB);
      expect((await visibleTo(as.unplanned)).vessels).toEqual([ids.vesselB]);
      const rows = await prisma.crewAssignment.count({
        where: { userId: ids.unplanned },
      });
      expect(rows).toBe(1);
    });

    it('takes a worker off the plan', async () => {
      const unplan = () =>
        as.lead(
          'mutation ($week: String!, $user: ID!) { unplanCrewMember(weekStart: $week, userId: $user) }',
          { week: THIS_WEEK, user: ids.unplanned },
        );
      expect((await unplan()).body.data.unplanCrewMember).toBe(true);
      expect((await unplan()).body.data.unplanCrewMember).toBe(false);
      expect((await visibleTo(as.unplanned)).vessels).toEqual([]);
    });

    it('plans only active workers', async () => {
      const response = await plan(ids.leadA, ids.vesselA);
      expect(response.body.errors[0].extensions.code).toBe('BAD_REQUEST');
    });

    it('is planned by project leads only', async () => {
      const response = await as.leadA(
        `mutation ($input: PlanCrewMemberInput!) { planCrewMember(input: $input) { weekStart } }`,
        {
          input: {
            userId: ids.unplanned,
            vesselId: ids.vesselA,
            weekStart: NEXT_WEEK,
          },
        },
      );
      expect(response.body.errors[0].extensions.code).toBe('FORBIDDEN');
    });

    it("shows a team lead his own vessel's crew only", async () => {
      const response = await as.leadB(
        'query ($week: String!) { crewPlan(weekStart: $week) { user { id } vessel { id } } }',
        { week: NEXT_WEEK },
      );
      const mine = response.body.data.crewPlan.filter(
        (row: { vessel: { id: string } }) => vesselIds.includes(row.vessel.id),
      );
      expect(mine).toEqual([
        { user: { id: ids.onBNext }, vessel: { id: ids.vesselB } },
      ]);
    });
  });

  describe('a team lead handing out tasks', () => {
    it('can add a worker planned on his vessel', async () => {
      const response = await assign(as.leadA, ids.orderA, ids.onA);
      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.assignTeamMember.team).toEqual([
        { id: ids.onA },
      ]);
    });

    it('cannot add a worker planned elsewhere', async () => {
      const response = await assign(as.leadA, ids.orderA, ids.onBNext);
      expect(response.body.errors[0].extensions.code).toBe('BAD_REQUEST');
    });

    it("cannot touch another team lead's order", async () => {
      const response = await assign(as.leadA, ids.orderB, ids.onBNext);
      expect(response.body.errors[0].extensions.code).toBe('FORBIDDEN');
    });
  });
});
