/**
 * Turns the "new order" form into the `CreateOrderInput` the API expects.
 * Plain functions without Next.js or React, so they're easy to test.
 *
 * Deliberately no validation here: the API checks every rule (required
 * fields, details matching the service type, start before due date) and
 * answers with all violations at once. Repeating the rules in the web app
 * would only let the two drift apart.
 */

export const SERVICE_TYPES = ["CLEANING", "PROTECTION"] as const;
export const PROTECTION_KINDS = [
  "ENCLOSURE",
  "COVERING",
  "FLOOR",
  "COATING",
] as const;
export const PROTECTION_MATERIALS = [
  "OSB_STANDARD",
  "OSB_FIRE_RESISTANT",
  "PROPLEX_3MM",
  "PROPLEX_HD",
  "GLASS_FIBER_FABRIC",
] as const;

/** A text field: trimmed, and undefined when left empty. */
function text(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

/** A number field: undefined when empty (or not a number). */
function number(formData: FormData, name: string): number | undefined {
  const value = text(formData, name);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * A date field (`<input type="date">` gives "2026-10-05") as a timestamp.
 * It's noon UTC: a date has no time of day, and noon keeps the same calendar
 * day in every timezone from UTC-12 to UTC+12 when the order is displayed.
 * Midnight would show as the previous day west of Greenwich.
 */
function date(formData: FormData, name: string): string | undefined {
  const value = text(formData, name);
  return value === undefined ? undefined : `${value}T12:00:00.000Z`;
}

export function buildCreateOrderInput(formData: FormData) {
  const serviceType = text(formData, "serviceType");
  const kind = text(formData, "kind");

  return {
    title: text(formData, "title"),
    description: text(formData, "description"),
    serviceType,
    shipyard: text(formData, "shipyard"),
    berth: text(formData, "berth"),
    areaSqm: number(formData, "areaSqm"),
    startDate: date(formData, "startDate"),
    dueDate: date(formData, "dueDate"),
    vesselId: text(formData, "vesselId"),
    // Only the details that belong to the chosen service type are sent. The
    // form hides the other fields, but a stale value must never reach the
    // API, which rejects details that don't match the service type.
    cleaning:
      serviceType === "CLEANING"
        ? {
            method: text(formData, "method"),
            surface: text(formData, "surface"),
          }
        : undefined,
    protection:
      serviceType === "PROTECTION"
        ? {
            kind,
            protectedItem: text(formData, "protectedItem"),
            materials: formData.getAll("materials"),
            // Coating fields apply to coatings only.
            ...(kind === "COATING"
              ? {
                  coatingProduct: text(formData, "coatingProduct"),
                  layers: number(formData, "layers"),
                  targetThicknessUm: number(formData, "targetThicknessUm"),
                }
              : {}),
          }
        : undefined,
  };
}

/**
 * The submitted values as plain data, so the form can refill itself after an
 * error: React empties a form once its action has run.
 */
export function echoValues(
  formData: FormData,
): Record<string, string | string[]> {
  const values: Record<string, string | string[]> = {};
  for (const name of new Set(formData.keys())) {
    // Skip React's internal "$ACTION_…" fields.
    if (name.startsWith("$ACTION_")) continue;
    const all = formData.getAll(name).filter((v) => typeof v === "string");
    values[name] = name === "materials" ? all : (all[0] ?? "");
  }
  return values;
}
