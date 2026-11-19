import { describe, expect, it } from "vitest";
import { canChangeTeam, nextStatus } from "./order-status";

describe("nextStatus", () => {
  it("moves a planned order to in progress", () => {
    expect(nextStatus("PLANNED")).toBe("IN_PROGRESS");
  });

  it("moves an order in progress to done", () => {
    expect(nextStatus("IN_PROGRESS")).toBe("DONE");
  });

  it("has nothing after done", () => {
    expect(nextStatus("DONE")).toBeUndefined();
  });
});

describe("canChangeTeam", () => {
  const vessel = { teamLead: { id: "heinz" } };

  it("lets project leads change any team", () => {
    expect(canChangeTeam({ id: "lena", role: "PROJECT_LEAD" }, vessel)).toBe(
      true,
    );
  });

  it("lets a team lead change teams on his own vessel only", () => {
    expect(canChangeTeam({ id: "heinz", role: "TEAM_LEAD" }, vessel)).toBe(
      true,
    );
    expect(canChangeTeam({ id: "ute", role: "TEAM_LEAD" }, vessel)).toBe(
      false,
    );
    expect(
      canChangeTeam({ id: "heinz", role: "TEAM_LEAD" }, { teamLead: null }),
    ).toBe(false);
  });

  it("keeps workers and admins out", () => {
    for (const role of ["WORKER", "ADMIN"] as const) {
      expect(canChangeTeam({ id: "heinz", role }, vessel)).toBe(false);
    }
  });
});
