import { number, text } from "./form-data";

/**
 * Text limits of the vessel form. Copies of the API's input
 * validation, so the browser stops a too long text before sending; #82
 * will take them from the API instead.
 * See apps/api/src/vessels/create-vessel.input.ts.
 */
export const VESSEL_FIELD_LIMITS = {
  name: 200,
  imoNumber: 7,
  vesselType: 100,
} as const;

/**
 * Turns the "add a vessel" form into the `CreateVesselInput` the API expects.
 * A plain function, like order-input.ts. The API checks every rule (the IMO
 * number's check digit, a unique IMO number, a positive length).
 */
export function buildCreateVesselInput(formData: FormData) {
  return {
    name: text(formData, "name"),
    // Optional: an empty field must be left out, not sent as "".
    imoNumber: text(formData, "imoNumber"),
    vesselType: text(formData, "vesselType"),
    lengthM: number(formData, "lengthM"),
  };
}
