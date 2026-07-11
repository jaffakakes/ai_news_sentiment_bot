export type MarketType = "spot" | "perp";

export type Interval = "1s" | "1m" | "5m" | "15m" | "1h";

export const INTERVAL_MS: Record<Interval, number> = {
  "1s": 1_000,
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "1h": 3_600_000,
};

/**
 * A single closed candle. Prices and volumes are decimal strings exactly as
 * returned by the exchange — they must never round-trip through `number`.
 */
export interface Candle {
  openTime: number; // epoch ms UTC
  closeTime: number; // epoch ms UTC
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string; // base-asset volume
  quoteVolume: string; // quote-asset volume
  trades: number;
}

export interface CandleQuery {
  symbol: string; // e.g. "BTCUSDT"
  interval: Interval;
  startTime: number; // epoch ms UTC, inclusive
  endTime: number; // epoch ms UTC, inclusive
}

/**
 * Result of a candle fetch. Candles are chronological and are only ever what
 * the exchange actually returned — gaps are reported, never filled in.
 */
export interface CandleResult {
  candles: Candle[];
  partial: boolean; // returned coverage < requested window
  actualStart: number | null; // openTime of first candle returned
  actualEnd: number | null; // closeTime of last candle returned
  note?: string; // honest explanation for missing/partial data
}

// ---------------------------------------------------------------------------
// Phase 4 seams — declared now so future order-flow features slot in without
// changing the provider contract.
// ---------------------------------------------------------------------------

export interface Trade {
  id: string;
  time: number;
  price: string;
  qty: string;
  isBuyerMaker: boolean;
}

export interface OrderBookSnapshot {
  time: number;
  bids: [price: string, qty: string][];
  asks: [price: string, qty: string][];
}

export interface MarketProvider {
  readonly exchange: string;
  readonly market: MarketType;
  supportsInterval(interval: Interval): boolean;
  getCandles(query: CandleQuery): Promise<CandleResult>;
  getTrades?(
    symbol: string,
    startTime: number,
    endTime: number,
  ): Promise<Trade[]>;
  getOrderBook?(symbol: string, depth: number): Promise<OrderBookSnapshot>;
}

export class MarketProviderError extends Error {
  constructor(
    public readonly code:
      | "INVALID_SYMBOL"
      | "UNSUPPORTED_INTERVAL"
      | "RATE_LIMITED"
      | "UPSTREAM_ERROR",
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "MarketProviderError";
  }
}
