import { describe, expect, it } from "vitest";
import { simulate, liquidationPrice, type SimulationInput } from "./engine";
import { D } from "./decimal";
import { candleSeries, T0 } from "@/test/synthetic-candles";

/**
 * Known-answer tests: every expectation is a hand-computed exact value
 * asserted as a string, proving the engine never drifts through floats.
 */

const baseInput: SimulationInput = {
  direction: "long",
  accountSize: "1000",
  margin: "100",
  leverage: "10",
  entryPrice: "100",
  entryTime: T0,
  takerFeePct: "0",
  makerFeePct: "0",
  slippagePct: "0",
  maintenanceMarginRatePct: "0.5",
};

// A calm series that never threatens SL/TP/liq: drift from 100 to 110.
const calmRise = candleSeries(T0, [
  { o: "100", h: "102", l: "99", c: "101" },
  { o: "101", h: "104", l: "100", c: "103" },
  { o: "103", h: "107", l: "102", c: "106" },
  { o: "106", h: "111", l: "105", c: "110" },
]);

describe("position sizing and gross PnL", () => {
  it("long 10x: margin 100 at 100 → 110 gains exactly 100 (100% ROM)", () => {
    const result = simulate(
      { ...baseInput, exitPrice: "110" },
      calmRise,
    );
    expect(result.positionSizeQuote).toBe("1000");
    expect(result.quantityBase).toBe("10");
    expect(result.grossPnl).toBe("100");
    expect(result.netPnl).toBe("100");
    expect(result.returnOnMarginPct).toBe("100");
    expect(result.returnOnAccountPct).toBe("10");
    expect(result.exitReason).toBe("manual_exit");
  });

  it("short 5x: 100 → 110 loses exactly 50 (10x would liquidate at ~109.45 first)", () => {
    const result = simulate(
      { ...baseInput, direction: "short", leverage: "5", exitPrice: "110" },
      calmRise,
    );
    expect(result.exitReason).toBe("manual_exit");
    // Q = 500/100 = 5; gross = 5 × (100 − 110) = −50
    expect(result.grossPnl).toBe("-50");
    expect(result.returnOnMarginPct).toBe("-50");
  });

  it("short 10x riding to 110 gets liquidated on the way (margin wiped)", () => {
    const result = simulate(
      { ...baseInput, direction: "short", exitPrice: "110" },
      calmRise,
    );
    expect(result.exitReason).toBe("liquidated");
    expect(result.netPnl).toBe("-100");
  });
});

describe("fees", () => {
  it("taker 0.05% both legs on the 100→110 long costs 1.05", () => {
    const result = simulate(
      { ...baseInput, exitPrice: "110", takerFeePct: "0.05" },
      calmRise,
    );
    // entry: 10 × 100 × 0.0005 = 0.5; exit: 10 × 110 × 0.0005 = 0.55
    expect(result.entryFee).toBe("0.5");
    expect(result.exitFee).toBe("0.55");
    expect(result.totalFees).toBe("1.05");
    expect(result.netPnl).toBe("98.95");
  });

  it("take-profit exits pay the maker fee, not taker", () => {
    const result = simulate(
      {
        ...baseInput,
        takeProfit: "110",
        takerFeePct: "0.05",
        makerFeePct: "0.02",
      },
      calmRise,
    );
    expect(result.exitReason).toBe("take_profit");
    // exit: 10 × 110 × 0.0002 = 0.22
    expect(result.exitFee).toBe("0.22");
  });
});

