import "server-only";

import { binanceFetch } from "@/lib/market/binance-common";

/**
 * Compact index of tradable Binance symbols for ticker detection. The
 * filtered exchangeInfo response is ~2.4MB (unfiltered is 17MB — never
 * fetch that); it is reduced to sets/maps immediately and cached 24h.
 */
export interface SymbolIndex {
  bases: Set<string>; // every base asset with a TRADING pair
  usdtPair: Map<string, string>; // base → "<base>USDT" where that pair trades
  perpSymbols: Set<string>; // USDT-M perp symbols, empty if futures API unreachable
}

const SPOT_BASE =
  process.env.BINANCE_SPOT_BASE_URL ?? "https://data-api.binance.vision";
const FUTURES_BASE =
  process.env.BINANCE_FUTURES_BASE_URL ?? "https://fapi.binance.com";

const TTL_MS = 24 * 60 * 60 * 1_000;

interface ExchangeInfoResponse {
  symbols: {
    symbol: string;
    status?: string;
    contractStatus?: string;
    baseAsset: string;
    quoteAsset: string;
  }[];
}

const globalStore = globalThis as unknown as {
  __symbolIndex?: { value: SymbolIndex; expiresAt: number };
  __symbolIndexInFlight?: Promise<SymbolIndex> | null;
};

async function buildIndex(): Promise<SymbolIndex> {
  const spot = await binanceFetch<ExchangeInfoResponse>(
    `${SPOT_BASE}/api/v3/exchangeInfo?symbolStatus=TRADING&showPermissionSets=false`,
    20,
  );

  const bases = new Set<string>();
  const usdtPair = new Map<string, string>();
  for (const s of spot.symbols) {
    bases.add(s.baseAsset);
    if (s.quoteAsset === "USDT") usdtPair.set(s.baseAsset, s.symbol);
  }

  // Futures list is optional: fapi.binance.com is geo-blocked from some
  // hosts (verified 451 from this dev container). Detection still works
  // from the spot list; suggested market just stays "spot".
  const perpSymbols = new Set<string>();
  try {
    const futures = await binanceFetch<ExchangeInfoResponse>(
      `${FUTURES_BASE}/fapi/v1/exchangeInfo`,
      20,
    );
    for (const s of futures.symbols) {
      if (s.status === "TRADING" || s.contractStatus === "TRADING") {
        perpSymbols.add(s.symbol);
      }
    }
  } catch {
    // fail soft — spot-only index
  }

  return { bases, usdtPair, perpSymbols };
}

export async function getSymbolIndex(): Promise<SymbolIndex> {
  const cached = globalStore.__symbolIndex;
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  // Single-flight: concurrent extractions share one 2.4MB fetch.
  if (!globalStore.__symbolIndexInFlight) {
    globalStore.__symbolIndexInFlight = buildIndex()
      .then((value) => {
        globalStore.__symbolIndex = { value, expiresAt: Date.now() + TTL_MS };
        return value;
      })
      .finally(() => {
        globalStore.__symbolIndexInFlight = null;
      });
  }
  return globalStore.__symbolIndexInFlight;
}
