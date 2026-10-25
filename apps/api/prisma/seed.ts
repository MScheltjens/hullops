import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../src/auth/password';
import { PrismaClient } from '../src/generated/prisma/client';
import { buildSeedData, SEED_PASSWORD, weekStartFor } from './seed-data';

/**
 * Writes the demo data from seed-data.ts. Run with `pnpm exec prisma db seed`.
 *
 * Safe to run repeatedly: users are matched by email and vessels and orders
 * by their fixed `seed-…` ids, so only seeded records are replaced and any
 * data you created yourself is left alone.
 */
async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed demo data with NODE_ENV=production');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  const now = new Date();
  const { users, vessels, orders, staffingRequests } = buildSeedData(now);

  try {
    // Hash outside the transaction; scrypt is slow on purpose.
    const passwordHashes = await Promise.all(
      users.map(() => hashPassword(SEED_PASSWORD)),
    );

    await prisma.$transaction(
      async (tx) => {
        const userIds = new Map<string, string>();
        for (const [i, user] of users.entries()) {
          const data = { ...user, passwordHash: passwordHashes[i] };
          const saved = await tx.user.upsert({
            where: { email: user.email },
            create: data,
            update: data,
          });
          userIds.set(user.email, saved.id);
        }
        const userId = (email: string) => {
          const id = userIds.get(email);
          if (!id)
            throw new Error(`Seed data references unknown user ${email}`);
          return id;
        };

        for (const { teamLeadEmail, ...fields } of vessels) {
          const data = {
            ...fields,
            teamLeadId: teamLeadEmail ? userId(teamLeadEmail) : null,
          };
          await tx.vessel.upsert({
            where: { id: fields.id },
            create: data,
            update: data,
          });
        }

        // Seed data from earlier versions: remove the vessels and orders the
        // seed no longer has. Only the seed's own records (ids start with
        // "seed-") are touched, and a vessel that still has other orders or
        // requests attached is kept.
        const vesselIds = vessels.map((vessel) => vessel.id);
        await tx.order.deleteMany({
          where: {
            id: { startsWith: 'seed-', notIn: orders.map((order) => order.id) },
          },
        });
        await tx.staffingRequest.deleteMany({
          where: { vesselId: { startsWith: 'seed-', notIn: vesselIds } },
        });
        await tx.vessel.deleteMany({
          where: {
            id: { startsWith: 'seed-', notIn: vesselIds },
            orders: { none: {} },
            staffingRequests: { none: {} },
          },
        });

        // Orders have nested details, team and history, so recreating them is
        // simpler than upserting every part. Deleting an order cascades to all
        // of those.
        await tx.order.deleteMany({
          where: { id: { in: orders.map((order) => order.id) } },
        });

        for (const order of orders) {
          const { createdByEmail, teamEmails, history, ...fields } = order;
          const common = {
            id: fields.id,
            title: fields.title,
            description: fields.description,
            status: fields.status,
            serviceType: fields.serviceType,
            shipyard: fields.shipyard,
            berth: fields.berth,
            areaSqm: fields.areaSqm,
            startDate: fields.startDate,
            dueDate: fields.dueDate,
            vessel: { connect: { id: fields.vesselId } },
            createdBy: { connect: { id: userId(createdByEmail) } },
            assignments: {
              create: teamEmails.map((email) => ({
                user: { connect: { id: userId(email) } },
              })),
            },
            statusUpdates: {
              create: history.map((update) => ({
                status: update.status,
                note: update.note,
                createdAt: update.at,
                author: { connect: { id: userId(update.authorEmail) } },
              })),
            },
          };

          await tx.order.create({
            data:
              order.serviceType === 'CLEANING'
                ? { ...common, cleaningDetails: { create: order.cleaning } }
                : {
                    ...common,
                    protectionDetails: { create: order.protection },
                  },
          });
        }

        // Like the orders, the seed's own requests are replaced, so running
        // it again is safe and other requests are left alone.
        await tx.staffingRequest.deleteMany({
          where: {
            vesselId: { in: vessels.map((vessel) => vessel.id) },
            weekStart: {
              in: staffingRequests.map((r) => weekStartFor(now, r.weekOffset)),
            },
          },
        });
        for (const request of staffingRequests) {
          await tx.staffingRequest.create({
            data: {
              weekStart: weekStartFor(now, request.weekOffset),
              workersNeeded: request.workersNeeded,
              workersActual: request.workersActual,
              note: request.note,
              vessel: { connect: { id: request.vesselId } },
              enteredBy: { connect: { id: userId(request.enteredByEmail) } },
              requestedWorkers: {
                create: request.workerEmails.map((email) => ({
                  user: { connect: { id: userId(email) } },
                })),
              },
            },
          });
        }
      },
      // Prisma ends an interactive transaction after 5 seconds by default. The
      // seed makes dozens of queries; against a remote database (about 300 ms
      // each) that isn't enough and the transaction is cut off halfway.
      { timeout: 120_000 },
    );

    console.log(
      `Seeded ${users.length} users, ${vessels.length} vessels, ${orders.length} orders and ${staffingRequests.length} staffing requests.`,
    );
    console.log(
      `All seeded users can log in with the password "${SEED_PASSWORD}".`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
