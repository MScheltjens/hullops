import { config } from 'dotenv';
import { Client } from 'pg';

/**
 * The e2e tests never touch the development database. They use a database
 * with the same name plus a `_test` suffix (hullops → hullops_test) on the
 * same server. If DATABASE_URL already ends in `_test`, as in CI, it is used
 * as is.
 */
export function testDatabaseUrl(): string {
  // Load .env like the app does; variables that are already set win.
  config({ quiet: true });
  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error('DATABASE_URL is not set (see apps/api/.env.example)');
  }
  const url = new URL(base);
  const name = url.pathname.slice(1);
  if (!name.endsWith('_test')) {
    url.pathname = `/${name}_test`;
  }
  return url.toString();
}

/** Creates the test database if it doesn't exist yet. */
export async function ensureDatabaseExists(databaseUrl: string): Promise<void> {
  const url = new URL(databaseUrl);
  const name = url.pathname.slice(1);
  // CREATE DATABASE has to run while connected to another database.
  url.pathname = '/postgres';
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [name],
    );
    if (rowCount === 0) {
      // Identifiers can't be query parameters; the name comes from our own
      // DATABASE_URL, and quoting it keeps it a single identifier.
      await client.query(`CREATE DATABASE "${name.replaceAll('"', '""')}"`);
    }
  } finally {
    await client.end();
  }
}
