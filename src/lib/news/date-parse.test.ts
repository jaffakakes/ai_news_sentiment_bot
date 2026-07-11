import { describe, expect, it } from "vitest";
import { parsePublishedDate } from "./date-parse";

describe("parsePublishedDate", () => {
  it("ISO with Z is exact", () => {
    expect(parsePublishedDate("2024-01-10T21:00:00.000Z")).toEqual({
      epochMs: 1704920400000,
      precision: "exact",
    });
  });

  it("ISO with offset is exact and converts to UTC", () => {
    expect(parsePublishedDate("2024-01-10T16:00:00-05:00")).toEqual({
      epochMs: 1704920400000,
      precision: "exact",
    });
  });

  it("ISO datetime WITHOUT offset is treated as UTC, not server-local", () => {
    expect(parsePublishedDate("2024-01-10T21:00:00")).toEqual({
      epochMs: 1704920400000,
      precision: "exact",
    });
  });

  it("ISO date-only has day precision at UTC midnight", () => {
    expect(parsePublishedDate("2024-01-10")).toEqual({
      epochMs: 1704844800000,
      precision: "day",
    });
  });

  it("RFC 822 (RSS pubDate) is exact", () => {
    expect(parsePublishedDate("Wed, 10 Jan 2024 21:00:00 GMT")).toEqual({
      epochMs: 1704920400000,
      precision: "exact",
    });
  });

  it("Twitter oEmbed human date has day precision", () => {
    expect(parsePublishedDate("January 10, 2024")).toEqual({
      epochMs: 1704844800000,
      precision: "day",
    });
  });

  it("relative phrases and garbage return undefined", () => {
    expect(parsePublishedDate("2 hours ago")).toBeUndefined();
    expect(parsePublishedDate("yesterday")).toBeUndefined();
    expect(parsePublishedDate("not a date")).toBeUndefined();
    expect(parsePublishedDate("")).toBeUndefined();
    expect(parsePublishedDate(undefined)).toBeUndefined();
  });
});
