import "server-only";

import { MarketProviderError, type Candle } from "./types";
import { acquireWeight, pauseOutbound, RateBudgetExceededError } from "./rate-limit";

/**
 * Raw Binance kline row (identical shape on spot and USDT-M futures):
 * [openTime, open, high, low, close, volume, closeTime, quoteVolume,
 *  trades, takerBuyBase, takerBuyQuote, ignore]
 */
type BinanceKlineRow = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
];

export function parseKlineRow(row: BinanceKlineRow): Candle {
  return {
    openTime: row[0],
    open: row[1],
    high: row[2],
    low: row[3],
    close: row[4],
    volume: row[5],
    closeTime: row[6],
    quoteVolume: row[7],
    trades: row[8],
  };
}

const MAX_RETRIES = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch a Binance endpoint with weight accounting, 429/418 backoff and error
 * mapping to MarketProviderError. Read-only market data endpoints only.
 */
export async function binanceFetch<T>(
  url: string,
  weight: number,
): Promise<T> {
  try {
    await acquireWeight(weight);
  } catch (err) {
    if (err instanceof RateBudgetExceededError) {
      throw new MarketProviderError(
        "RATE_LIMITED",
        "Market-data rate budget exhausted — retry shortly.",
        err.retryAfterSeconds,
      );
    }
    throw err;
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(1_000 * 2 ** (attempt - 1));

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Accept: "application/json" },
        // Historical data is immutable; our own cache layer handles reuse.
        cache: "no-store",
      });
    } catch (err) {
      lastError = err;
      continue; // network error → retry
    }

    if (response.status === 429 || response.status === 418) {
      const retryAfter = Number(response.headers.get("retry-after") ?? "5");
      pauseOutbound(retryAfter);
      if (attempt < MAX_RETRIES) {
        await sleep(retryAfter * 1_000);
        continue;
      }
      throw new MarketProviderError(
        "RATE_LIMITED",
        "Binance rate limit hit — retry shortly.",
        retryAfter,
      );
    }

    if (response.status >= 500) {
      lastError = new Error(`Binance HTTP ${response.status}`);
      continue;
    }

    if (response.status === 451) {
      throw new MarketProviderError(
        "UPSTREAM_ERROR",
        "Binance rejected the request as geo-restricted (HTTP 451) from this server's location. Set BINANCE_SPOT_BASE_URL / BINANCE_FUTURES_BASE_URL or run the app from an unrestricted network.",
      );
    }

    if (!response.ok) {
      let code: number | undefined;
      let msg = `Binance HTTP ${response.status}`;
      try {
        const body = (await response.json()) as { code?: number; msg?: string };
        code = body.code;
        if (body.msg) msg = body.msg;
      } catch {
        // non-JSON error body; keep the HTTP status message
      }
      if (code === -1121) {
        throw new MarketProviderError(
          "INVALID_SYMBOL",
          "Symbol not found on this Binance market — check the ticker and market type.",
        );
      }
      throw new MarketProviderError("UPSTREAM_ERROR", msg);
    }

    return (await response.json()) as T;
  }

  throw new MarketProviderError(
    "UPSTREAM_ERROR",
    `Binance request failed after ${MAX_RETRIES + 1} attempts: ${String(lastError)}`,
  );
}
