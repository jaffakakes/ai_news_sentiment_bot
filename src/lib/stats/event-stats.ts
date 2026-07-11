import { D, Decimal, HUNDRED, ZERO } from "@/lib/sim/decimal";
import type { Candle, MarketType } from "@/lib/market/types";

const MINUTE_MS = 60_000;
const RETURN_HORIZONS = [1, 5, 15, 30, 60] as const;
export type ReturnHorizon = (typeof RETURN_HORIZONS)[number];

export interface EventStatsResult {
  symbol: string;
  exchange: string;
  market: MarketType;
  eventTime: number;
  priceBefore: string;
  priceAtEvent: string;
  highAfter: string;
  highAfterPct: string;
  timeToHighMs: number;
  lowAfter: string;
  lowAfterPct: string;
  timeToLowMs: number;
  returns: Record<`${ReturnHorizon}m`, string | null>;
  volumeBefore: string;
  volumeAfter: string;
  volumeChangePct: string | null;
  avgCandleRangePct: string;
  postEventVolatilityPct: string | null;
  candleCountBefore: number;
  candleCountAfter: number;
  dataComplete: boolean;
}

export class InsufficientDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientDataError";
  }
}

const pct = (value: Decimal, base: Decimal): Decimal =>
  value.minus(base).div(base).times(HUNDRED);

/**
 * Compute event statistics from 1m candles around an event timestamp.
 * Candles must be chronological, closed, and genuinely from the exchange —
 * missing horizons yield null, never interpolation.
 *
 * Anchors: priceBefore = close of the last candle fully before the event;
 * priceAtEvent = open of the candle containing the event; all % moves are
 * relative to priceAtEvent.
 */
export function computeEventStats(params: {
  candles: Candle[];
  eventTime: number;
  symbol: string;
  exchange: string;
  market: MarketType;
  dataComplete: boolean;
}): EventStatsResult {
  const { candles, eventTime, symbol, exchange, market, dataComplete } = params;

  const eventCandle = candles.find(
    (c) => c.openTime <= eventTime && eventTime <= c.closeTime,
  );
  if (!eventCandle) {
    throw new InsufficientDataError(
      "No candle contains the event timestamp — the market has no data at that moment.",
    );
  }

  const before = candles.filter((c) => c.closeTime <= eventTime);
  const after = candles.filter((c) => c.openTime >= eventTime);
  if (after.length === 0) {
    throw new InsufficientDataError(
      "No candles after the event — cannot compute post-event statistics.",
    );
  }

  const priceAtEvent = D(eventCandle.open);
  const lastBefore = before[before.length - 1];
  const priceBefore = lastBefore ? D(lastBefore.close) : priceAtEvent;

  // Post-event extremes and their timing.
  let highAfter = D(after[0]!.high);
  let highTime = after[0]!.openTime;
  let lowAfter = D(after[0]!.low);
  let lowTime = after[0]!.openTime;
  for (const c of after) {
    const high = D(c.high);
    const low = D(c.low);
    if (high.gt(highAfter)) {
      highAfter = high;
      highTime = c.openTime;
    }
    if (low.lt(lowAfter)) {
      lowAfter = low;
      lowTime = c.openTime;
    }
  }

  // Returns at fixed horizons: close of the candle containing event+Nm.
  const returns = {} as Record<`${ReturnHorizon}m`, string | null>;
  for (const horizon of RETURN_HORIZONS) {
    const target = eventTime + horizon * MINUTE_MS;
    const candle = candles.find(
      (c) => c.openTime <= target && target <= c.closeTime,
    );
    returns[`${horizon}m`] = candle
      ? pct(D(candle.close), priceAtEvent).toFixed(4)
      : null;
  }

  // Volume comparison over equal-length windows when possible.
  const sumQuoteVolume = (cs: Candle[]): Decimal =>
    cs.reduce((acc, c) => acc.plus(D(c.quoteVolume)), ZERO);
  const volumeBefore = sumQuoteVolume(before);
  const volumeAfter = sumQuoteVolume(after);
  const volumeChangePct = volumeBefore.isZero()
    ? null
    : volumeAfter.minus(volumeBefore).div(volumeBefore).times(HUNDRED);

  // Average candle range over the post window.
  const avgCandleRangePct = after
    .reduce((acc, c) => acc.plus(D(c.high).minus(D(c.low)).div(D(c.open))), ZERO)
    .div(after.length)
    .times(HUNDRED);

  // Post-event volatility: sample stddev of 1m simple returns, in %.
  let volatility: Decimal | null = null;
  if (after.length >= 3) {
    const rets: Decimal[] = [];
    for (let i = 1; i < after.length; i++) {
      const prev = D(after[i - 1]!.close);
      if (prev.isZero()) continue;
      rets.push(D(after[i]!.close).minus(prev).div(prev));
    }
    if (rets.length >= 2) {
      const mean = rets.reduce((a, r) => a.plus(r), ZERO).div(rets.length);
      const variance = rets
        .reduce((a, r) => a.plus(r.minus(mean).pow(2)), ZERO)
        .div(rets.length - 1);
      volatility = variance.sqrt().times(HUNDRED);
    }
  }

  return {
    symbol,
    exchange,
    market,
    eventTime,
    priceBefore: priceBefore.toString(),
    priceAtEvent: priceAtEvent.toString(),
    highAfter: highAfter.toString(),
    highAfterPct: pct(highAfter, priceAtEvent).toFixed(4),
    timeToHighMs: highTime - eventTime,
    lowAfter: lowAfter.toString(),
    lowAfterPct: pct(lowAfter, priceAtEvent).toFixed(4),
    timeToLowMs: lowTime - eventTime,
    returns,
    volumeBefore: volumeBefore.toFixed(8),
    volumeAfter: volumeAfter.toFixed(8),
    volumeChangePct: volumeChangePct ? volumeChangePct.toFixed(4) : null,
    avgCandleRangePct: avgCandleRangePct.toFixed(4),
    postEventVolatilityPct: volatility ? volatility.toFixed(4) : null,
    candleCountBefore: before.length,
    candleCountAfter: after.length,
    dataComplete,
  };
}
