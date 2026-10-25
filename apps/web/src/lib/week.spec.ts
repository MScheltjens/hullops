import { describe, expect, it } from "vitest";
import {
  addWeeks,
  isoWeek,
  mondayOf,
  parseWeekParam,
  toDateOnly,
} from "./week";

const day = (value: string) => new Date(`${value}T12:00:00Z`);

describe("mondayOf", () => {
  it("gives the Monday of the week for any day", () => {
    // 2026-10-26 is a Monday.
    for (const d of [
      "2026-10-26",
      "2026-10-28",
      "2026-10-31",
      "2026-11-01", // the Sunday still belongs to that week
    ]) {
      expect(toDateOnly(mondayOf(day(d)))).toBe("2026-10-26");
    }
  });

  it("starts the next week on the following Monday", () => {
    expect(toDateOnly(mondayOf(day("2026-11-02")))).toBe("2026-11-02");
  });

  it("works across a year boundary", () => {
    expect(toDateOnly(mondayOf(day("2027-01-01")))).toBe("2026-12-28");
  });
});

describe("addWeeks", () => {
  it("moves by whole weeks, forwards and backwards", () => {
    const monday = mondayOf(day("2026-10-26"));
    expect(toDateOnly(addWeeks(monday, 1))).toBe("2026-11-02");
    expect(toDateOnly(addWeeks(monday, -1))).toBe("2026-10-19");
  });

  it("is not thrown off by the clocks changing", () => {
    // The last Sunday of October, when daylight saving time ends in Europe.
    expect(toDateOnly(addWeeks(mondayOf(day("2026-10-19")), 1))).toBe(
      "2026-10-26",
    );
  });
});

describe("parseWeekParam", () => {
  const now = day("2026-10-28"); // a Wednesday; its week starts 2026-10-26

  it("uses the Monday of the week the date is in", () => {
    expect(toDateOnly(parseWeekParam("2026-11-04", now))).toBe("2026-11-02");
  });

  it("defaults to next week when there is no parameter", () => {
    expect(toDateOnly(parseWeekParam(undefined, now))).toBe("2026-11-02");
  });

  it("falls back to next week for an invalid or impossible date", () => {
    for (const value of ["next", "2026-13-01", "2026-02-31", ["2026-11-02"]]) {
      expect(toDateOnly(parseWeekParam(value, now))).toBe("2026-11-02");
    }
  });
});

describe("isoWeek", () => {
  it("numbers the weeks of the year", () => {
    expect(isoWeek(mondayOf(day("2026-10-26")))).toBe(44);
    expect(isoWeek(mondayOf(day("2026-01-05")))).toBe(2);
  });

  it("counts the week with 1 January's Thursday as week 1", () => {
    // 2026 begins on a Thursday, so it has 53 weeks; the last one runs from
    // 2026-12-28 to 2027-01-03, and 2027's week 1 starts on 2027-01-04.
    expect(isoWeek(mondayOf(day("2026-12-28")))).toBe(53);
    expect(isoWeek(mondayOf(day("2027-01-04")))).toBe(1);
  });
});
