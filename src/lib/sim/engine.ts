import { D, Decimal, HUNDRED, ZERO } from "./decimal";
import type { Candle } from "@/lib/market/types";

/**
 * Hypothetical leveraged-futures trade simulator. Pure functions over
 * decimal arithmetic — this module NEVER executes trades; it only replays
 * a hypothetical position against historical candles.
 *
 * Formula reference (long side; short mirrors every comparison):
 *   E_eff  = E·(1+s)                     adverse entry slippage
 *   X_eff  = X·(1−s)                     adverse exit slippage (not on TP)
 *   N      = margin·leverage             notional (quote)
 *   Q      = N / E_eff                   quantity (base)
 *   P_liq  = E_eff·(1 − 1/L)/(1 − mmr)   isolated-margin estimate
 *   gross  = Q·(X_eff − E_eff)
 *   fees   = Q·E_eff·f_entry + Q·X_eff·f_exit
 *
 * The liquidation price is an ESTIMATE: real Binance liquidation uses
 * tiered maintenance-margin brackets by notional, mark price rather than
 * last price, and deducts a liquidation fee. The flat-rate approximation
 * is typically accurate for small notionals.
 */

export type Direction = "long" | "short";

export type ExitReason =
  | "take_profit"
  | "stop_loss"
  | "manual_exit"
  | "liquidated"
  | "window_end";

export interface SimulationInput {
  direction: Direction;
  accountSize: string;
  margin: string;
  leverage: string;
  entryPrice: string;
  entryTime: number; // epoch ms UTC — anchors the candle walk
  exitPrice?: string;
  stopLoss?: string;
  takeProfit?: string;
  takerFeePct: string; // e.g. "0.05" = 0.05%
  makerFeePct: string;
  slippagePct: string;
  maintenanceMarginRatePct: string; // e.g. "0.5"
}

export interface SimulationResult {
  effectiveEntryPrice: string;
  effectiveExitPrice: string;
  positionSizeQuote: string;
  quantityBase: string;
  liquidationPrice: string;
  exitReason: ExitReason;
  exitTime: number | null;
  timeInTradeMs: number | null;
  ambiguousCandle: boolean;
  grossPnl: string;
  entryFee: string;
  exitFee: string;
  totalFees: string;
  netPnl: string;
  returnOnMarginPct: string;
  returnOnAccountPct: string;
  riskRewardRatio: string | null;
  maxFavorableExcursionPct: string;
  maxAdverseExcursionPct: string;
  maxFavorableExcursionQuote: string;
  maxAdverseExcursionQuote: string;
  liquidationBreached: boolean;
}

export class SimulationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SimulationError";
  }
}

const pctToFraction = (p: string): Decimal => D(p).div(HUNDRED);

export function liquidationPrice(
  direction: Direction,
  effectiveEntry: Decimal,
  leverage: Decimal,
  mmr: Decimal,
): Decimal {
  const inverseLeverage = D(1).div(leverage);
  return direction === "long"
    ? effectiveEntry.times(D(1).minus(inverseLeverage)).div(D(1).minus(mmr))
    : effectiveEntry.times(D(1).plus(inverseLeverage)).div(D(1).plus(mmr));
}

interface WalkOutcome {
  exitReason: ExitReason;
  rawExitPrice: Decimal; // pre-slippage exit level
  exitCandle: Candle;
  ambiguousCandle: boolean;
  runHigh: Decimal;
  runLow: Decimal;
  liquidationBreached: boolean;
}

/**
 * Walk candles chronologically resolving liquidation / SL / TP / manual
 * exit. Where OHLC cannot reveal intra-candle order (both TP and an
 * adverse level inside one bar) the CONSERVATIVE outcome is chosen and
 * the candle flagged ambiguous.
 */
