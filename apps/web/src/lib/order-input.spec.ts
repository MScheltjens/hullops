import { describe, expect, it } from "vitest";
import { buildCreateOrderInput } from "./order-input";

/** Builds a FormData from [name, value] pairs, like a submitted form. */
function form(entries: [string, string][]): FormData {
  const formData = new FormData();
  for (const [name, value] of entries) formData.append(name, value);
  return formData;
}

describe("buildCreateOrderInput", () => {
  // The pattern for every test: arrange (a form), act (call the function),
  // assert (check one thing about the result).
  it("trims text fields", () => {
    const input = buildCreateOrderInput(form([["title", "  Foo "]]));

    expect(input.title).toBe("Foo");
  });

  it("turns an empty text field into undefined", () => {
    // An empty input is submitted as "", but the API wants "not provided".
    const input = buildCreateOrderInput(form([["berth", ""]]));

    expect(input.berth).toBeUndefined();
  });

  it("turns a number field into a number", () => {
    const input = buildCreateOrderInput(form([["areaSqm", "42.5"]]));

    expect(input.areaSqm).toBe(42.5);
  });

  it("turns a date into noon UTC", () => {
    const input = buildCreateOrderInput(
      form([
        ["startDate", "2026-11-01"],
        ["dueDate", "2026-11-10"],
      ]),
    );

    expect(input.startDate).toBe("2026-11-01T12:00:00.000Z");
    expect(input.dueDate).toBe("2026-11-10T12:00:00.000Z");
  });

  it("sends cleaning details, and no protection details, for a cleaning order", () => {
    // A stale "kind" must not leak through: the API rejects mismatched details.
    const input = buildCreateOrderInput(
      form([
        ["serviceType", "CLEANING"],
        ["method", "high-pressure"],
        ["surface", "hull"],
        ["kind", "ENCLOSURE"],
      ]),
    );

    expect(input.cleaning).toEqual({ method: "high-pressure", surface: "hull" });
    expect(input.protection).toBeUndefined();
  });

  it("sends protection details, and no cleaning details, for a protection order", () => {
    const input = buildCreateOrderInput(
      form([
        ["serviceType", "PROTECTION"],
        ["kind", "ENCLOSURE"],
        ["protectedItem", "main engine"],
        ["method", "high-pressure"],
      ]),
    );

    expect(input.protection).toMatchObject({
      kind: "ENCLOSURE",
      protectedItem: "main engine",
    });
    expect(input.cleaning).toBeUndefined();
  });

  it("leaves out coating fields when the kind is not COATING", () => {
    const input = buildCreateOrderInput(
      form([
        ["serviceType", "PROTECTION"],
        ["kind", "ENCLOSURE"],
        ["coatingProduct", "Epoxy"],
        ["layers", "2"],
        ["targetThicknessUm", "300"],
      ]),
    );

    expect(input.protection).not.toHaveProperty("coatingProduct");
    expect(input.protection).not.toHaveProperty("layers");
    expect(input.protection).not.toHaveProperty("targetThicknessUm");
  });

  it("includes coating fields when the kind is COATING", () => {
    const input = buildCreateOrderInput(
      form([
        ["serviceType", "PROTECTION"],
        ["kind", "COATING"],
        ["coatingProduct", "Epoxy"],
        ["layers", "2"],
        ["targetThicknessUm", "300"],
      ]),
    );

    expect(input.protection).toMatchObject({
      coatingProduct: "Epoxy",
      layers: 2,
      targetThicknessUm: 300,
    });
  });

  it("collects every checked material into a list", () => {
    // Checked boxes share one name, so FormData holds several values for it.
    const input = buildCreateOrderInput(
      form([
        ["serviceType", "PROTECTION"],
        ["kind", "COVERING"],
        ["materials", "OSB_STANDARD"],
        ["materials", "PROPLEX_HD"],
      ]),
    );

    expect(input.protection?.materials).toEqual(["OSB_STANDARD", "PROPLEX_HD"]);
  });
});
