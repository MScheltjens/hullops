import { describe, expect, it } from "vitest";
import { buildCreateVesselInput } from "./vessel-input";

function form(entries: [string, string][]): FormData {
  const formData = new FormData();
  for (const [name, value] of entries) formData.append(name, value);
  return formData;
}

describe("buildCreateVesselInput", () => {
  it("trims the text fields", () => {
    const input = buildCreateVesselInput(
      form([
        ["name", "  MV Aurora "],
        ["imoNumber", " 9074729 "],
        ["vesselType", " yacht\n"],
      ]),
    );

    expect(input.name).toBe("MV Aurora");
    expect(input.imoNumber).toBe("9074729");
    expect(input.vesselType).toBe("yacht");
  });

  it("leaves empty optional fields out", () => {
    const input = buildCreateVesselInput(
      form([
        ["name", "MV Aurora"],
        ["imoNumber", ""],
        ["vesselType", "  "],
        ["lengthM", ""],
      ]),
    );

    expect(input.imoNumber).toBeUndefined();
    expect(input.vesselType).toBeUndefined();
    expect(input.lengthM).toBeUndefined();
  });

  it("turns the length into a number", () => {
    expect(buildCreateVesselInput(form([["lengthM", "84.5"]])).lengthM).toBe(
      84.5,
    );
  });
});
