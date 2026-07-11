import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseFeedDocument, RssProvider } from "./rss";

const rssFixture = readFileSync(
  join(__dirname, "../../../test/fixtures/news/feed-rss2.xml"),
  "utf8",
);

const ATOM_FIXTURE = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Example Atom Feed</title>
  <entry>
    <title>Older entry</title>
    <link rel="alternate" href="https://example.com/older"/>
    <published>2024-01-09T10:00:00Z</published>
    <summary>Old summary</summary>
  </entry>
  <entry>
    <title>Newest entry about Bitcoin</title>
    <link rel="alternate" href="https://example.com/newest"/>
    <published>2024-01-10T21:00:00Z</published>
    <summary>New summary</summary>
  </entry>
</feed>`;

describe("parseFeedDocument", () => {
  it("returns the newest item of the captured CoinDesk RSS feed", () => {
    const news = parseFeedDocument(rssFixture, "https://www.coindesk.com/arc/outboundfeeds/rss/");
    expect(news.headline).toBe(
      "Bitcoin analysts predict $300,000–$500,000 price in 2029. The math says no",
    );
    expect(news.canonicalUrl).toContain("/markets/2026/07/10/");
    expect(news.publishedAt).toBe(Date.parse("Sat, 11 Jul 2026 02:30:00 +0000"));
    expect(news.publishedAtPrecision).toBe("exact");
    expect(news.publisher).toContain("CoinDesk");
    expect(news.summary).toContain("Analysts predict a rally");
  });

  it("parses Atom feeds and picks the newest entry", () => {
    const news = parseFeedDocument(ATOM_FIXTURE, "https://example.com/feed.atom");
    expect(news.headline).toBe("Newest entry about Bitcoin");
    expect(news.canonicalUrl).toBe("https://example.com/newest");
    expect(news.publishedAt).toBe(1704920400000);
  });

  it("throws on feeds with no items", () => {
    expect(() =>
      parseFeedDocument(`<rss version="2.0"><channel><title>Empty</title></channel></rss>`, "https://example.com/f"),
    ).toThrowError(/no readable items/);
  });
});

describe("RssProvider.canHandle", () => {
  const provider = new RssProvider();
  it("accepts feed-looking paths", () => {
    expect(provider.canHandle("https://example.com/feed.xml")).toBe(true);
    expect(provider.canHandle("https://example.com/blog/rss")).toBe(true);
    expect(provider.canHandle("https://example.com/feed/")).toBe(true);
    expect(provider.canHandle("https://example.com/news.atom")).toBe(true);
  });
  it("declines ordinary pages", () => {
    expect(provider.canHandle("https://example.com/markets/article")).toBe(false);
  });
});
