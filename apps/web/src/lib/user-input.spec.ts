import { describe, expect, it } from "vitest";
import {
  buildCreateUserInput,
  buildResetPasswordInput,
  buildUpdateUserInput,
} from "./user-input";

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

describe("buildUpdateUserInput", () => {
  it("carries the user id and the changed fields", () => {
    const input = buildUpdateUserInput(
      "user-1",
      form([
        ["name", " Tom "],
        ["role", "PROJECT_LEAD"],
        ["serviceTypes", "PROTECTION"],
      ]),
    );

    expect(input).toEqual({
      userId: "user-1",
      name: "Tom",
      role: "PROJECT_LEAD",
      serviceTypes: ["PROTECTION"],
    });
  });

  it("leaves the role out when the form has none (your own row)", () => {
    const input = buildUpdateUserInput("me", form([["name", "Me"]]));

    expect(input.role).toBeUndefined();
  });

  it("sends an empty list when every service area is unchecked", () => {
    // Unchecking everything must clear the areas, not leave them unchanged.
    expect(buildUpdateUserInput("u", form([["name", "X"]])).serviceTypes).toEqual(
      [],
    );
  });
});

describe("buildResetPasswordInput", () => {
  it("sends the password exactly as typed", () => {
    expect(
      buildResetPasswordInput("user-1", form([["password", " new pass "]])),
    ).toEqual({ userId: "user-1", password: " new pass " });
  });
});
