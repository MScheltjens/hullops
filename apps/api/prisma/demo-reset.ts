import type { Prisma } from '../src/generated/prisma/client';

/**
 * Removes everything visitors added to the public demo, so the seed that runs
 * right after it restores the demo exactly. Without this, the seed only
 * replaces its own records and test orders and users pile up.
 *
 * This deletes real rows without asking, so it only runs when SEED_RESET=true
 * (see seed.ts). Never set that against a database with data worth keeping.
 *
 * The order matters: orders, requests and their children point at users and
 * vessels, so they have to go first. Staffing requests have no seed marker,
 * but the seed recreates its own.
 */
export async function removeNonSeedRecords(
  tx: Pick<
    Prisma.TransactionClient,
    'order' | 'staffingRequest' | 'vessel' | 'user'
  >,
  seedEmails: string[],
): Promise<void> {
  await tx.order.deleteMany({});
  await tx.staffingRequest.deleteMany({});
  await tx.vessel.deleteMany({
    where: { NOT: { id: { startsWith: 'seed-' } } },
  });
  await tx.user.deleteMany({ where: { email: { notIn: seedEmails } } });
}
