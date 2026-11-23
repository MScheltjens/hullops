import { test as setup } from "@playwright/test";
import { authFile, PASSWORD, USERS, type Role } from "./auth";

/**
 * Logs in once per demo role and saves the browser state (the httpOnly
 * session cookie) to a file. Tests then start logged in with
 * `test.use({ storageState: authFile("projectLead") })`, instead of filling
 * in the login form in every test.
 *
 * Runs as the "setup" project, before the tests (see playwright.config.ts).
 */

for (const [role, email] of Object.entries(USERS) as [Role, string][]) {
  setup(`log in as ${role}`, async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    // Login redirects to "/", which redirects to the role's home: /orders.
    // Being there proves the session cookie is set.
    await page.waitForURL("/orders");
    await page.context().storageState({ path: authFile(role) });
  });
}
