import { testDatabaseUrl } from './test-database';

// Runs in every test worker before the suites load. The app's ConfigModule
// doesn't override variables that are already set, so it connects to the
// test database instead of the one in .env.
process.env.DATABASE_URL = testDatabaseUrl();
process.env.NODE_ENV = 'test';
