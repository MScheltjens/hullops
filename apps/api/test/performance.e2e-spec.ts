import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { PrismaService } from './../src/prisma/prisma.service';
import { createUserAndLogin, graphql } from './auth-helpers';
import { countQueries } from './query-counter';

/**
 * The yard works on phones with poor reception, so the app must stay fast.
 * The most common way an API gets slow is a query that runs once per row
 * (the "N+1 problem"). These tests send the queries the web pages send,
 * count the SQL statements, and require two things:
 *
 *  1. the count does not grow with the amount of data, and
 *  2. it stays within a small budget.
 *
 * If a change adds a query per order or per user, a test here fails.
 */
describe('Performance: database queries per request (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let asLead: ReturnType<typeof graphql>;

  const run = Date.now().toString(36);
  const id = (name: string) => `e2e-${run}-${name}`;
  const WORKERS = ['w1', 'w2', 'w3', 'w4'].map(id);

  // These are the queries the web pages send (apps/web/src/app/(app)/...).
  // Keep them in sync when a page asks for more.
  const ORDER_FIELDS = `
    id title status serviceType overdue dueDate shipyard berth commentCount
    vessel { name } team { id name }`;
  const OPERATIONS: Record<string, { query: string; budget: number }> = {
    'orders list (web: /orders)': {
      query: `{ orders(take: 100) { ${ORDER_FIELDS} } }`,
      budget: 6,
    },
    'order detail (web: /orders/[id])': {
      query: `{ order(id: "${id('order-0')}") { ${ORDER_FIELDS} description areaSqm
        startDate vessel { name imoNumber } createdBy { name }
        cleaningDetails { method surface }
        protectionDetails { kind materials }
        history { status note createdAt author { name } }
        comments { id text source createdAt author { name } } } }`,
      budget: 14,
    },
    'vessels (web: new order, vessels)': {
      query: '{ vessels { id name imoNumber } }',
      budget: 3,
    },
    'workers (web: new order, planning)': {
      query: '{ users(role: WORKER) { id name serviceTypes } }',
      budget: 3,
    },
    'logged-in user (web: every page)': {
      query: '{ me { id name role locale } }',
      budget: 2,
    },
  };

  /** Adds `count` more orders, each with a team, history and a comment. */
  const addOrders = async (from: number, count: number) => {
    for (let i = from; i < from + count; i++) {
      await prisma.order.create({
        data: {
          id: id(`order-${i}`),
          title: `E2E order ${i}`,
          serviceType: 'CLEANING',
          shipyard: 'Yard',
          startDate: new Date(Date.now() - 86_400_000),
          dueDate: new Date(Date.now() + 86_400_000),
          vessel: { connect: { id: id(`vessel-${i % 3}`) } },
          createdBy: { connect: { id: id('lead') } },
          cleaningDetails: { create: { method: 'MANUAL', surface: 'HULL' } },
          assignments: {
            create: WORKERS.slice(0, 3).map((userId) => ({
              user: { connect: { id: userId } },
            })),
          },
          statusUpdates: {
            create: [
              { status: 'PLANNED', author: { connect: { id: id('lead') } } },
            ],
          },
          comments: {
            create: [{ text: 'Note', author: { connect: { id: id('lead') } } }],
          },
        },
      });
    }
  };

  const measure = async () => {
    const counts: Record<string, number> = {};
    for (const [name, { query }] of Object.entries(OPERATIONS)) {
      const { result, queries } = await countQueries(() => asLead(query));
      expect(result.body.errors).toBeUndefined();
      counts[name] = queries.length;
    }
    return counts;
  };

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
        id: id('lead'),
        role: 'PROJECT_LEAD',
        serviceTypes: ['CLEANING', 'PROTECTION'],
      }),
    );
    for (const worker of WORKERS) {
      await createUserAndLogin(app, {
        id: worker,
        role: 'WORKER',
        serviceTypes: ['CLEANING'],
      });
    }
    for (let i = 0; i < 3; i++) {
      await prisma.vessel.create({
        data: { id: id(`vessel-${i}`), name: `E2E vessel ${i}` },
      });
    }
  });

  afterAll(async () => {
    await prisma.order.deleteMany({
      where: { id: { startsWith: `e2e-${run}-order-` } },
    });
    await prisma.vessel.deleteMany({
      where: { id: { startsWith: `e2e-${run}-vessel-` } },
    });
    await prisma.user.deleteMany({
      where: { id: { startsWith: `e2e-${run}-` } },
    });
    await app.close();
  });

  it('does not run more queries when there is more data, and stays in budget', async () => {
    await addOrders(0, 2);
    const small = await measure();

    await addOrders(2, 20); // eleven times as many orders
    const large = await measure();

    // Printed so a failing or surprising number is easy to see.
    console.table(
      Object.keys(OPERATIONS).map((name) => ({
        operation: name,
        '2 orders': small[name],
        '22 orders': large[name],
        budget: OPERATIONS[name].budget,
      })),
    );

    for (const [name, { budget }] of Object.entries(OPERATIONS)) {
      expect({ name, queries: large[name] }).toEqual({
        name,
        queries: small[name],
      });
      expect(large[name]).toBeLessThanOrEqual(budget);
    }
  });

  it('keeps history and comments out of the order overview', async () => {
    // The overview shows a comment count, not the comments. If it starts
    // reading the history or the comment rows, every note anyone writes makes
    // the overview heavier.
    await addOrders(100, 3);
    const { queries } = await countQueries(() =>
      asLead(OPERATIONS['orders list (web: /orders)'].query),
    );

    expect(queries.filter((q) => q.includes('"StatusUpdate"'))).toEqual([]);
    const commentQueries = queries.filter((q) => q.includes('"OrderComment"'));
    for (const query of commentQueries) {
      expect(query.toUpperCase()).toContain('COUNT');
    }
  });
});
