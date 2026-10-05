import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../src/auth/password';
import { PrismaClient } from '../src/generated/prisma/client';
import { buildSeedData, SEED_PASSWORD } from './seed-data';

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
  const { users, vessels, orders } = buildSeedData(new Date());

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

        for (const vessel of vessels) {
          await tx.vessel.upsert({
            where: { id: vessel.id },
            create: vessel,
            update: vessel,
          });
        }

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
      },
      // Prisma ends an interactive transaction after 5 seconds by default. The
      // seed makes dozens of queries; against a remote database (about 300 ms
      // each) that isn't enough and the transaction is cut off halfway.
      { timeout: 120_000 },
    );

    console.log(
      `Seeded ${users.length} users, ${vessels.length} vessels and ${orders.length} orders.`,
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
