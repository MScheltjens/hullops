import type { Role } from "./user-roles";

/**
 * The one-tap logins on the public demo. The accounts come from the seed
 * (apps/api/prisma/seed-data.ts) and their password is public, so this holds
 * no secret. It still stays on the server: the browser only sends a role.
 */

const DEMO_PASSWORD = "hullops-dev";

const DEMO_EMAILS: Record<Role, string> = {
  PROJECT_LEAD: "lena.hoffmann@hullops.example",
  TEAM_LEAD: "heinz.brandt@hullops.example",
  WORKER: "mehmet.yilmaz@hullops.example",
  HR: "petra.neumann@hullops.example",
  ADMIN: "admin@hullops.example",
};

/** In the order the buttons appear: the main user of the app first. */
export const DEMO_ROLES: readonly Role[] = [
  "PROJECT_LEAD",
  "TEAM_LEAD",
  "WORKER",
  "HR",
  "ADMIN",
];

/** Reads the DEMO_MODE setting. Anything but "true" keeps the logins off. */
export function isDemoMode(value: string | undefined): boolean {
  return value === "true";
}

/** The login for a role, or undefined for anything that isn't a demo role. */
export function demoCredentials(
  role: string,
): { email: string; password: string } | undefined {
  if (!(DEMO_ROLES as readonly string[]).includes(role)) return undefined;
  return { email: DEMO_EMAILS[role as Role], password: DEMO_PASSWORD };
}
