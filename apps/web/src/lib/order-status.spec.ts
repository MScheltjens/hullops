import { describe, expect, it } from "vitest";
import { canChangeTeam, canUpdateOrder, nextStatus } from "./order-status";

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

describe("canUpdateOrder", () => {
  const team = [{ id: "worker-1" }, { id: "worker-2" }];

  it("lets a worker on the team update the order", () => {
    expect(canUpdateOrder({ id: "worker-1", role: "WORKER" }, team)).toBe(true);
  });

  // Your turn: replace each todo with a test, like the one above.
  it.todo("refuses a worker who is not on the team");
  it.todo("lets a project lead update an order they are not on the team of");
  it.todo("refuses a worker when the team is empty");
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
