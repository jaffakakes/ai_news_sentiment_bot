/**
 * News extraction contracts. URL providers (Twitter, exchange announcements,
 * RSS, generic Open Graph / JSON-LD) implement NewsProvider; the registry
 * picks the first provider whose canHandle() accepts the input.
 */

export type TickerMatchKind =
  | "cashtag"
  | "name-headline"
  | "symbol-headline"
  | "name-body"
  | "symbol-body";

export interface TickerCandidate {
  symbol: string; // tradable Binance symbol, e.g. "SOLUSDT" — never invented
  baseAsset: string; // "SOL"
  confidence: number; // 0..1
  matchedBy: TickerMatchKind;
  matchedText: string; // "$SOL" | "Solana" | "SOL"
}

/**
 * "exact" = full timestamp from the source; "day" = the source only gave a
 * calendar date (e.g. Twitter oEmbed) — good enough to pre-fill the form but
 * NOT good enough to auto-generate a minute-window chart around it.
 */
export type DatePrecision = "exact" | "day";

export interface ExtractedNews {
  headline: string;
  source: string; // provider id: "manual" | "generic-html" | "twitter" | "rss" | "binance-announcement"
  publisher?: string; // human label: "CoinDesk", "Bybit", "@cz_binance"
  url?: string; // as pasted
  canonicalUrl?: string; // rel=canonical / og:url / final redirect URL
  publishedAt?: number; // epoch ms UTC; absent = honestly unknown, never fabricated
  publishedAtPrecision?: DatePrecision;
  summary?: string; // og:description / JSON-LD description, capped
  body?: string; // short excerpt — ticker-detection input only
  tickers?: TickerCandidate[]; // ordered by confidence desc
}

export interface NewsProvider {
  readonly id: string;
  canHandle(input: string): boolean;
  extract(input: string): Promise<ExtractedNews>;
}
