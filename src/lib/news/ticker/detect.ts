import type { TickerCandidate, TickerMatchKind } from "../types";
import { AMBIGUOUS_BASES, COIN_NAME_ALIASES } from "./coin-names";
import type { SymbolIndex } from "./exchange-symbols";

/**
 * Fully-automatic ticker detection over headline + body text. Pure
 * function; the SymbolIndex parameter keeps unit tests offline.
 *
 * Hard invariant: nothing leaves this function that is not a live Binance
 * base asset with a trading USDT pair — a detection can be wrong-but-real,
 * never invented.
 */

const CASHTAG_RE = /\$([A-Za-z0-9]{2,10})\b/g;
const BARE_SYMBOL_RE = /\b([A-Z0-9]{2,6})\b/g;

// Longest-first so "bitcoin cash" wins over "bitcoin".
const SORTED_ALIASES = [...COIN_NAME_ALIASES].sort(
  (a, b) => b[0].length - a[0].length,
);

const CONFIDENCE: Record<TickerMatchKind, number> = {
  cashtag: 0.95,
  "name-headline": 0.8,
  "symbol-headline": 0.6,
  "name-body": 0.5,
  "symbol-body": 0.3,
};

interface RawMatch {
  base: string;
  kind: TickerMatchKind;
  text: string;
  corroborated: boolean; // via cashtag or name; gates ambiguous bare symbols
}

function scan(text: string, inHeadline: boolean, index: SymbolIndex): RawMatch[] {
  const matches: RawMatch[] = [];

  for (const match of text.matchAll(CASHTAG_RE)) {
    const base = match[1]!.toUpperCase();
    if (index.bases.has(base)) {
      matches.push({ base, kind: "cashtag", text: match[0], corroborated: true });
    }
  }

  const lower = text.toLowerCase();
  for (const [alias, base] of SORTED_ALIASES) {
    if (!index.bases.has(base)) continue;
    const pattern = new RegExp(
      `(?<![a-z0-9])${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`,
    );
    if (pattern.test(lower)) {
      matches.push({
        base,
        kind: inHeadline ? "name-headline" : "name-body",
        text: alias,
        corroborated: true,
      });
    }
  }

  // Bare uppercase symbols in ORIGINAL casing only — "Sol" the word never
  // matches, "SOL" does.
  for (const match of text.matchAll(BARE_SYMBOL_RE)) {
    const base = match[1]!;
    if (index.bases.has(base)) {
      matches.push({
        base,
        kind: inHeadline ? "symbol-headline" : "symbol-body",
        text: base,
        corroborated: false,
      });
    }
  }

  return matches;
}

export function detectTickers(
  headline: string,
  body: string | undefined,
  index: SymbolIndex,
): TickerCandidate[] {
  const raw = [
    ...scan(headline, true, index),
    ...(body ? scan(body, false, index) : []),
  ];

  const corroboratedBases = new Set(
    raw.filter((m) => m.corroborated).map((m) => m.base),
  );

  const best = new Map<string, RawMatch>();
  for (const match of raw) {
    // Ambiguous bases (ONE, GAS, AI, …) need corroboration beyond a bare
    // symbol hit — otherwise ordinary headline words become coins.
    if (
      !match.corroborated &&
      AMBIGUOUS_BASES.has(match.base) &&
      !corroboratedBases.has(match.base)
    ) {
      continue;
    }
    const current = best.get(match.base);
    if (!current || CONFIDENCE[match.kind] > CONFIDENCE[current.kind]) {
      best.set(match.base, match);
    }
  }

  return [...best.values()]
    .map((match) => {
      const symbol = index.usdtPair.get(match.base);
      if (!symbol) return null; // no tradable USDT pair — drop, never invent
      return {
        symbol,
        baseAsset: match.base,
        confidence: CONFIDENCE[match.kind],
        matchedBy: match.kind,
        matchedText: match.text,
      } satisfies TickerCandidate;
    })
    .filter((c): c is TickerCandidate => c !== null)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
}
