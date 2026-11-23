/** Seed users (apps/api/prisma/seed-data.ts); all share this password. */
export const PASSWORD = "hullops-dev";
export const USERS = {
  projectLead: "lena.hoffmann@hullops.example",
  teamLead: "heinz.brandt@hullops.example",
  worker: "mehmet.yilmaz@hullops.example",
} as const;

export type Role = keyof typeof USERS;

/** Where the saved state of one role lives (gitignored). */
export function authFile(role: Role): string {
  return `e2e/.auth/${role}.json`;
}
