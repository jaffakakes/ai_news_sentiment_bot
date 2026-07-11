import "server-only";

import { BinanceFuturesProvider } from "./binance-futures";
import { BinanceSpotProvider } from "./binance-spot";
import type { MarketProvider, MarketType } from "./types";

/**
 * Provider registry. Additional exchanges (Bybit, OKX, Coinbase, Kraken,
 * Bitget) plug in here by implementing MarketProvider — nothing upstream
 * of this module changes.
 */
const providers: Record<string, Partial<Record<MarketType, MarketProvider>>> = {
  binance: {
    spot: new BinanceSpotProvider(),
    perp: new BinanceFuturesProvider(),
  },
};

export function getProvider(
  exchange: string,
  market: MarketType,
): MarketProvider | undefined {
  return providers[exchange]?.[market];
}

export function listExchanges(): string[] {
  return Object.keys(providers);
}
