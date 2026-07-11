import type { Candle } from "@/lib/market/types";

const MINUTE_MS = 60_000;

/**
 * Build a chronological 1m candle series from compact OHLC tuples for
 * deterministic engine tests. Volumes default to simple constants.
 */
export function candleSeries(
  startTime: number,
  bars: Array<{
    o: string;
    h: string;
    l: string;
    c: string;
    v?: string;
    qv?: string;
  }>,
): Candle[] {
  return bars.map((bar, i) => ({
    openTime: startTime + i * MINUTE_MS,
    closeTime: startTime + (i + 1) * MINUTE_MS - 1,
    open: bar.o,
    high: bar.h,
    low: bar.l,
    close: bar.c,
    volume: bar.v ?? "10",
    quoteVolume: bar.qv ?? "1000",
    trades: 100,
  }));
}

export const T0 = 1_700_000_000_000; // arbitrary fixed epoch anchor for tests
