/**
 * The choices the order flow offers instead of typing. They are stored as
 * these codes and translated in the web app (messages `orderForm.methods`,
 * `surfaces` and `items`), so the API stays language-neutral. Anything else
 * someone typed under "Other", or entered before this list existed, is plain
 * text and is shown as it is.
 */

export const CLEANING_METHODS = [
  "HIGH_PRESSURE",
  "BLASTING",
  "MANUAL",
  "VACUUM",
] as const;

export const CLEANING_SURFACES = [
  "HULL",
  "DECK",
  "INTERIOR",
  "MACHINERY_SPACES",
  "TANKS",
] as const;

export const PROTECTED_ITEMS = [
  "MAIN_ENGINE",
  "GENERATOR",
  "DECK_FLOOR",
  "PIPEWORK",
  "FURNITURE",
  "ELECTRICAL",
] as const;

/** Whether the value is one of the codes in the list. */
export function isOneOf<T extends string>(
  list: readonly T[],
  value: string,
): value is T {
  return (list as readonly string[]).includes(value);
}

/** A title made from the choices, e.g. "High-pressure water: Hull". */
export function titleFrom(parts: string[]): string {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(": ");
}
