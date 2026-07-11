import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GenericHtmlProvider } from "./generic-html";
import { NewsProviderError } from "../errors";
import type { FetchedPage, PageFetcher } from "../fetch-page";

const fixture = (name: string) =>
  readFileSync(join(__dirname, "../../../test/fixtures/news", name), "utf8");

const stubFetcher =
  (text: string, contentType = "text/html; charset=utf-8"): PageFetcher =>
  async (url): Promise<FetchedPage> => ({
    finalUrl: url,
    status: 200,
    contentType,
    text,
    truncated: false,
  });

describe("GenericHtmlProvider", () => {
  it("handles any https URL and declines garbage", () => {
    const provider = new GenericHtmlProvider();
    expect(provider.canHandle("https://example.com/news")).toBe(true);
    expect(provider.canHandle("not a url")).toBe(false);
  });

  it("extracts the CoinDesk article via JSON-LD + Open Graph", async () => {
    const provider = new GenericHtmlProvider(stubFetcher(fixture("coindesk-article.html")));
    const news = await provider.extract(
      "https://www.coindesk.com/markets/2026/07/10/bitcoin-analysts-predict",
    );
    expect(news.headline).toContain("halving cycle history challenges");
    expect(news.publishedAt).toBe(Date.parse("2026-07-11T02:30:00.000Z"));
    expect(news.publishedAtPrecision).toBe("exact");
    expect(news.publisher).toBe("CoinDesk");
    expect(news.source).toBe("generic-html");
  });

  it("extracts the Bybit announcement via article:published_time", async () => {
    const provider = new GenericHtmlProvider(stubFetcher(fixture("bybit-article.html")));
    const news = await provider.extract(
      "https://announcements.bybit.com/en/article/whatever",
    );
    expect(news.headline).toContain("RWA Earn");
    expect(news.publishedAt).toBe(Date.parse("2026-06-15T00:00:00.000Z"));
    expect(news.publisher).toBe("Bybit"); // domain label map beats generic og:site_name
  });

  it("re-dispatches RSS documents to the feed parser", async () => {
    const provider = new GenericHtmlProvider(
      stubFetcher(fixture("feed-rss2.xml"), "application/rss+xml"),
    );
    const news = await provider.extract("https://www.coindesk.com/arc/outboundfeeds/rss/");
    expect(news.source).toBe("rss");
    expect(news.headline).toContain("Bitcoin analysts predict");
  });

  it("fails honestly when there is no headline metadata", async () => {
    const provider = new GenericHtmlProvider(stubFetcher("<html><body>hi</body></html>"));
    await expect(provider.extract("https://example.com/x")).rejects.toThrowError(
      NewsProviderError,
    );
  });

  it("rejects non-HTML content types", async () => {
    const provider = new GenericHtmlProvider(stubFetcher("%PDF-1.4", "application/pdf"));
    await expect(provider.extract("https://example.com/doc.pdf")).rejects.toMatchObject({
      code: "UNSUPPORTED_CONTENT",
    });
  });

  it("survives broken JSON-LD and falls back to og tags", async () => {
    const html = `<html><head>
      <script type="application/ld+json">{broken</script>
      <meta property="og:title" content="Fallback Headline"/>
      <meta property="article:published_time" content="2024-01-10T21:00:00Z"/>
      </head><body></body></html>`;
    const provider = new GenericHtmlProvider(stubFetcher(html));
    const news = await provider.extract("https://example.com/x");
    expect(news.headline).toBe("Fallback Headline");
    expect(news.publishedAt).toBe(1704920400000);
  });

  it("reports day precision for date-only metadata", async () => {
    const html = `<html><head>
      <meta property="og:title" content="T"/>
      <meta property="article:published_time" content="2024-01-10"/>
      </head></html>`;
    const provider = new GenericHtmlProvider(stubFetcher(html));
    const news = await provider.extract("https://example.com/x");
    expect(news.publishedAtPrecision).toBe("day");
  });
});
