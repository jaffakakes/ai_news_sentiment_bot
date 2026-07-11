import type { DatePrecision } from "./types";

export interface ParsedDate {
  epochMs: number;
  precision: DatePrecision;
}

/**
 * Parse a publication date string into UTC epoch ms with honest precision.
 * Accepted: ISO 8601 with time (exact), ISO date-only (day precision, UTC
 * midnight), RFC 822/1123 (RSS style, exact). Relative phrases ("2 hours
 * ago") and anything else return undefined — a timestamp is never invented.
 */
export function parsePublishedDate(raw: string | undefined | null): ParsedDate | undefined {
  if (!raw) return undefined;
  const value = raw.trim();
  if (!value) return undefined;

  // ISO date-only: 2024-01-10
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const ms = Date.parse(`${value}T00:00:00Z`);
    return Number.isNaN(ms) ? undefined : { epochMs: ms, precision: "day" };
  }

  // ISO 8601 with a time component. Date.parse treats a missing offset as
  // LOCAL time, which would silently shift the event — require Z or ±hh:mm.
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value)) {
    const hasOffset = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
    const normalized = hasOffset ? value.replace(" ", "T") : `${value.replace(" ", "T")}Z`;
    const ms = Date.parse(normalized);
    return Number.isNaN(ms) ? undefined : { epochMs: ms, precision: "exact" };
  }

  // RFC 822/1123: "Wed, 10 Jan 2024 21:00:00 GMT" (RSS pubDate).
  if (/^\w{3},\s+\d{1,2}\s+\w{3}\s+\d{4}/.test(value)) {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? undefined : { epochMs: ms, precision: "exact" };
  }

  // Human day format from Twitter oEmbed: "January 10, 2024".
  const human = value.match(/^(\w+)\s+(\d{1,2}),\s+(\d{4})$/);
  if (human) {
    const ms = Date.parse(`${human[1]} ${human[2]}, ${human[3]} 00:00:00 UTC`);
    return Number.isNaN(ms) ? undefined : { epochMs: ms, precision: "day" };
  }

  return undefined;
}
