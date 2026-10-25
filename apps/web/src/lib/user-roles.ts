/**
 * Which roles may manage which users, and where each role starts. Plain
 * functions, like the other files in this folder. The screens only use them
 * to show the right choices; the API enforces the same rules
 * (apps/api/src/users/user-rules.ts).
 */

export const ROLES = [
  "WORKER",
  "TEAM_LEAD",
  "PROJECT_LEAD",
  "HR",
  "ADMIN",
] as const;
export type Role = (typeof ROLES)[number];

/** The roles HR may manage. HR can't make or touch admins or other HR. */
const HR_MANAGED_ROLES: readonly Role[] = [
  "WORKER",
  "TEAM_LEAD",
  "PROJECT_LEAD",
];

/** Whether this role has the user-management page at all. */
export function canManageUsers(role: Role): boolean {
  return role === "ADMIN" || role === "HR";
}

/** The roles this role may create, give to someone and manage. */
export function manageableRoles(role: Role): readonly Role[] {
  if (role === "ADMIN") return ROLES;
  if (role === "HR") return HR_MANAGED_ROLES;
  return [];
}

/** The first page after login. HR doesn't see orders, so it starts at users. */
export function homePath(role: Role): string {
  return role === "HR" ? "/admin/users" : "/orders";
}

/** Whether this role sees the work: orders, vessels and planning. */
export function seesWork(role: Role): boolean {
  return role !== "HR";
}
