import "server-only";

import { binanceFetch, parseKlineRow } from "./binance-common";
import { cacheKey, getCached, setCached } from "./cache";
import { paginateKlines } from "./paginate";
import {
  MarketProviderError,
  type CandleQuery,
  type CandleResult,
  type Interval,
  type MarketProvider,
} from "./types";

const BASE_URL =
  process.env.BINANCE_FUTURES_BASE_URL ?? "https://fapi.binance.com";
// Futures kline weight scales with limit; 5 covers our max page of 1000.
const KLINES_WEIGHT = 5;

export class BinanceFuturesProvider implements MarketProvider {
  readonly exchange = "binance";
  readonly market = "perp" as const;

  supportsInterval(interval: Interval): boolean {
    return interval !== "1s"; // USDT-M futures klines start at 1m
  }

  async getCandles(query: CandleQuery): Promise<CandleResult> {
    if (!this.supportsInterval(query.interval)) {
      throw new MarketProviderError(
        "UNSUPPORTED_INTERVAL",
        "Binance futures klines start at 1m — the 1s timeframe is spot-only.",
      );
    }

    const key = cacheKey({ ...query, exchange: this.exchange, market: this.market });
    const cached = getCached(key);
    if (cached) return cached;

    const result = await paginateKlines(query, async (startTime, endTime, limit) => {
      const url = `${BASE_URL}/fapi/v1/klines?symbol=${query.symbol}&interval=${query.interval}&startTime=${startTime}&endTime=${endTime}&limit=${limit}`;
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
