import { describe, expect, it } from "vitest";
import { canUpdateOrder, nextStatus } from "./order-status";

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
