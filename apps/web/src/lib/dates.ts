/**
 * Date helpers for the order flow: quick choices ("today", "next Monday")
 * instead of typing dates. Dates are plain "YYYY-MM-DD" strings, calculated
 * in UTC so they never depend on the server's timezone.
 */

/** The yard's timezone, used to decide what "today" is. */
export const APP_TIME_ZONE = "Europe/Berlin";

/** Today's date in the yard's timezone, e.g. "2026-10-26". */
export function todayIn(now: Date, timeZone: string = APP_TIME_ZONE): string {
  // The "en-CA" locale writes dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
}

/** The date `days` days after (or before, when negative) the given date. */
export function addDays(dateOnly: string, days: number): string {
  const date = new Date(`${dateOnly}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The Monday after the given date (a Monday gives the Monday a week later). */
export function nextMonday(dateOnly: string): string {
  const weekday = new Date(`${dateOnly}T00:00:00Z`).getUTCDay(); // Sunday is 0
  return addDays(dateOnly, ((8 - weekday) % 7) || 7);
}

export const START_CHOICES = ["TODAY", "TOMORROW", "NEXT_MONDAY"] as const;
export type StartChoice = (typeof START_CHOICES)[number];

export function startFor(choice: StartChoice, today: string): string {
  if (choice === "TODAY") return today;
  if (choice === "TOMORROW") return addDays(today, 1);
  return nextMonday(today);
}

/** How long an order runs, in days, counting the first and the last day. */
export const DURATION_CHOICES = [
  { key: "D1", days: 1 },
  { key: "D3", days: 3 },
  { key: "W1", days: 7 },
  { key: "W2", days: 14 },
  { key: "M1", days: 30 },
] as const;
export type DurationChoice = (typeof DURATION_CHOICES)[number]["key"];

/** The last day of an order that starts on `start` and lasts `days` days. */
export function endFor(start: string, days: number): string {
  return addDays(start, days - 1);
}
