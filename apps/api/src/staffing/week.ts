/**
 * Weeks, as plain functions. A week is identified by its Monday, written
 * "2026-10-26". Dates are handled in UTC so the answer never depends on the
 * server's timezone.
 */

/** Parses "YYYY-MM-DD" into midnight UTC, or null if it isn't a real date. */
export function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = [match[1], match[2], match[3]].map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  // "2026-02-31" would roll over to March; reject it instead.
  const roundTrips =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  return roundTrips ? date : null;
}

/** The date as "YYYY-MM-DD". */
export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Whether the date (in UTC) is a Monday. */
export function isMonday(date: Date): boolean {
  return date.getUTCDay() === 1;
}
