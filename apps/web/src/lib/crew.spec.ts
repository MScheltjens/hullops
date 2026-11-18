import { describe, expect, it } from "vitest";
import {
  addCandidates,
  crewByVessel,
  plannedCandidates,
  requestedNotPlanned,
  stillNeeded,
  unplannedWorkers,
} from "./crew";

const anna = { id: "anna", name: "Anna" };
const piotr = { id: "piotr", name: "Piotr" };
const tom = { id: "tom", name: "Tom" };
const nordlicht = { id: "v1", name: "Nordlicht" };
const seaBreeze = { id: "v2", name: "Sea Breeze" };
const plan = [
  { user: tom, vessel: nordlicht },
  { user: piotr, vessel: nordlicht },
  { user: anna, vessel: seaBreeze },
];

describe("crewByVessel", () => {
  it("groups the plan per vessel, by name", () => {
    const crews = crewByVessel(plan);
    expect(crews.get("v1")).toEqual([piotr, tom]);
    expect(crews.get("v2")).toEqual([anna]);
    expect(crews.get("v3")).toBeUndefined();
  });
});

describe("requestedNotPlanned", () => {
  it("leaves out who is already on the crew", () => {
    expect(requestedNotPlanned([anna, piotr], [piotr, tom])).toEqual([anna]);
  });
});

describe("addCandidates", () => {
  const someone = { id: "zoe", name: "Zoe" };

  it("offers everyone not on this vessel, unplanned workers first", () => {
    expect(addCandidates([tom, anna, someone, piotr], plan, "v1")).toEqual([
      { worker: someone, plannedOn: null },
      { worker: anna, plannedOn: seaBreeze },
    ]);
  });
});

describe("unplannedWorkers", () => {
  it("lists the workers on no vessel", () => {
    const zoe = { id: "zoe", name: "Zoe" };
    const bob = { id: "bob", name: "Bob" };
    expect(unplannedWorkers([zoe, anna, bob], plan)).toEqual([bob, zoe]);
  });
});

describe("stillNeeded", () => {
  it("is the request minus the planned crew", () => {
    expect(stillNeeded(5, [anna, tom])).toBe(3);
  });

  it("is never negative, and zero without a request", () => {
    expect(stillNeeded(1, [anna, tom])).toBe(0);
    expect(stillNeeded(undefined, [anna])).toBe(0);
  });
});

describe("plannedCandidates", () => {
  const row = (person: typeof anna, serviceTypes: string[], vessel = nordlicht) => ({
    user: { ...person, serviceTypes },
    vessel,
  });

  it("offers planned workers of the vessel and service area, once each", () => {
    const rows = [
      row(tom, ["CLEANING"]),
      row(tom, ["CLEANING"]), // planned this week and next week
      row(anna, ["CLEANING"], seaBreeze), // another vessel
      row(piotr, ["PROTECTION"]), // another service area
    ];
    expect(plannedCandidates(rows, "v1", "CLEANING", [])).toEqual([tom]);
  });

  it("leaves out who is already on the team", () => {
    const rows = [row(tom, ["CLEANING"])];
    expect(plannedCandidates(rows, "v1", "CLEANING", [tom])).toEqual([]);
  });
});
