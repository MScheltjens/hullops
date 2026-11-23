import { expect, test } from "@playwright/test";
import { authFile } from "./auth";

// Every test in this file starts logged in as the project lead.
test.use({ storageState: authFile("projectLead") });

test("project lead sees the order overview", async ({ page }) => {
  await page.goto("/orders");

  // The heading is part of the page itself: it proves the page renders and
  // the saved session is accepted (otherwise we'd be sent to /login).
  // German, because the app speaks the user's language (User.locale), and
  // Lena is seeded with DE: the browser's en-US doesn't count once logged in.
  await expect(page.getByRole("heading", { name: "Aufträge" })).toBeVisible();

  // A seeded order comes from the database through the API: it proves the
  // whole chain works (cookie → DAL → API → Postgres).
  // getByRole, not getByText: the page renders every order twice, as a card
  // (phones) and in a table (md and up), and CSS hides one. getByRole skips
  // hidden elements, so it finds the card, the link a worker taps.
  await expect(
    page.getByRole("link", { name: "Hull cleaning before repainting" }),
  ).toBeVisible();
});
