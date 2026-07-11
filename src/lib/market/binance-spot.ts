import "server-only";

import { binanceFetch, parseKlineRow } from "./binance-common";
import { cacheKey, getCached, setCached } from "./cache";
import { paginateKlines } from "./paginate";
import type { CandleQuery, CandleResult, MarketProvider } from "./types";

// data-api.binance.vision is Binance's official mirror for public market
// data — same /api/v3 shape, no auth, and available in regions where
// api.binance.com is geo-restricted.
const BASE_URL =
  process.env.BINANCE_SPOT_BASE_URL ?? "https://data-api.binance.vision";
const KLINES_WEIGHT = 2;

export class BinanceSpotProvider implements MarketProvider {
  readonly exchange = "binance";
  readonly market = "spot" as const;

  supportsInterval(): boolean {
    return true; // spot klines support 1s through 1h
  }

  async getCandles(query: CandleQuery): Promise<CandleResult> {
    const key = cacheKey({ ...query, exchange: this.exchange, market: this.market });
    const cached = getCached(key);
    if (cached) return cached;

    const result = await paginateKlines(query, async (startTime, endTime, limit) => {
      const url = `${BASE_URL}/api/v3/klines?symbol=${query.symbol}&interval=${query.interval}&startTime=${startTime}&endTime=${endTime}&limit=${limit}`;
      const rows = await binanceFetch<Parameters<typeof parseKlineRow>[0][]>(
        url,
        KLINES_WEIGHT,
      );
      return rows.map(parseKlineRow);
    });

    setCached(key, result, query.endTime);
    return result;
  }
}
