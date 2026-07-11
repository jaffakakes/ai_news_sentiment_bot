import { describe, expect, it } from "vitest";
import { detectTickers } from "./detect";
import type { SymbolIndex } from "./exchange-symbols";

const index: SymbolIndex = {
  bases: new Set(["BTC", "ETH", "SOL", "PEPE", "ONE", "AI", "DOGE", "NOPAIR"]),
  usdtPair: new Map([
    ["BTC", "BTCUSDT"],
    ["ETH", "ETHUSDT"],
    ["SOL", "SOLUSDT"],
    ["PEPE", "PEPEUSDT"],
    ["ONE", "ONEUSDT"],
    ["AI", "AIUSDT"],
    ["DOGE", "DOGEUSDT"],
    // NOPAIR intentionally has no USDT pair
  ]),
  perpSymbols: new Set(["BTCUSDT", "SOLUSDT"]),
};

describe("detectTickers", () => {
  it("cashtags rank highest", () => {
    const result = detectTickers("Binance lists $PEPE for spot trading", undefined, index);
    expect(result[0]).toMatchObject({
      symbol: "PEPEUSDT",
      baseAsset: "PEPE",
      confidence: 0.95,
      matchedBy: "cashtag",
      matchedText: "$PEPE",
    });
  });

  it("full names in the headline match case-insensitively", () => {
    const result = detectTickers("Solana ETF decision due this week", undefined, index);
    expect(result[0]).toMatchObject({ symbol: "SOLUSDT", matchedBy: "name-headline", confidence: 0.8 });
  });

  it("bare uppercase symbols match in original casing only", () => {
    expect(detectTickers("SOL breaks resistance", undefined, index)[0]?.symbol).toBe("SOLUSDT");
    expect(detectTickers("Sol invictus festival announced", undefined, index)).toEqual([]);
  });

  it("stoplisted bases need corroboration: 'ONE more reason' is not Harmony", () => {
    expect(detectTickers("ONE more reason markets rallied", undefined, index)).toEqual([]);
    // …but a cashtag corroborates it:
    const result = detectTickers("$ONE pumps — ONE leads gainers", undefined, index);
    expect(result[0]).toMatchObject({ symbol: "ONEUSDT", matchedBy: "cashtag" });
  });

  it("'AI' as a plain word never becomes the AI token", () => {
    expect(detectTickers("New AI model released by lab", undefined, index)).toEqual([]);
  });

  it("bases without a USDT pair are dropped, never invented", () => {
    expect(detectTickers("NOPAIR surges 300%", undefined, index)).toEqual([]);
  });

  it("unknown symbols are ignored", () => {
    expect(detectTickers("FOO soars as $BAR rallies", undefined, index)).toEqual([]);
  });

  it("body matches score lower than headline matches and results are ordered", () => {
    const result = detectTickers(
      "Bitcoin steady ahead of CPI",
      // "SOL" here matches only the bare-symbol tier (the name alias is
      // "solana"), unlike "ethereum" which is a name match.
      "Meanwhile ethereum devs shipped an upgrade and SOL ticked up.",
      index,
    );
    expect(result.map((c) => c.symbol)).toEqual(["BTCUSDT", "ETHUSDT", "SOLUSDT"]);
    expect(result[0]!.confidence).toBeGreaterThan(result[1]!.confidence);
    expect(result[1]!.matchedBy).toBe("name-body");
    expect(result[2]!.matchedBy).toBe("symbol-body");
  });

  it("multi-word aliases beat their prefixes (bitcoin cash ≠ bitcoin)", () => {
    const withBch: SymbolIndex = {
      ...index,
      bases: new Set([...index.bases, "BCH"]),
      usdtPair: new Map([...index.usdtPair, ["BCH", "BCHUSDT"]]),
    };
    const result = detectTickers("Bitcoin Cash hard fork scheduled", undefined, withBch);
    expect(result[0]!.symbol).toBe("BCHUSDT");
  });

  it("caps at five candidates", () => {
    const result = detectTickers(
      "$BTC $ETH $SOL $PEPE $DOGE $ONE all pump",
      undefined,
      index,
    );
    expect(result).toHaveLength(5);
  });
});
