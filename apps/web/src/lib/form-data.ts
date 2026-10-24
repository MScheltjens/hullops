/** Small helpers for reading submitted forms, shared by the input builders. */

/** A text field: trimmed, and undefined when left empty. */
export function text(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

/** A number field: undefined when empty (or not a number). */
export function number(formData: FormData, name: string): number | undefined {
  const value = text(formData, name);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}
