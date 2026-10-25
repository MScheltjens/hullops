/**
 * Weeks as plain functions. A week is identified by its Monday, written
 * "2026-10-26", and handled in UTC so the answer never depends on the
 * server's timezone. The API uses the same convention.
 */

const DAY = 86_400_000;

/** Midnight UTC on the Monday of the week the date falls in. */
export function mondayOf(date: Date): Date {
  const midnight = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
  // getUTCDay(): Sunday is 0, so a Sunday belongs to the week that began six
  // days earlier (the ISO week).
  const sinceMonday = (new Date(midnight).getUTCDay() + 6) % 7;
  return new Date(midnight - sinceMonday * DAY);
}

export function addWeeks(monday: Date, weeks: number): Date {
  return new Date(monday.getTime() + weeks * 7 * DAY);
}

/** The date as "YYYY-MM-DD". */
export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The week to show, from the `?week=` search param: any valid date gives the
 * Monday of its week. Missing or invalid gives next week, which is what
 * foremen report on.
 */
export function parseWeekParam(
  value: string | string[] | undefined,
  now: Date,
): Date {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00Z`);
    // "2026-02-31" would roll over to March; fall back instead.
    if (!Number.isNaN(date.getTime()) && toDateOnly(date) === value) {
      return mondayOf(date);
    }
  }
  return addWeeks(mondayOf(now), 1);
}

/** The ISO 8601 week number (1 to 53) of the week starting on `monday`. */
export function isoWeek(monday: Date): number {
  // The week belongs to the year its Thursday is in.
  const thursday = new Date(monday.getTime() + 3 * DAY);
  const jan1 = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return Math.floor((thursday.getTime() - jan1) / (7 * DAY)) + 1;
}
