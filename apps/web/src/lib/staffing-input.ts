import { number, text } from "./form-data";

/**
 * Turns the weekly staffing form into the `SaveStaffingRequestInput` the API
 * expects. A plain function, like order-input.ts. The API checks every rule
 * (a Monday, named workers within the total, only active workers).
 */
export function buildSaveStaffingInput(
  vesselId: string,
  weekStart: string,
  formData: FormData,
) {
  return {
    vesselId,
    weekStart,
    workersNeeded: number(formData, "workersNeeded"),
    // Optional: filled in afterwards, for the invoice.
    workersActual: number(formData, "workersActual"),
    // Unchecking everyone must clear the list, so an empty list is sent.
    requestedWorkerIds: formData.getAll("workerIds"),
    note: text(formData, "note"),
  };
}