describe("slippage", () => {
  it("0.1% adverse slippage moves entry to 100.1 and manual exit to 109.89", () => {
    const result = simulate(
      { ...baseInput, exitPrice: "110", slippagePct: "0.1" },
      calmRise,
    );
    expect(result.effectiveEntryPrice).toBe("100.1");
    expect(result.effectiveExitPrice).toBe("109.89");
  });

  it("short slippage mirrors: entry 99.9, exit 110.11", () => {
    const result = simulate(
      {
        ...baseInput,
        direction: "short",
        leverage: "5", // keep liquidation (~119) out of the series range
        exitPrice: "110",
        slippagePct: "0.1",
      },
      calmRise,
    );
    expect(result.exitReason).toBe("manual_exit");
    expect(result.effectiveEntryPrice).toBe("99.9");
    expect(result.effectiveExitPrice).toBe("110.11");
  });

  it("take-profit fills get no slippage", () => {
    const result = simulate(
      { ...baseInput, takeProfit: "110", slippagePct: "0.1" },
      calmRise,
    );
    expect(result.effectiveExitPrice).toBe("110");
  });
});

describe("liquidation price estimate", () => {
  it("long 10x with mmr 0.5%: 100·0.9/0.995", () => {
    const liq = liquidationPrice("long", D("100"), D("10"), D("0.005"));
    expect(liq.toFixed(8)).toBe("90.45226131");
  });

  it("short 10x with mmr 0.5%: 100·1.1/1.005", () => {
    const liq = liquidationPrice("short", D("100"), D("10"), D("0.005"));
    expect(liq.toFixed(8)).toBe("109.45273632");
  });

  it("mmr 0 reduces to the naive 1/L distance: exactly 90 and 110", () => {
    expect(liquidationPrice("long", D("100"), D("10"), D("0")).toString()).toBe("90");
    expect(liquidationPrice("short", D("100"), D("10"), D("0")).toString()).toBe("110");
  });
});

describe("candle walk", () => {
  it("stop loss hit intrabar fills at the stop level", () => {
    const candles = candleSeries(T0, [
      { o: "100", h: "101", l: "99", c: "100" },
      { o: "100", h: "100.5", l: "94.5", c: "96" }, // dips through SL 95
      { o: "96", h: "99", l: "95.5", c: "98" },
    ]);
    const result = simulate({ ...baseInput, stopLoss: "95" }, candles);
    expect(result.exitReason).toBe("stop_loss");
    expect(result.effectiveExitPrice).toBe("95");
    expect(result.exitTime).toBe(T0 + 60_000);
    // gross = 10 × (95 − 100) = −50
    expect(result.grossPnl).toBe("-50");
    expect(result.ambiguousCandle).toBe(false);
  });

  it("take profit hit intrabar fills at the TP level", () => {
    const candles = candleSeries(T0, [
      { o: "100", h: "101", l: "99", c: "100" },
      { o: "100", h: "106", l: "99.5", c: "105" }, // spikes through TP 105
    ]);
    const result = simulate({ ...baseInput, takeProfit: "105" }, candles);
    expect(result.exitReason).toBe("take_profit");
    expect(result.grossPnl).toBe("50");
  });

  it("gap open through the stop fills at the open, not the stop", () => {
    const candles = candleSeries(T0, [
      { o: "100", h: "101", l: "99", c: "100" },
      { o: "92", h: "94", l: "91", c: "93" }, // gaps below SL 95
    ]);
    const result = simulate({ ...baseInput, stopLoss: "95" }, candles);
    expect(result.exitReason).toBe("stop_loss");
    expect(result.effectiveExitPrice).toBe("92"); // honest gap-through fill
    // gross = 10 × (92 − 100) = −80
    expect(result.grossPnl).toBe("-80");
  });

  it("TP and SL inside one candle resolves conservatively to SL and flags it", () => {
    const candles = candleSeries(T0, [
      { o: "100", h: "101", l: "99", c: "100" },
      { o: "100", h: "106", l: "94", c: "100" }, // range covers both levels
    ]);
    const result = simulate(
      { ...baseInput, stopLoss: "95", takeProfit: "105" },
      candles,
    );
    expect(result.exitReason).toBe("stop_loss");
    expect(result.ambiguousCandle).toBe(true);
  });

  it("liquidation touched before the stop wipes margin plus entry fee", () => {
    // liq for 10x/0.5% at entry 100 ≈ 90.45; candle low goes through it
    // while SL sits below liq, so liquidation resolves first.
    const candles = candleSeries(T0, [
      { o: "100", h: "101", l: "99", c: "100" },
      { o: "99", h: "100", l: "89", c: "90" },
    ]);
    const result = simulate(
      { ...baseInput, stopLoss: "88", takerFeePct: "0.05" },
      candles,
    );
    expect(result.exitReason).toBe("liquidated");
    expect(result.liquidationBreached).toBe(true);
    // entry fee = 10 × 100 × 0.0005 = 0.5 → net = −100 − 0.5
    expect(result.netPnl).toBe("-100.5");
    expect(result.returnOnMarginPct).toBe("-100.5");
  });

  it("nothing hit rides to window end at the last close", () => {
    const result = simulate(baseInput, calmRise);
    expect(result.exitReason).toBe("window_end");
    expect(result.effectiveExitPrice).toBe("110");
    expect(result.grossPnl).toBe("100");
  });

  it("short: stop loss sits above entry and triggers on the high side", () => {
    const candles = candleSeries(T0, [
      { o: "100", h: "101", l: "99", c: "100" },
      { o: "100", h: "107", l: "99", c: "106" }, // rallies through short SL 105
    ]);
    const result = simulate(
      { ...baseInput, direction: "short", stopLoss: "105" },
      candles,
    );
    expect(result.exitReason).toBe("stop_loss");
    // gross = 10 × (100 − 105) = −50
    expect(result.grossPnl).toBe("-50");
  });
});

