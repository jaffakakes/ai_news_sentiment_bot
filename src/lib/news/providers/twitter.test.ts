import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { syndicationToken, TwitterProvider, type JsonFetcher } from "./twitter";

const syndicationFixture = JSON.parse(
  readFileSync(
    join(__dirname, "../../../test/fixtures/news/tweet-syndication.json"),
    "utf8",
  ),
) as unknown;

const stub =
  (responses: Record<string, { status: number; json: unknown }>): JsonFetcher =>
  async (url) => {
    for (const [needle, response] of Object.entries(responses)) {
      if (url.includes(needle)) return response;
    }
    throw new Error(`unexpected fetch: ${url}`);
  };

describe("syndicationToken", () => {
  it("matches the react-tweet formula for a known id", () => {
    // ((20 / 1e15) * PI).toString(36) with 0s and dots stripped
    const expected = ((20 / 1e15) * Math.PI)
      .toString(36)
      .replace(/(0+|\.)/g, "");
    expect(syndicationToken("20")).toBe(expected);
    expect(expected.length).toBeGreaterThan(0);
  });
});

describe("TwitterProvider", () => {
  const provider = (fetcher: JsonFetcher) => new TwitterProvider(fetcher);

  it("recognizes tweet URLs on both domains", () => {
    const p = new TwitterProvider();
    expect(p.canHandle("https://x.com/jack/status/20")).toBe(true);
    expect(p.canHandle("https://twitter.com/jack/status/20")).toBe(true);
    expect(p.canHandle("https://mobile.twitter.com/jack/statuses/20")).toBe(true);
    expect(p.canHandle("https://x.com/jack")).toBe(false);
    expect(p.canHandle("https://example.com/status/20")).toBe(false);
  });

  it("extracts the captured @jack tweet exactly", async () => {
    const p = provider(
      stub({ "cdn.syndication.twimg.com": { status: 200, json: syndicationFixture } }),
    );
    const news = await p.extract("https://x.com/jack/status/20");
    expect(news.headline).toBe("just setting up my twttr");
    expect(news.publishedAt).toBe(Date.parse("2006-03-21T20:50:14.000Z"));
    expect(news.publishedAtPrecision).toBe("exact");
    expect(news.publisher).toBe("@jack");
    expect(news.canonicalUrl).toBe("https://x.com/jack/status/20");
  });

  it("maps a tombstone to NOT_FOUND without hitting oEmbed", async () => {
    const p = provider(
      stub({
        "cdn.syndication.twimg.com": {
          status: 200,
          json: { __typename: "TweetTombstone" },
        },
      }),
    );
    await expect(p.extract("https://x.com/x/status/1")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("maps an empty {} response to NOT_FOUND", async () => {
    const p = provider(
      stub({ "cdn.syndication.twimg.com": { status: 200, json: {} } }),
    );
    await expect(p.extract("https://x.com/x/status/1")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("falls back to oEmbed with day precision when syndication drifts", async () => {
    const p = provider(
      stub({
        "cdn.syndication.twimg.com": { status: 500, json: null },
        "publish.twitter.com": {
          status: 200,
          json: {
            author_name: "jack",
            html: `<blockquote><p>just setting up my twttr</p>&mdash; jack (@jack) <a href="https://twitter.com/jack/status/20">March 21, 2006</a></blockquote>`,
          },
        },
      }),
    );
    const news = await p.extract("https://x.com/jack/status/20");
    expect(news.headline).toBe("just setting up my twttr");
    expect(news.publishedAtPrecision).toBe("day");
    expect(news.publishedAt).toBe(Date.parse("March 21, 2006 00:00:00 UTC"));
  });

  it("fails honestly when both endpoints refuse", async () => {
    const p = provider(
      stub({
        "cdn.syndication.twimg.com": { status: 500, json: null },
        "publish.twitter.com": { status: 500, json: null },
      }),
    );
    await expect(p.extract("https://x.com/x/status/1")).rejects.toMatchObject({
      code: "FETCH_FAILED",
    });
  });
});
