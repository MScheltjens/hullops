import { describe, expect, it } from "vitest";
import { buildCreateUserInput } from "./user-input";

function form(entries: [string, string][]): FormData {
  const formData = new FormData();
  for (const [name, value] of entries) formData.append(name, value);
  return formData;
}

describe("buildCreateUserInput", () => {
  it("trims the name and email", () => {
    const input = buildCreateUserInput(
      form([
        ["name", "  Anna Schulz "],
        ["email", " anna@hullops.example\n"],
      ]),
    );

    expect(input.name).toBe("Anna Schulz");
    expect(input.email).toBe("anna@hullops.example");
  });

  it("keeps the password exactly as typed", () => {
    const input = buildCreateUserInput(form([["password", "  a b c  "]]));

    expect(input.password).toBe("  a b c  ");
  });

  it("leaves a missing password as an empty string, for the API to reject", () => {
    expect(buildCreateUserInput(form([])).password).toBe("");
  });

  it("collects every checked service area", () => {
    const input = buildCreateUserInput(
      form([
        ["serviceTypes", "CLEANING"],
        ["serviceTypes", "PROTECTION"],
      ]),
    );

    expect(input.serviceTypes).toEqual(["CLEANING", "PROTECTION"]);
  });

  it("sends no service areas when none are checked", () => {
    expect(buildCreateUserInput(form([])).serviceTypes).toEqual([]);
  });
});
