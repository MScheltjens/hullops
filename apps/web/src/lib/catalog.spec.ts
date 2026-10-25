import { describe, expect, it } from "vitest";
import { CLEANING_METHODS, isOneOf, titleFrom } from "./catalog";

describe("isOneOf", () => {
  it("recognises a code from the list", () => {
    expect(isOneOf(CLEANING_METHODS, "MANUAL")).toBe(true);
  });

  it("does not recognise text someone typed", () => {
    expect(isOneOf(CLEANING_METHODS, "Dry ice")).toBe(false);
    expect(isOneOf(CLEANING_METHODS, "manual")).toBe(false);
  });
});

describe("titleFrom", () => {
  it("joins the parts with a colon", () => {
    expect(titleFrom(["High-pressure water", "Hull"])).toBe(
      "High-pressure water: Hull",
    );
  });

  it("leaves out empty parts", () => {
    expect(titleFrom(["Enclosure", "  "])).toBe("Enclosure");
    expect(titleFrom([])).toBe("");
  });
});
