import { execFileSync } from 'node:child_process';
import { ensureDatabaseExists, testDatabaseUrl } from './test-database';

/**
 * Runs once before the e2e suites: makes sure the test database exists and
 * has the current schema, so `pnpm test:e2e` works without manual steps.
 */
export default async function globalSetup(): Promise<void> {
  const databaseUrl = testDatabaseUrl();
  await ensureDatabaseExists(databaseUrl);
  // Applies pending migrations only; a no-op when the schema is current.
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
}
