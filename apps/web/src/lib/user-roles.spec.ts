import { describe, expect, it } from "vitest";
import {
  canManageUsers,
  homePath,
  manageableRoles,
  ROLES,
  seesWork,
} from "./user-roles";

describe("manageableRoles", () => {
  it("lets an admin manage every role", () => {
    expect(manageableRoles("ADMIN")).toEqual(ROLES);
  });

  it("lets HR manage workers, team leads and project leads only", () => {
    expect(manageableRoles("HR")).toEqual([
      "WORKER",
      "TEAM_LEAD",
      "PROJECT_LEAD",
    ]);
  });

  it("gives everyone else nothing", () => {
    for (const role of ["WORKER", "TEAM_LEAD", "PROJECT_LEAD"] as const) {
      expect(manageableRoles(role)).toEqual([]);
    }
  });
});

describe("canManageUsers", () => {
  it("is for admins and HR", () => {
    expect(ROLES.filter(canManageUsers)).toEqual(["HR", "ADMIN"]);
  });
});

describe("homePath and seesWork", () => {
  it("starts HR at the users page, because HR doesn't see orders", () => {
    expect(homePath("HR")).toBe("/admin/users");
    expect(seesWork("HR")).toBe(false);
  });

  it("starts everyone else at the orders", () => {
    for (const role of ROLES.filter((r) => r !== "HR")) {
      expect(homePath(role)).toBe("/orders");
      expect(seesWork(role)).toBe(true);
    }
  });
});
