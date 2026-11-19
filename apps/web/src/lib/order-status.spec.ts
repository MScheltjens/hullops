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
  // An order on Heinz's vessel with two workers on its team.
  const order = {
    team: [{ id: "worker-1" }, { id: "worker-2" }],
    vessel: { teamLead: { id: "heinz" } },
  };

  it("lets a worker on the team update the order", () => {
    expect(canUpdateOrder({ id: "worker-1", role: "WORKER" }, order)).toBe(
      true,
    );
  });

  it("refuses a worker who is not on the team", () => {
    expect(canUpdateOrder({ id: "worker-3", role: "WORKER" }, order)).toBe(
      false,
    );
  });

  it("lets a project lead update an order they are not on the team of", () => {
    expect(canUpdateOrder({ id: "lena", role: "PROJECT_LEAD" }, order)).toBe(
      true,
    );
  });

  it("refuses a worker when the team is empty", () => {
    expect(
      canUpdateOrder(
        { id: "worker-1", role: "WORKER" },
        { ...order, team: [] },
      ),
    ).toBe(false);
  });

  it("lets the vessel's team lead update an order he is not on the team of", () => {
    expect(canUpdateOrder({ id: "heinz", role: "TEAM_LEAD" }, order)).toBe(
      true,
    );
  });

  it("refuses a team lead on another vessel's order", () => {
    expect(canUpdateOrder({ id: "ute", role: "TEAM_LEAD" }, order)).toBe(
      false,
    );
  });

  it("refuses a team lead when the vessel has no team lead", () => {
    expect(
      canUpdateOrder(
        { id: "heinz", role: "TEAM_LEAD" },
        { ...order, vessel: { teamLead: null } },
      ),
    ).toBe(false);
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
