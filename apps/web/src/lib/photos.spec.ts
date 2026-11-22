import { describe, expect, it } from "vitest";
import { fitWithin, MAX_PHOTO_BYTES, photoProblem } from "./photos";

describe("photoProblem", () => {
  const photo = (type: string, size = 1000) => ({ type, size });

  it.each(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"])(
    "accepts %s",
    (type) => {
      expect(photoProblem(photo(type))).toBeNull();
    },
  );

  it("refuses a file that isn't a photo", () => {
    expect(photoProblem(photo("application/pdf"))).toBe("wrongType");
    // Some browsers report no type at all for files they don't know.
    expect(photoProblem(photo(""))).toBe("wrongType");
  });

  it("accepts exactly 10 MB and refuses one byte more", () => {
    expect(photoProblem(photo("image/jpeg", MAX_PHOTO_BYTES))).toBeNull();
    expect(photoProblem(photo("image/jpeg", MAX_PHOTO_BYTES + 1))).toBe(
      "tooLarge",
    );
  });

  it("refuses an empty file", () => {
    expect(photoProblem(photo("image/jpeg", 0))).toBe("empty");
  });
});

describe("fitWithin", () => {
  it("scales a landscape photo down to the long side", () => {
    expect(fitWithin(4032, 3024, 2000)).toEqual({ width: 2000, height: 1500 });
  });

  it("scales a portrait photo by its height", () => {
    expect(fitWithin(3024, 4032, 2000)).toEqual({ width: 1500, height: 2000 });
  });

  it("rounds to whole pixels", () => {
    expect(fitWithin(3000, 1999, 2000)).toEqual({ width: 2000, height: 1333 });
  });

  it("leaves a photo that already fits alone", () => {
    expect(fitWithin(1200, 800, 2000)).toEqual({ width: 1200, height: 800 });
    expect(fitWithin(2000, 2000, 2000)).toEqual({ width: 2000, height: 2000 });
  });
});
