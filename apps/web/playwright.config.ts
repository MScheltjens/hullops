import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { defineConfig, devices } from "@playwright/test";

/**
 * Browser end-to-end tests: Playwright starts the real API and web app
 * against their own seeded database and drives a mobile Chromium.
 *
 * Own ports (API 4100, web 3100) so the dev servers on 4000/3000 can keep
 * running, and so a test can never talk to the dev API and its data.
 */
const API_PORT = 4100;
const WEB_PORT = 3100;

/**
 * The browser tests get their own database: the dev database name plus
 * `_e2e` (hullops → hullops_e2e). Not `_test`, which the API e2e tests
 * empty between suites. Locally the base URL comes from apps/api/.env, in
 * CI from the environment.
 */
function e2eDatabaseUrl(): string {
  const base = process.env.DATABASE_URL ?? readApiEnv().DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL is not set (see apps/api/.env)");
  const url = new URL(base);
  const name = url.pathname.slice(1).replace(/_(test|e2e)$/, "");
  url.pathname = `/${name}_e2e`;
  return url.toString();
}

function readApiEnv(): Record<string, string | undefined> {
  try {
    return parseEnv(readFileSync("../api/.env", "utf8"));
  } catch {
    return {};
  }
}

export default defineConfig({
  testDir: "./e2e",
  // *.e2e.ts, not *.spec.ts: Vitest picks up every *.spec.ts as a unit test.
  testMatch: "**/*.e2e.ts",
  // Tests share one seeded database; run them one at a time until a test
  // needs its own data.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",

  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    locale: "en-US",
    // A trace (DOM snapshots, network, console) of every failed test, locally
    // too: "on-first-retry" would only record one on a retry, and locally
    // there are none. Passing tests keep none. The HTML report links them;
    // CI uploads it. Open one with `pnpm exec playwright show-trace`.
    trace: "retain-on-failure",
  },

  projects: [
    // Logs in once per demo role and saves the session cookie (see
    // e2e/auth.setup.e2e.ts); the tests start logged in.
    { name: "setup", testMatch: "**/*.setup.e2e.ts" },
    {
      // The app is used mostly on phones on the yard.
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
      dependencies: ["setup"],
      testIgnore: "**/*.setup.e2e.ts",
    },
  ],

  webServer: [
    {
      // Fresh seed first, then the API on that database.
      command: "pnpm --filter api prepare:browser-db && pnpm --filter api start",
      url: `http://localhost:${API_PORT}/health`,
      env: { DATABASE_URL: e2eDatabaseUrl(), PORT: String(API_PORT) },
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      // A production build: closest to what users get, and `next dev`
      // allows one instance per project, which the dev server may hold.
      command: `pnpm build && pnpm start --port ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}/login`,
      env: { API_URL: `http://localhost:${API_PORT}/graphql` },
      reuseExistingServer: false,
      timeout: 300_000,
    },
  ],
});
