import { describe, expect, it } from "vitest";
import {
  addDays,
  DURATION_CHOICES,
  endFor,
  nextMonday,
  startFor,
  todayIn,
} from "./dates";

describe("todayIn", () => {
  it("uses the yard's date, not UTC's", () => {
    // 23:30 UTC on Sunday 25 October is already Monday in Germany (the clocks
    // went back that night, so Germany is UTC+1).
    expect(todayIn(new Date("2026-10-25T23:30:00Z"))).toBe("2026-10-26");
    expect(todayIn(new Date("2026-10-25T12:00:00Z"))).toBe("2026-10-25");
  });

  it("accepts another timezone", () => {
    expect(todayIn(new Date("2026-10-26T02:00:00Z"), "America/New_York")).toBe(
      "2026-10-25",
    );
  });
});

describe("addDays", () => {
  it("crosses month and year ends", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });

  it("goes back, and knows leap years", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
  });

  it("is not thrown off by the clocks changing", () => {
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
  });
});

describe("nextMonday", () => {
  it("gives the coming Monday for any other day", () => {
    expect(nextMonday("2026-10-27")).toBe("2026-11-02"); // Tuesday
    expect(nextMonday("2026-10-31")).toBe("2026-11-02"); // Saturday
    expect(nextMonday("2026-11-01")).toBe("2026-11-02"); // Sunday
  });

  it("gives the Monday a week later for a Monday", () => {
    expect(nextMonday("2026-10-26")).toBe("2026-11-02");
  });
});

describe("startFor", () => {
  const today = "2026-10-28"; // a Wednesday

  it("turns each quick choice into a date", () => {
    expect(startFor("TODAY", today)).toBe("2026-10-28");
    expect(startFor("TOMORROW", today)).toBe("2026-10-29");
    expect(startFor("NEXT_MONDAY", today)).toBe("2026-11-02");
  });
});

describe("endFor", () => {
  it("counts the first day, so one day ends the same day", () => {
    expect(endFor("2026-10-26", 1)).toBe("2026-10-26");
    expect(endFor("2026-10-26", 7)).toBe("2026-11-01"); // Monday to Sunday
  });

  it("matches every duration choice", () => {
    const ends = DURATION_CHOICES.map((d) => endFor("2026-10-26", d.days));
    expect(ends).toEqual([
      "2026-10-26",
      "2026-10-28",
      "2026-11-01",
      "2026-11-08",
      "2026-11-24",
    ]);
  });
});
