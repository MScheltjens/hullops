import { describe, expect, it } from "vitest";
import { buildSaveStaffingInput } from "./staffing-input";

function form(entries: [string, string][]): FormData {
  const formData = new FormData();
  for (const [name, value] of entries) formData.append(name, value);
  return formData;
}

describe("buildSaveStaffingInput", () => {
  it("carries the vessel, the week and the numbers", () => {
    const input = buildSaveStaffingInput(
      "vessel-1",
      "2026-10-26",
      form([
        ["workersNeeded", "6"],
        ["workersActual", "5"],
      ]),
    );

    expect(input).toMatchObject({
      vesselId: "vessel-1",
      weekStart: "2026-10-26",
      workersNeeded: 6,
      workersActual: 5,
    });
  });

  it("leaves the actual number out until it is filled in", () => {
    const input = buildSaveStaffingInput(
      "v",
      "2026-10-26",
      form([
        ["workersNeeded", "6"],
        ["workersActual", ""],
      ]),
    );

    expect(input.workersActual).toBeUndefined();
  });

  it("collects the workers asked for by name", () => {
    const input = buildSaveStaffingInput(
      "v",
      "2026-10-26",
      form([
        ["workerIds", "w-1"],
        ["workerIds", "w-2"],
      ]),
    );

    expect(input.requestedWorkerIds).toEqual(["w-1", "w-2"]);
  });

  it("sends an empty list when nobody is checked, so the old list is cleared", () => {
    expect(
      buildSaveStaffingInput("v", "2026-10-26", form([])).requestedWorkerIds,
    ).toEqual([]);
  });

  it("trims the note and drops an empty one", () => {
    const filled = buildSaveStaffingInput(
      "v",
      "2026-10-26",
      form([["note", "  Same crew "]]),
    );
    const empty = buildSaveStaffingInput(
      "v",
      "2026-10-26",
      form([["note", "   "]]),
    );

    expect(filled.note).toBe("Same crew");
    expect(empty.note).toBeUndefined();
  });
});
