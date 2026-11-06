import { describe, expect, it } from "vitest";
import { DEMO_ROLES, demoCredentials, isDemoMode } from "./demo-login";
import { ROLES } from "./user-roles";

describe("isDemoMode", () => {
  it('is only on for exactly "true"', () => {
    expect(isDemoMode("true")).toBe(true);
    for (const value of [undefined, "", "false", "1", "TRUE"]) {
      expect(isDemoMode(value)).toBe(false);
    }
  });
});

describe("demoCredentials", () => {
  it("has a login for every role", () => {
    expect([...DEMO_ROLES].sort()).toEqual([...ROLES].sort());
    for (const role of DEMO_ROLES) {
      expect(demoCredentials(role)?.email).toMatch(/@hullops\.example$/);
    }
  });

  it("gives nothing for an unknown role", () => {
    expect(demoCredentials("")).toBeUndefined();
    expect(demoCredentials("SUPERUSER")).toBeUndefined();
    // Not fooled by what every object inherits.
    expect(demoCredentials("constructor")).toBeUndefined();
  });
});
