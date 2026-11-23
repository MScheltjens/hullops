import { execFileSync } from 'node:child_process';
import { ensureDatabaseExists } from './test-database';

/**
 * Prepares the database for the browser tests (Playwright in apps/web):
 * creates it, applies the migrations and resets it to the demo seed, so
 * every run starts from the same data.
 *
 * Playwright passes DATABASE_URL (see apps/web/playwright.config.ts). The
 * reset deletes everything that isn't seed data, so this refuses any
 * database whose name doesn't end in `_e2e`. That keeps the dev database,
 * and the `_test` one the API e2e tests own, out of reach.
 *
 * Run with `pnpm --filter api prepare:browser-db`.
 */
async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is not set');
  const name = new URL(databaseUrl).pathname.slice(1);
  if (!name.endsWith('_e2e')) {
    throw new Error(
      `Refusing to reset "${name}": the browser test database must end in _e2e`,
    );
  }

  await ensureDatabaseExists(databaseUrl);
  const env = { ...process.env, DATABASE_URL: databaseUrl };
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    env,
    stdio: 'inherit',
  });
  execFileSync('pnpm', ['exec', 'prisma', 'db', 'seed'], {
    env: { ...env, SEED_RESET: 'true' },
    stdio: 'inherit',
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
