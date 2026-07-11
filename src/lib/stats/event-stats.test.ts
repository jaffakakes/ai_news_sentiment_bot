import { describe, expect, it } from "vitest";
import { computeEventStats, InsufficientDataError } from "./event-stats";
import { candleSeries, T0 } from "@/test/synthetic-candles";
import type { Candle } from "@/lib/market/types";
import btcFixture from "@/test/fixtures/btc-event-1m.json";

const MINUTE_MS = 60_000;

describe("computeEventStats — synthetic spike", () => {
  // Event lands at the open of the third candle (index 2).
  const eventTime = T0 + 2 * MINUTE_MS;
  const candles = candleSeries(T0, [
    { o: "100", h: "100.5", l: "99.5", c: "100", qv: "1000" }, // before
    { o: "100", h: "100.4", l: "99.6", c: "99.8", qv: "1000" }, // before
    { o: "100", h: "108", l: "99", c: "106", qv: "5000" }, // event candle
    { o: "106", h: "112", l: "105", c: "110", qv: "4000" }, // +1m..+2m
    { o: "110", h: "111", l: "104", c: "105", qv: "3000" },
    { o: "105", h: "106", l: "98", c: "99", qv: "2000" },
    { o: "99", h: "101", l: "97", c: "100", qv: "1500" }, // low 97
  ]);

  const stats = computeEventStats({
    candles,
    eventTime,
    symbol: "TESTUSDT",
    exchange: "binance",
    market: "spot",
    dataComplete: true,
  });

  it("anchors priceBefore to the last close before the event", () => {
    expect(stats.priceBefore).toBe("99.8");
    expect(stats.priceAtEvent).toBe("100");
  });

  it("finds post-event extremes and their timing", () => {
    expect(stats.highAfter).toBe("112");
    expect(stats.highAfterPct).toBe("12.0000");
    expect(stats.timeToHighMs).toBe(1 * MINUTE_MS);
    expect(stats.lowAfter).toBe("97");
    expect(stats.lowAfterPct).toBe("-3.0000");
    expect(stats.timeToLowMs).toBe(4 * MINUTE_MS);
  });

  it("computes fixed-horizon returns off candle closes", () => {
    // +1m target falls in candle index 3 (close 110): (110−100)/100 = 10%
    expect(stats.returns["1m"]).toBe("10.0000");
    // +5m target falls beyond the last candle? last candle covers +4m..+5m−1ms
    // openTime index 6 = T0+6m = event+4m, closes at event+5m−1ms → contains +4m only.
    // +5m timestamp = event+5m is 1ms past the last close → null (honest gap).
    expect(stats.returns["5m"]).toBeNull();
    expect(stats.returns["60m"]).toBeNull();
  });

  it("compares volume windows", () => {
    expect(stats.volumeBefore).toBe("2000.00000000");
    expect(stats.volumeAfter).toBe("15500.00000000");
    // (15500−2000)/2000 × 100 = 675%
    expect(stats.volumeChangePct).toBe("675.0000");
  });

  it("counts candles on both sides", () => {
    expect(stats.candleCountBefore).toBe(2);
    expect(stats.candleCountAfter).toBe(5);
  });
});

describe("computeEventStats — edge cases", () => {
  it("throws when no candle contains the event", () => {
    const candles = candleSeries(T0, [
      { o: "100", h: "101", l: "99", c: "100" },
    ]);
    expect(() =>
      computeEventStats({
        candles,
        eventTime: T0 + 10 * MINUTE_MS,
        symbol: "X",
        exchange: "binance",
        market: "spot",
        dataComplete: true,
      }),
    ).toThrow(InsufficientDataError);
  });

  it("volatility is null with fewer than 3 post candles", () => {
    const candles = candleSeries(T0, [
      { o: "100", h: "101", l: "99", c: "100" },
      { o: "100", h: "101", l: "99", c: "101" },
    ]);
    const stats = computeEventStats({
      candles,
      eventTime: T0,
      symbol: "X",
      exchange: "binance",
      market: "spot",
      dataComplete: true,
    });
    expect(stats.postEventVolatilityPct).toBeNull();
  });

  it("hand-computed volatility: closes 100, 101, 99.99, 101.0 post-event", () => {
    // returns: 0.01, −0.01, 0.0101010101...
    const candles = candleSeries(T0, [
      { o: "100", h: "101", l: "99", c: "100" },
      { o: "100", h: "102", l: "99", c: "101" },
      { o: "101", h: "102", l: "99", c: "99.99" },
      { o: "99.99", h: "102", l: "99", c: "101" },
    ]);
    const stats = computeEventStats({
      candles,
      eventTime: T0,
      symbol: "X",
      exchange: "binance",
      market: "spot",
      dataComplete: true,
    });
    // r1 = 1/100 = 0.01
    // r2 = (99.99−101)/101 = −0.01
    // r3 = (101−99.99)/99.99 ≈ 0.0101010
    // mean ≈ 0.0033670, sample stddev ≈ 0.01157627 → 1.1576%
    // (verified independently with decimal.js at precision 40)
    expect(stats.postEventVolatilityPct).toBe("1.1576");
  });
});

describe("computeEventStats — real BTC ETF approval fixture", () => {
  const fixture = btcFixture as {
    eventTime: number;
    candles: Candle[];
  };

  const stats = computeEventStats({
    candles: fixture.candles,
    eventTime: fixture.eventTime,
    symbol: "BTCUSDT",
    exchange: "binance",
    market: "spot",
    dataComplete: true,
  });

  it("matches the values the live API returned for the same window", () => {
    expect(stats.priceAtEvent).toBe("46127");
    expect(stats.highAfter).toBe("46948.98");
    expect(stats.highAfterPct).toBe("1.7820");
    expect(stats.lowAfterPct).toBe("-2.2698");
    expect(stats.returns["60m"]).toBe("-0.2558");
    expect(stats.volumeChangePct).toBe("40.2215");
    expect(stats.candleCountBefore).toBe(60);
    expect(stats.candleCountAfter).toBe(121);
  });
});
