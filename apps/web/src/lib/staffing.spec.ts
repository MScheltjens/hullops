import { describe, expect, it } from "vitest";
import { assignedFor, findDoubleBookings, otherVessels } from "./staffing";

const WEEK = new Date("2026-10-26T00:00:00Z"); // a Monday
const anna = { id: "anna", name: "Anna" };
const tom = { id: "tom", name: "Tom" };
const order = (
  overrides: Partial<Parameters<typeof assignedFor>[0][number]> = {},
) => ({
  status: "IN_PROGRESS",
  startDate: "2026-10-20T00:00:00Z",
  dueDate: "2026-11-05T00:00:00Z",
  vessel: { id: "v1" },
  team: [anna],
  ...overrides,
});

describe("assignedFor", () => {
  it("lists the team of an open order that runs during the week", () => {
    expect(assignedFor([order()], "v1", WEEK)).toEqual([anna]);
  });

  it("counts a person once, however many orders they are on", () => {
    const orders = [order({ team: [anna, tom] }), order({ team: [anna] })];
    expect(assignedFor(orders, "v1", WEEK)).toEqual([anna, tom]);
  });

  it("ignores other vessels", () => {
    expect(assignedFor([order({ vessel: { id: "v2" } })], "v1", WEEK)).toEqual(
      [],
    );
  });

  it("ignores finished orders", () => {
    expect(assignedFor([order({ status: "DONE" })], "v1", WEEK)).toEqual([]);
  });

  it("ignores orders that end before the week or start after it", () => {
    const before = order({ dueDate: "2026-10-25T23:00:00Z" });
    const after = order({ startDate: "2026-11-02T00:00:00Z" });
    expect(assignedFor([before, after], "v1", WEEK)).toEqual([]);
  });

  it("includes an order that ends on the Monday of the week", () => {
    expect(
      assignedFor([order({ dueDate: "2026-10-26T12:00:00Z" })], "v1", WEEK),
    ).toEqual([anna]);
  });
});

describe("findDoubleBookings", () => {
  it("finds a worker asked for by two vessels", () => {
    const bookings = findDoubleBookings([
      { vessel: { id: "v1", name: "Aurora" }, requestedWorkers: [anna, tom] },
      { vessel: { id: "v2", name: "Elbe Trader" }, requestedWorkers: [anna] },
    ]);

    expect([...bookings.keys()]).toEqual(["anna"]);
    expect(bookings.get("anna")?.map((v) => v.name)).toEqual([
      "Aurora",
      "Elbe Trader",
    ]);
  });

  it("finds nothing when everyone is asked for by one vessel only", () => {
    const bookings = findDoubleBookings([
      { vessel: { id: "v1", name: "Aurora" }, requestedWorkers: [anna] },
      { vessel: { id: "v2", name: "Elbe Trader" }, requestedWorkers: [tom] },
    ]);

    expect(bookings.size).toBe(0);
  });
});

describe("otherVessels", () => {
  const bookings = findDoubleBookings([
    { vessel: { id: "v1", name: "Aurora" }, requestedWorkers: [anna] },
    { vessel: { id: "v2", name: "Elbe Trader" }, requestedWorkers: [anna] },
    { vessel: { id: "v3", name: "Hanseatic Star" }, requestedWorkers: [anna] },
  ]);

  it("names the other vessels, not the one being shown", () => {
    expect(otherVessels(bookings, "anna", "v1")).toEqual([
      "Elbe Trader",
      "Hanseatic Star",
    ]);
  });

  it("names nobody for a worker who is not double-booked", () => {
    expect(otherVessels(bookings, "tom", "v1")).toEqual([]);
  });
});
