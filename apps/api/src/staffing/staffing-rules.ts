import { isMonday, parseDateOnly } from './week';

/**
 * Rules for a weekly staffing request, as a plain function: no database and
 * no Nest, so it's easy to test. Returns every violation, like
 * validateOrderInput does for orders.
 */
export function validateStaffingRequest(input: {
  weekStart: string;
  workersNeeded: number;
  requestedWorkerIds: string[];
}): string[] {
  const errors: string[] = [];

  const week = parseDateOnly(input.weekStart);
  if (!week) {
    errors.push('weekStart must be a date like 2026-10-26');
  } else if (!isMonday(week)) {
    errors.push('weekStart must be a Monday');
  }

  // Workers asked for by name are part of the total, so there can't be more
  // of them than the total.
  const named = new Set(input.requestedWorkerIds).size;
  if (named > input.workersNeeded) {
    errors.push(
      `${named} workers are requested by name, but only ${input.workersNeeded} are needed in total`,
    );
  }

  return errors;
}
