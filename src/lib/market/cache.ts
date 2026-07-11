import "server-only";

import type { CandleResult } from "./types";

/**
 * In-memory LRU+TTL cache for candle windows. Fully closed historical
 * windows are immutable so they get a long TTL; windows touching the present
 * expire quickly. Per-process only — acceptable for a single-user tool, and
 * degrades to a no-op cache on serverless.
 */
const MAX_ENTRIES = 200;
const CLOSED_WINDOW_TTL_MS = 24 * 60 * 60 * 1_000;
const LIVE_WINDOW_TTL_MS = 30 * 1_000;

interface CacheEntry {
  value: CandleResult;
  expiresAt: number;
}

const globalStore = globalThis as unknown as {
  __candleCache?: Map<string, CacheEntry>;
};

function store(): Map<string, CacheEntry> {
  if (!globalStore.__candleCache) {
    globalStore.__candleCache = new Map();
  }
  return globalStore.__candleCache;
}

export function cacheKey(parts: {
  exchange: string;
  market: string;
  symbol: string;
  interval: string;
  startTime: number;
  endTime: number;
}): string {
  return `${parts.exchange}:${parts.market}:${parts.symbol}:${parts.interval}:${parts.startTime}:${parts.endTime}`;
}

export function getCached(key: string): CandleResult | undefined {
  const map = store();
  const entry = map.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    map.delete(key);
    return undefined;
  }
  // LRU touch: re-insert to move to the end of Map iteration order.
  map.delete(key);
  map.set(key, entry);
  return entry.value;
}

export function setCached(
  key: string,
  value: CandleResult,
  windowEndTime: number,
): void {
  const map = store();
  const ttl =
    windowEndTime < Date.now() - 60_000
      ? CLOSED_WINDOW_TTL_MS
      : LIVE_WINDOW_TTL_MS;
  if (map.size >= MAX_ENTRIES) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
  map.set(key, { value, expiresAt: Date.now() + ttl });
}
