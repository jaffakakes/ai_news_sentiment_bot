import { describe, expect, it } from "vitest";
import { collectPageMeta } from "./html-meta";

const SAMPLE = `<!doctype html>
<html><head>
<title> My   Article </title>
<meta property="og:title" content="OG Title" />
<meta property="og:description" content="A description." />
<meta name="description" content="Meta description" />
<meta property="article:published_time" content="2024-01-10T21:00:00Z" />
<link rel="canonical" href="https://example.com/article" />
<script type="application/ld+json">{"@type":"NewsArticle","headline":"LD Headline"}</script>
<script type="application/ld+json">{broken json</script>
</head><body>
<time datetime="2024-01-10T21:05:00Z">9:05pm</time>
<p>Short.</p>
<p>This paragraph is comfortably longer than sixty characters so it should be collected by the parser.</p>
<p>Another sufficiently long paragraph that exists to test that multiple paragraphs are collected in order.</p>
</body></html>`;

describe("collectPageMeta", () => {
  const meta = collectPageMeta(SAMPLE);

  it("collects title, og tags, canonical, published time", () => {
    expect(meta.title).toBe("My Article");
    expect(meta.meta.get("og:title")).toBe("OG Title");
    expect(meta.meta.get("article:published_time")).toBe("2024-01-10T21:00:00Z");
    expect(meta.canonical).toBe("https://example.com/article");
  });

  it("collects raw JSON-LD blocks including broken ones (caller parses leniently)", () => {
    expect(meta.jsonLdBlocks).toHaveLength(2);
    expect(meta.jsonLdBlocks[0]).toContain("LD Headline");
  });

  it("collects time datetimes and substantial paragraphs only", () => {
    expect(meta.timeDatetimes).toEqual(["2024-01-10T21:05:00Z"]);
    expect(meta.paragraphs).toHaveLength(2);
    expect(meta.paragraphs[0]).toMatch(/^This paragraph/);
  });

  it("takes the first value when a meta key repeats", () => {
    const dupe = collectPageMeta(
      `<meta property="og:title" content="First"/><meta property="og:title" content="Second"/>`,
    );
    expect(dupe.meta.get("og:title")).toBe("First");
  });
});
