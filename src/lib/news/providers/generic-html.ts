import { NewsProviderError } from "../errors";
import { safeFetchPage, type PageFetcher } from "../fetch-page";
import { collectPageMeta, type PageMeta } from "../html-meta";
import { parsePublishedDate } from "../date-parse";
import type { ExtractedNews, NewsProvider } from "../types";
import { parseFeedDocument, looksLikeFeed } from "./rss";

const SUMMARY_CAP = 500;
const BODY_CAP = 2000;

const ARTICLE_TYPES = new Set([
  "NewsArticle",
  "ReportageNewsArticle",
  "Article",
  "BlogPosting",
  "LiveBlogPosting",
]);

// Sites whose og:site_name is missing or unhelpfully generic.
const PUBLISHER_LABELS: Record<string, string> = {
  "announcements.bybit.com": "Bybit",
  "www.okx.com": "OKX",
  "www.coindesk.com": "CoinDesk",
  "cointelegraph.com": "CoinTelegraph",
  "decrypt.co": "Decrypt",
};

interface JsonLdArticle {
  headline?: string;
  datePublished?: string;
  description?: string;
  url?: string;
  publisher?: { name?: string } | { name?: string }[];
}

/** Find the first article-like node across all JSON-LD blocks, leniently. */
function findJsonLdArticle(blocks: string[]): JsonLdArticle | undefined {
  for (const block of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(block);
    } catch {
      continue; // broken JSON-LD is common in the wild
    }
    const queue: unknown[] = Array.isArray(parsed) ? [...parsed] : [parsed];
    while (queue.length > 0) {
      const node = queue.shift();
      if (!node || typeof node !== "object") continue;
      const record = node as Record<string, unknown>;
      if (Array.isArray(record["@graph"])) queue.push(...record["@graph"]);
      const type = record["@type"];
      const types = Array.isArray(type) ? type : [type];
      if (types.some((t) => typeof t === "string" && ARTICLE_TYPES.has(t))) {
        return record as JsonLdArticle;
      }
    }
  }
  return undefined;
}

function jsonLdPublisherName(article: JsonLdArticle | undefined): string | undefined {
  const publisher = article?.publisher;
  if (!publisher) return undefined;
  const node = Array.isArray(publisher) ? publisher[0] : publisher;
  return node?.name;
}

export function extractFromMeta(
  meta: PageMeta,
  finalUrl: string,
  providerId: string,
): ExtractedNews {
  const article = findJsonLdArticle(meta.jsonLdBlocks);
  const url = new URL(finalUrl);

  const headline =
    article?.headline ??
    meta.meta.get("og:title") ??
    meta.meta.get("twitter:title") ??
    meta.title;
  if (!headline || !headline.trim()) {
    throw new NewsProviderError(
      "EXTRACTION_INCOMPLETE",
      "The page has no recognizable headline metadata — fill the fields manually.",
    );
  }

  const dateRaw =
    article?.datePublished ??
    meta.meta.get("article:published_time") ??
    meta.meta.get("parsely-pub-date") ??
    meta.meta.get("date") ??
    meta.meta.get("datepublished") ??
    meta.timeDatetimes[0];
  const parsedDate = parsePublishedDate(dateRaw);

  const publisher =
    jsonLdPublisherName(article) ??
    PUBLISHER_LABELS[url.hostname] ??
    meta.meta.get("og:site_name") ??
    url.hostname;

  const summary = (
    meta.meta.get("og:description") ??
    meta.meta.get("description") ??
    article?.description
  )?.slice(0, SUMMARY_CAP);

  return {
    headline: headline.trim().slice(0, 500),
    source: providerId,
    publisher,
    canonicalUrl: meta.canonical ?? meta.meta.get("og:url") ?? finalUrl,
    publishedAt: parsedDate?.epochMs,
    publishedAtPrecision: parsedDate?.precision,
    summary,
    body: meta.paragraphs.join(" ").slice(0, BODY_CAP) || undefined,
  };
}

/**
 * Fallback provider for any https URL: Open Graph → JSON-LD → standard meta.
 * Re-dispatches to the feed parser when the response turns out to be
 * RSS/Atom (content-type is unknowable before fetching).
 */
export class GenericHtmlProvider implements NewsProvider {
  readonly id = "generic-html";

  constructor(private readonly fetchPage: PageFetcher = safeFetchPage) {}

  canHandle(input: string): boolean {
    try {
      const url = new URL(input);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }

  async extract(input: string): Promise<ExtractedNews> {
    const page = await this.fetchPage(input);

    if (
      /(?:application\/(?:rss\+xml|atom\+xml|xml)|text\/xml)/i.test(page.contentType) ||
      looksLikeFeed(page.text)
    ) {
      return parseFeedDocument(page.text, page.finalUrl);
    }

    const contentTypeBase = page.contentType.split(";")[0]?.trim() ?? "";
    if (
      contentTypeBase &&
      !/^(text\/html|application\/xhtml\+xml)$/i.test(contentTypeBase)
    ) {
      throw new NewsProviderError(
        "UNSUPPORTED_CONTENT",
        `Cannot extract from ${contentTypeBase || "this content type"} — only web pages and feeds are supported.`,
      );
    }

    return extractFromMeta(collectPageMeta(page.text), page.finalUrl, this.id);
  }
}
