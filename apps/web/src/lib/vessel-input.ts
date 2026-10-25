import { number, text } from "./form-data";

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