function walkCandles(params: {
  direction: Direction;
  candles: Candle[];
  entryTime: number;
  liqPrice: Decimal;
  stopLoss?: Decimal;
  takeProfit?: Decimal;
  manualExit?: Decimal;
}): WalkOutcome {
  const { direction, candles, entryTime, liqPrice, stopLoss, takeProfit, manualExit } =
    params;
  const long = direction === "long";

  const walked = candles.filter((c) => c.closeTime >= entryTime);
  if (walked.length === 0) {
    throw new SimulationError(
      "No candles at or after the entry time — cannot simulate this trade.",
    );
  }

  // "Adverse" means against the position (low side for longs, high side
  // for shorts); comparisons flip via these helpers.
  const adverseHit = (price: Decimal, level: Decimal) =>
    long ? price.lte(level) : price.gte(level);
  const favorableHit = (price: Decimal, level: Decimal) =>
    long ? price.gte(level) : price.lte(level);

  let runHigh = D(walked[0]!.high);
  let runLow = D(walked[0]!.low);
  let liquidationBreached = false;

  const finish = (
    reason: ExitReason,
    rawExitPrice: Decimal,
    candle: Candle,
    ambiguous: boolean,
  ): WalkOutcome => ({
    exitReason: reason,
    rawExitPrice,
    exitCandle: candle,
    ambiguousCandle: ambiguous,
    runHigh,
    runLow,
    liquidationBreached: liquidationBreached || reason === "liquidated",
  });

  for (const candle of walked) {
    const open = D(candle.open);
    const high = D(candle.high);
    const low = D(candle.low);
    runHigh = Decimal.max(runHigh, high);
    runLow = Decimal.min(runLow, low);

    // 1. Gap check at the open: fills happen at the open price (worse than
    //    the level for SL — an honest gap-through fill). Liquidation always
    //    fills at the liq price since the position is force-closed there.
    if (adverseHit(open, liqPrice)) {
      return finish("liquidated", liqPrice, candle, false);
    }
    if (stopLoss && adverseHit(open, stopLoss)) {
      return finish("stop_loss", open, candle, false);
    }
    if (takeProfit && favorableHit(open, takeProfit)) {
      return finish("take_profit", open, candle, false);
    }

    // 2. Intrabar: OHLC cannot order intra-candle touches, so when both an
    //    adverse and a favorable level sit inside one bar, assume the
    //    adverse one hit first (conservative) and flag it.
    const adverseExtreme = long ? low : high;
    const favorableExtreme = long ? high : low;
    const hitLiq = adverseHit(adverseExtreme, liqPrice);
    const hitSL = stopLoss !== undefined && adverseHit(adverseExtreme, stopLoss);
    const hitTP =
      takeProfit !== undefined && favorableHit(favorableExtreme, takeProfit);

    if (hitLiq) {
      return finish("liquidated", liqPrice, candle, hitTP);
    }
    if (hitSL) {
      return finish("stop_loss", stopLoss, candle, hitTP);
    }
    if (hitTP) {
      return finish("take_profit", takeProfit, candle, false);
    }

    // 3. Manual exit level, checked after protective levels.
    if (manualExit && manualExit.gte(low) && manualExit.lte(high)) {
      return finish("manual_exit", manualExit, candle, false);
    }
  }

  const last = walked[walked.length - 1]!;
  return finish("window_end", D(last.close), last, false);
}

