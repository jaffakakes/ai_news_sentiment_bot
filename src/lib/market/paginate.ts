import "server-only";

import { INTERVAL_MS, type Candle, type CandleQuery, type CandleResult } from "./types";

const PAGE_LIMIT = 1000;
const MAX_PAGES = 15;

/**
 * Page through a kline endpoint until the requested window is covered.
 * Never synthesizes candles: the result reports partial coverage honestly
 * (symbol not yet listed, exchange gaps, window in the future, …).
 */
export async function paginateKlines(
  query: CandleQuery,
  fetchPage: (
    startTime: number,
    endTime: number,
    limit: number,
  ) => Promise<Candle[]>,
): Promise<CandleResult> {
  const intervalMs = INTERVAL_MS[query.interval];
  const seen = new Set<number>();
  const candles: Candle[] = [];

  let cursor = query.startTime;
  for (let page = 0; page < MAX_PAGES && cursor <= query.endTime; page++) {
    const rows = await fetchPage(cursor, query.endTime, PAGE_LIMIT);
    for (const candle of rows) {
      if (!seen.has(candle.openTime) && candle.openTime <= query.endTime) {
        seen.add(candle.openTime);
        candles.push(candle);
      }
    }
    if (rows.length < PAGE_LIMIT) break; // exchange has no more data in window
    const last = rows[rows.length - 1];
    if (!last) break;
    cursor = last.closeTime + 1;
  }

  candles.sort((a, b) => a.openTime - b.openTime);

  // Drop a still-forming candle so downstream stats never see an unclosed bar.
  const now = Date.now();
  while (candles.length > 0 && candles[candles.length - 1]!.closeTime > now) {
    candles.pop();
  }

  const actualStart = candles[0]?.openTime ?? null;
  const actualEnd = candles[candles.length - 1]?.closeTime ?? null;

  let partial = false;
  let note: string | undefined;
  if (candles.length === 0) {
    partial = true;
    note =
      "No candles in the requested window — the symbol may not have traded on this market at that time.";
  } else {
    // Allow one interval of slack at each edge for boundary alignment.
    if (actualStart !== null && actualStart > query.startTime + intervalMs) {
      partial = true;
      note =
        "Data begins after the requested start — the symbol likely listed partway through the window.";
    }
    const expectedEnd = Math.min(query.endTime, now);
    if (actualEnd !== null && actualEnd < expectedEnd - intervalMs) {
      partial = true;
      note = note ?? "Data ends before the requested window end.";
    }
  }

  return { candles, partial, actualStart, actualEnd, note };
}
