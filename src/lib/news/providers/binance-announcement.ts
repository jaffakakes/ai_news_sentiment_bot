import { NewsProviderError } from "../errors";
import type { ExtractedNews, NewsProvider } from "../types";
import type { JsonFetcher } from "./twitter";

/**
 * Binance announcement pages serve bots an empty 202 (AWS WAF), so HTML
 * extraction is impossible — but the public CMS API behind them works
 * without auth. UNOFFICIAL: the endpoint has drifted before (the
 * bapi/apex detail variant already returns null; only bapi/composite
 * works as of 2026-07). Any failure degrades to an honest error.
 */

const ANNOUNCEMENT_PATH_RE = /\/support\/announcement\//;
const ARTICLE_CODE_RE = /([0-9a-f]{32})(?:\/|\?|$)/i;

const DETAIL_URL =
  "https://www.binance.com/bapi/composite/v1/public/cms/article/detail/query?articleCode=";

interface CmsDetail {
  data?: {
    title?: string;
    publishDate?: number; // epoch ms
    seoDesc?: string;
    body?: string;
  } | null;
}

const defaultJsonFetcher: JsonFetcher = async (url) => {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    // WAF challenge / empty body
  }
  return { status: response.status, json };
};

export class BinanceAnnouncementProvider implements NewsProvider {
  readonly id = "binance-announcement";

  constructor(private readonly fetchJson: JsonFetcher = defaultJsonFetcher) {}

  canHandle(input: string): boolean {
    try {
      const url = new URL(input);
      return (
        /(^|\.)binance\.com$/.test(url.hostname) &&
        ANNOUNCEMENT_PATH_RE.test(url.pathname) &&
        ARTICLE_CODE_RE.test(url.pathname)
      );
    } catch {
      return false;
    }
  }

  async extract(input: string): Promise<ExtractedNews> {
    const code = new URL(input).pathname.match(ARTICLE_CODE_RE)?.[1];
    if (!code) {
      throw new NewsProviderError(
        "BLOCKED_URL",
        "Could not find an article code in this Binance announcement URL.",
      );
    }

    let status: number;
    let json: unknown;
    try {
      ({ status, json } = await this.fetchJson(DETAIL_URL + code.toLowerCase()));
    } catch {
      throw new NewsProviderError(
        "FETCH_FAILED",
        "Binance blocks automated access from this server — fill the fields manually.",
      );
    }
    const detail = (json ?? {}) as CmsDetail;
    if (status !== 200 || !detail.data?.title) {
      throw new NewsProviderError(
        status === 200 ? "NOT_FOUND" : "ACCESS_DENIED",
        status === 200
          ? "Binance's article API has no record of this announcement — check the URL or fill the fields manually."
          : "Binance blocks automated access from this server — fill the fields manually.",
      );
    }

    const bodyText = detail.data.body
      ?.replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2000);

    return {
      headline: detail.data.title.slice(0, 500),
      source: this.id,
      publisher: "Binance",
      url: input,
      canonicalUrl: input,
      publishedAt: detail.data.publishDate,
      publishedAtPrecision:
        detail.data.publishDate !== undefined ? "exact" : undefined,
      summary: detail.data.seoDesc?.slice(0, 500),
      body: bodyText,
    };
  }
}
