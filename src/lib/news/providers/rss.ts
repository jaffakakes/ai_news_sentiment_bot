import { Parser } from "htmlparser2";
import { NewsProviderError } from "../errors";
import { safeFetchPage, type PageFetcher } from "../fetch-page";
import { parsePublishedDate } from "../date-parse";
import type { ExtractedNews, NewsProvider } from "../types";

/**
 * RSS 2.0 / Atom feed parsing via htmlparser2's xmlMode (no extra dep).
 * Scope: parse ONE feed document and return its newest item — no polling,
 * no historical item matching.
 */

interface FeedItem {
  title: string;
  link: string;
  pubDate?: string;
  description?: string;
}

export function looksLikeFeed(text: string): boolean {
  const head = text.slice(0, 1024);
  return /<(rss|feed)[\s>]/i.test(head);
}

export function parseFeedDocument(xml: string, feedUrl: string): ExtractedNews {
  const items: FeedItem[] = [];
  let channelTitle = "";
  let current: Partial<FeedItem> | null = null;
  let path: string[] = [];
  let buffer = "";

  const parser = new Parser(
    {
      onopentag(name, attribs) {
        path.push(name);
        buffer = "";
        if (name === "item" || name === "entry") {
          current = {};
        }
        // Atom links are attributes: <link href="..."/>
        if (current && name === "link" && attribs.href && !current.link) {
          const rel = attribs.rel ?? "alternate";
          if (rel === "alternate") current.link = attribs.href;
        }
      },
      ontext(text) {
        buffer += text;
      },
      oncdatastart() {
        buffer = "";
      },
      onclosetag(name) {
        const value = buffer.trim();
        const inItem = current !== null;
        if (!inItem && name === "title" && !channelTitle) channelTitle = value;
        if (inItem && current) {
          if (name === "title") current.title = value;
          else if (name === "link" && value && !current.link) current.link = value;
          else if (name === "pubdate" || name === "published" || name === "updated") {
            current.pubDate ??= value;
          } else if (name === "description" || name === "summary") {
            current.description ??= value;
          } else if (name === "item" || name === "entry") {
            if (current.title && current.link) items.push(current as FeedItem);
            current = null;
          }
        }
        path.pop();
        buffer = "";
      },
    },
    { xmlMode: true, decodeEntities: true, lowerCaseTags: true },
  );
  parser.write(xml);
  parser.end();
  void path;

  if (items.length === 0) {
    throw new NewsProviderError(
      "EXTRACTION_INCOMPLETE",
      "The feed contains no readable items.",
    );
  }

  // Newest item by parsed date; items without dates sort last.
  const dated = items.map((item) => ({
    item,
    date: parsePublishedDate(item.pubDate),
  }));
  dated.sort((a, b) => (b.date?.epochMs ?? 0) - (a.date?.epochMs ?? 0));
  const newest = dated[0]!;

  return {
    headline: newest.item.title.slice(0, 500),
    source: "rss",
    publisher: channelTitle || new URL(feedUrl).hostname,
    url: feedUrl,
    canonicalUrl: newest.item.link,
    publishedAt: newest.date?.epochMs,
    publishedAtPrecision: newest.date?.precision,
    summary: newest.item.description?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500),
  };
}

export class RssProvider implements NewsProvider {
  readonly id = "rss";

  constructor(private readonly fetchPage: PageFetcher = safeFetchPage) {}

  canHandle(input: string): boolean {
    try {
      const url = new URL(input);
      return (
        /\.(rss|xml|atom)(\?|$)/i.test(url.pathname) ||
        /(^|\/)(feed|rss|atom)(\/|$)/i.test(url.pathname)
      );
    } catch {
      return false;
    }
  }

  async extract(input: string): Promise<ExtractedNews> {
    const page = await this.fetchPage(input);
    return parseFeedDocument(page.text, page.finalUrl);
  }
}