describe("excursions (MFE / MAE)", () => {
  it("long MFE and MAE track the running extremes before exit", () => {
    const candles = candleSeries(T0, [
      { o: "100", h: "108", l: "97", c: "104" }, // high 108, low 97
      { o: "104", h: "105", l: "101", c: "102" },
    ]);
    const result = simulate(baseInput, candles);
    // MFE = (108−100)/100 = 8%; MAE = (100−97)/100 = 3%
    expect(result.maxFavorableExcursionPct).toBe("8");
    expect(result.maxAdverseExcursionPct).toBe("3");
    expect(result.maxFavorableExcursionQuote).toBe("80");
    expect(result.maxAdverseExcursionQuote).toBe("30");
  });

  it("short mirrors the extremes", () => {
    const candles = candleSeries(T0, [
      { o: "100", h: "108", l: "97", c: "104" },
    ]);
    const result = simulate({ ...baseInput, direction: "short" }, candles);
    // MFE = (100−97)/100 = 3%; MAE = (108−100)/100 = 8%
    expect(result.maxFavorableExcursionPct).toBe("3");
    expect(result.maxAdverseExcursionPct).toBe("8");
  });
});

describe("risk/reward", () => {
  it("RR = |TP−E| / |E−SL|", () => {
    const result = simulate(
      { ...baseInput, stopLoss: "95", takeProfit: "115" },
      calmRise,
    );
    expect(result.riskRewardRatio).toBe("3");
  });

  it("null when either level is missing", () => {
    const result = simulate({ ...baseInput, stopLoss: "95" }, calmRise);
    expect(result.riskRewardRatio).toBeNull();
  });
});

describe("decimal discipline", () => {
  it("float-trap prices (0.1 + 0.2 patterns) stay exact", () => {
    const candles = candleSeries(T0, [
      { o: "0.1", h: "0.35", l: "0.09", c: "0.3" },
    ]);
    const result = simulate(
      {
        ...baseInput,
        entryPrice: "0.1",
        exitPrice: "0.3",
        margin: "30",
        leverage: "1",
      },
      candles,
    );
    // Q = 30 / 0.1 = 300; gross = 300 × (0.3 − 0.1) = 60 — exactly.
    expect(result.quantityBase).toBe("300");
    expect(result.grossPnl).toBe("60");
    expect(result.netPnl).toBe("60");
  });
});
