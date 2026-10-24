import { describe, expect, it } from "vitest";
import { DEFAULT_API_URL, parseApiUrl } from "./api-url";

describe("parseApiUrl", () => {
  it("falls back to the local address when the setting is missing or blank", () => {
    expect(parseApiUrl(undefined)).toBe(DEFAULT_API_URL);
    expect(parseApiUrl("")).toBe(DEFAULT_API_URL);
    expect(parseApiUrl("   ")).toBe(DEFAULT_API_URL);
  });

  it("accepts http and https URLs", () => {
    expect(parseApiUrl("https://hullops.up.railway.app/graphql")).toBe(
      "https://hullops.up.railway.app/graphql",
    );
    expect(parseApiUrl("http://localhost:4000/graphql")).toBe(
      "http://localhost:4000/graphql",
    );
  });

  it("trims spaces around the value", () => {
    expect(parseApiUrl("  https://api.example.com/graphql \n")).toBe(
      "https://api.example.com/graphql",
    );
  });

  it("rejects a URL without https://, the mistake that broke the first deploy", () => {
    expect(() => parseApiUrl("hullops-production.up.railway.app/graphql")).toThrow(
      /API_URL must be a full URL/,
    );
  });

  it("rejects a host and port without a scheme", () => {
    expect(() => parseApiUrl("localhost:4000/graphql")).toThrow(
      /API_URL must be a full URL/,
    );
  });

  it("rejects other schemes", () => {
    expect(() => parseApiUrl("ftp://example.com/graphql")).toThrow(
      /API_URL must be a full URL/,
    );
  });

  it("names the value it rejected", () => {
    expect(() => parseApiUrl("nope")).toThrow('but it is "nope"');
  });
});