export function simulate(
  input: SimulationInput,
  candles: Candle[],
): SimulationResult {
  const long = input.direction === "long";
  const margin = D(input.margin);
  const accountSize = D(input.accountSize);
  const leverage = D(input.leverage);
  const entry = D(input.entryPrice);
  const takerFee = pctToFraction(input.takerFeePct);
  const makerFee = pctToFraction(input.makerFeePct);
  const slippage = pctToFraction(input.slippagePct);
  const mmr = pctToFraction(input.maintenanceMarginRatePct);

  if (margin.lte(0) || leverage.lt(1) || entry.lte(0)) {
    throw new SimulationError(
      "Margin and entry price must be positive; leverage must be at least 1.",
    );
  }
  if (!input.exitPrice && !input.stopLoss && !input.takeProfit) {
    // Legal: the trade simply rides to the end of the window.
  }

  // Entry with adverse slippage.
  const effectiveEntry = long
    ? entry.times(D(1).plus(slippage))
    : entry.times(D(1).minus(slippage));

  const notional = margin.times(leverage);
  const quantity = notional.div(effectiveEntry);
  const liqPrice = liquidationPrice(input.direction, effectiveEntry, leverage, mmr);

  const outcome = walkCandles({
    direction: input.direction,
    candles,
    entryTime: input.entryTime,
    liqPrice,
    stopLoss: input.stopLoss !== undefined ? D(input.stopLoss) : undefined,
    takeProfit: input.takeProfit !== undefined ? D(input.takeProfit) : undefined,
    manualExit: input.exitPrice !== undefined ? D(input.exitPrice) : undefined,
  });

  // Exit slippage: TP is a resting limit order (no slippage); everything
  // else crosses the book adversely. Liquidation fills at the liq price.
  let effectiveExit: Decimal;
  if (outcome.exitReason === "take_profit" || outcome.exitReason === "liquidated") {
    effectiveExit = outcome.rawExitPrice;
  } else {
    effectiveExit = long
      ? outcome.rawExitPrice.times(D(1).minus(slippage))
      : outcome.rawExitPrice.times(D(1).plus(slippage));
  }

  const entryFee = quantity.times(effectiveEntry).times(takerFee);
  const exitFeeRate = outcome.exitReason === "take_profit" ? makerFee : takerFee;

  let grossPnl: Decimal;
  let exitFee: Decimal;
  let netPnl: Decimal;
  if (outcome.exitReason === "liquidated") {
    // Margin is wiped; the exchange's liquidation process absorbs the rest.
    grossPnl = long
      ? quantity.times(effectiveExit.minus(effectiveEntry))
      : quantity.times(effectiveEntry.minus(effectiveExit));
    exitFee = ZERO;
    netPnl = margin.neg().minus(entryFee);
  } else {
    grossPnl = long
      ? quantity.times(effectiveExit.minus(effectiveEntry))
      : quantity.times(effectiveEntry.minus(effectiveExit));
    exitFee = quantity.times(effectiveExit).times(exitFeeRate);
    netPnl = grossPnl.minus(entryFee).minus(exitFee);
  }

  const totalFees = entryFee.plus(exitFee);

  // Risk/reward from raw price levels, ex-fees.
  let riskReward: Decimal | null = null;
  if (input.stopLoss !== undefined && input.takeProfit !== undefined) {
    const risk = entry.minus(D(input.stopLoss)).abs();
    riskReward = risk.isZero()
      ? null
      : D(input.takeProfit).minus(entry).abs().div(risk);
  }

  // Excursions vs effective entry, floored at zero.
  const favorableExtreme = long ? outcome.runHigh : outcome.runLow;
  const adverseExtreme = long ? outcome.runLow : outcome.runHigh;
  const mfeQuote = Decimal.max(
    ZERO,
    long
      ? quantity.times(favorableExtreme.minus(effectiveEntry))
      : quantity.times(effectiveEntry.minus(favorableExtreme)),
  );
  const maeQuote = Decimal.max(
    ZERO,
    long
      ? quantity.times(effectiveEntry.minus(adverseExtreme))
      : quantity.times(adverseExtreme.minus(effectiveEntry)),
  );
  const mfePct = Decimal.max(
    ZERO,
    long
      ? favorableExtreme.minus(effectiveEntry).div(effectiveEntry).times(HUNDRED)
      : effectiveEntry.minus(favorableExtreme).div(effectiveEntry).times(HUNDRED),
  );
  const maePct = Decimal.max(
    ZERO,
    long
      ? effectiveEntry.minus(adverseExtreme).div(effectiveEntry).times(HUNDRED)
      : adverseExtreme.minus(effectiveEntry).div(effectiveEntry).times(HUNDRED),
  );

  const exitTime = outcome.exitCandle.openTime;
  const timeInTrade =
    outcome.exitReason === "window_end"
      ? outcome.exitCandle.closeTime - input.entryTime
      : Math.max(0, exitTime - input.entryTime);

  return {
    effectiveEntryPrice: effectiveEntry.toString(),
    effectiveExitPrice: effectiveExit.toString(),
    positionSizeQuote: notional.toString(),
    quantityBase: quantity.toString(),
    liquidationPrice: liqPrice.toString(),
    exitReason: outcome.exitReason,
    exitTime,
    timeInTradeMs: timeInTrade,
    ambiguousCandle: outcome.ambiguousCandle,
    grossPnl: grossPnl.toString(),
    entryFee: entryFee.toString(),
    exitFee: exitFee.toString(),
    totalFees: totalFees.toString(),
    netPnl: netPnl.toString(),
    returnOnMarginPct: netPnl.div(margin).times(HUNDRED).toString(),
    returnOnAccountPct: accountSize.isZero()
      ? "0"
      : netPnl.div(accountSize).times(HUNDRED).toString(),
    riskRewardRatio: riskReward ? riskReward.toString() : null,
    maxFavorableExcursionPct: mfePct.toString(),
    maxAdverseExcursionPct: maePct.toString(),
    maxFavorableExcursionQuote: mfeQuote.toString(),
    maxAdverseExcursionQuote: maeQuote.toString(),
    liquidationBreached: outcome.liquidationBreached,
  };
}
