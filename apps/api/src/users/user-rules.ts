import type { Role } from '../generated/prisma/client';

/**
 * Rules about changing users, as plain functions: no database and no Nest,
 * so they're easy to test.
 */

/** Admin-set passwords must be at least this long. */
export const MIN_PASSWORD_LENGTH = 8;

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
