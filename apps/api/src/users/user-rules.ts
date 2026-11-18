import type { Role } from '../generated/prisma/client';

/**
 * Rules about changing users, as plain functions: no database and no Nest,
 * so they're easy to test.
 */

/** Admin-set passwords must be at least this long. */
export const MIN_PASSWORD_LENGTH = 8;

/** The roles HR may create, change, deactivate and reset passwords for. */
const HR_MANAGED_ROLES: readonly Role[] = [
  'WORKER',
  'TEAM_LEAD',
  'PROJECT_LEAD',
];

/**
 * Whether this actor may manage users of this role, as the target of a
 * change or as the role to give someone. Admins manage everyone. HR manages
 * only the roles above: that way HR can't make an admin, promote anyone to
 * HR, or take over an admin's account by resetting its password.
 */
export function canManageRole(actorRole: Role, role: Role): boolean {
  if (actorRole === 'ADMIN') return true;
  if (actorRole === 'HR') return HR_MANAGED_ROLES.includes(role);
  return false;
}

/**
 * Stops an admin from locking themselves out. Nobody may change their own
 * role or deactivate themselves; another admin has to do it. Because the
 * person making a change is always an active admin, there is then always at
 * least one admin left.
 *
 * Returns every violation, like validateOrderInput does for orders.
 */
export function validateUserChange(
  actorId: string,
  target: { id: string; role: Role },
  change: { role?: Role; active?: boolean },
): string[] {
  if (actorId !== target.id) return [];

  const errors: string[] = [];
  if (change.role !== undefined && change.role !== target.role) {
    errors.push('You cannot change your own role');
  }
  if (change.active === false) {
    errors.push('You cannot deactivate yourself');
  }
  return errors;
}

/**
 * Whether the viewer may see this user's email address: their own, and
 * everyone's for administrators and HR, who manage the accounts. The others
 * work with names; an email is personal data they don't need. `viewer` is
 * undefined when nobody is logged in.
 */
export function canSeeEmail(
  viewer: { id: string; role: Role } | undefined,
  user: { id: string },
): boolean {
  if (!viewer) return false;
  return (
    viewer.id === user.id || viewer.role === 'ADMIN' || viewer.role === 'HR'
  );
}
