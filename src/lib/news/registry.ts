import "server-only";

import type { MarketType } from "@/lib/market/types";
import { NewsProviderError } from "./errors";
import { BinanceAnnouncementProvider } from "./providers/binance-announcement";
import { GenericHtmlProvider } from "./providers/generic-html";
import { RssProvider } from "./providers/rss";
import { TwitterProvider } from "./providers/twitter";
import { getSymbolIndex } from "./ticker/exchange-symbols";
import { detectTickers } from "./ticker/detect";
import type { ExtractedNews, NewsProvider } from "./types";

/**
 * Provider dispatch (first canHandle wins) + ticker detection. Detection
 * runs here, not in providers, so every source gets it uniformly.
 */
const providers: NewsProvider[] = [
  new TwitterProvider(),
  new BinanceAnnouncementProvider(),
  new RssProvider(),
  new GenericHtmlProvider(), // catch-all, must stay last
];

export interface ExtractNewsResponse {
  news: ExtractedNews;
  suggested?: { symbol: string; market: MarketType };
  warnings: string[];
}

export async function extractFromUrl(url: string): Promise<ExtractNewsResponse> {
  const provider = providers.find((p) => p.canHandle(url));
  if (!provider) {
    throw new NewsProviderError("BLOCKED_URL", "Not a fetchable https URL.");
  }

  const news = await provider.extract(url);
  news.url ??= url;

  const warnings: string[] = [];
  if (news.publishedAt === undefined) {
    warnings.push(
      "No publication time found — enter the event time manually before generating.",
    );
  } else if (news.publishedAtPrecision === "day") {
    warnings.push(
      "The source only gives a calendar date, not a time — confirm the event time before generating.",
    );
  } else if (news.publishedAt > Date.now()) {
    warnings.push("The published time is in the future — check it before generating.");
  }

  // Ticker detection never blocks extraction: if the symbol index is
  // unreachable, the user just types the ticker themselves.
  let suggested: ExtractNewsResponse["suggested"];
  try {
    const index = await getSymbolIndex();
    const detectionText = [news.summary, news.body].filter(Boolean).join(" ");
    news.tickers = detectTickers(news.headline, detectionText || undefined, index);
    const top = news.tickers[0];
    if (top) {
      suggested = {
        symbol: top.symbol,
        market: index.perpSymbols.has(top.symbol) ? "perp" : "spot",
      };
    } else {
      warnings.push("No Binance ticker detected — enter it manually.");
    }
  } catch {
    warnings.push("Ticker detection unavailable (symbol list unreachable) — enter the ticker manually.");
  }

  return { news, suggested, warnings };
}
