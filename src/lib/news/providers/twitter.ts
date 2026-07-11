import { NewsProviderError } from "../errors";
import { parsePublishedDate } from "../date-parse";
import type { ExtractedNews, NewsProvider } from "../types";

/**
 * Tweet extraction via Twitter's public syndication endpoint (the one that
 * powers embedded tweets and vercel/react-tweet). No API key, exact
 * timestamps. It is UNOFFICIAL and has drifted before — react-tweet is the
 * canary; if this breaks, check that repo first. Fallback: the official
 * oEmbed endpoint, which has only day-precision dates.
 */

const TWEET_URL_RE =
  /^https?:\/\/(?:www\.|mobile\.)?(?:x\.com|twitter\.com)\/(?:\w{1,15}|i\/web)\/status(?:es)?\/(\d{1,25})/;

// Copied from react-tweet's fetch-tweet.ts — the server expects this exact
// feature set alongside the token.
const SYNDICATION_FEATURES = [
  "tfw_timeline_list:",
  "tfw_follower_count_sunset:true",
  "tfw_tweet_edit_backend:on",
  "tfw_refsrc_session:on",
  "tfw_fosnr_soft_interventions_enabled:on",
  "tfw_show_birdwatch_pivots_enabled:on",
  "tfw_show_business_verified_badge:on",
  "tfw_duplicate_scribes_to_settings:on",
  "tfw_use_profile_image_shape_enabled:on",
  "tfw_show_blue_verified_badge:on",
  "tfw_legacy_timeline_sunset:true",
  "tfw_show_gov_verified_badge:on",
  "tfw_show_business_affiliate_badge:on",
  "tfw_tweet_edit_frontend:on",
].join(";");

/**
 * Token formula from react-tweet, verified working. Number(id) loses
 * precision for ids above 2^53 — that is INTENTIONAL and load-bearing:
 * Twitter's server computes the same lossy float. Do not "fix" with BigInt;
 * that produces a different token and the request 404s.
 */
export function syndicationToken(id: string): string {
  return ((Number(id) / 1e15) * Math.PI)
    .toString(36)
    .replace(/(0+|\.)/g, "");
}

interface SyndicationTweet {
  __typename?: string;
  text?: string;
  created_at?: string;
  user?: { name?: string; screen_name?: string };
}

export type JsonFetcher = (url: string) => Promise<{ status: number; json: unknown }>;

const defaultJsonFetcher: JsonFetcher = async (url) => {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    redirect: "follow", // publish.twitter.com 301s to publish.x.com
    signal: AbortSignal.timeout(10_000),
  });
  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    // non-JSON body; leave null
  }
  return { status: response.status, json };
};

export class TwitterProvider implements NewsProvider {
  readonly id = "twitter";

  constructor(private readonly fetchJson: JsonFetcher = defaultJsonFetcher) {}

  canHandle(input: string): boolean {
    return TWEET_URL_RE.test(input);
  }

  async extract(input: string): Promise<ExtractedNews> {
    const id = input.match(TWEET_URL_RE)?.[1];
    if (!id) {
      throw new NewsProviderError("BLOCKED_URL", "Not a recognizable tweet URL.");
    }

    try {
      return await this.fromSyndication(id);
    } catch (err) {
      if (err instanceof NewsProviderError && err.code === "NOT_FOUND") {
        throw err; // definitive: deleted/protected — don't fall through
      }
      return await this.fromOembed(input);
    }
  }

  private async fromSyndication(id: string): Promise<ExtractedNews> {
    const url = `https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=en&token=${syndicationToken(id)}&features=${encodeURIComponent(SYNDICATION_FEATURES)}`;
    const { status, json } = await this.fetchJson(url);
    if (status !== 200 || json === null) {
      throw new NewsProviderError(
        "FETCH_FAILED",
        `Twitter syndication endpoint returned ${status}.`,
      );
    }
    const tweet = json as SyndicationTweet;
    if (tweet.__typename === "TweetTombstone") {
      throw new NewsProviderError(
        "NOT_FOUND",
        "Tweet is unavailable (deleted, protected, or withheld) — enter the details manually.",
      );
    }
    if (!tweet.text || !tweet.created_at) {
      // Empty object {} = not found (react-tweet semantics).
      throw new NewsProviderError(
        "NOT_FOUND",
        "Tweet not found — it may have been deleted. Enter the details manually.",
      );
    }
    const screenName = tweet.user?.screen_name;
    return {
      headline: tweet.text.slice(0, 500),
      source: this.id,
      publisher: screenName ? `@${screenName}` : tweet.user?.name,
      canonicalUrl: screenName
        ? `https://x.com/${screenName}/status/${id}`
        : undefined,
      publishedAt: Date.parse(tweet.created_at),
      publishedAtPrecision: "exact",
      body: tweet.text.slice(0, 2000),
    };
  }

  /** Official oEmbed: text + author, but only a day-precision date. */
  private async fromOembed(tweetUrl: string): Promise<ExtractedNews> {
    const url = `https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}&omit_script=1`;
    let status: number;
    let json: unknown;
    try {
      ({ status, json } = await this.fetchJson(url));
    } catch {
      throw new NewsProviderError(
        "FETCH_FAILED",
        "Twitter's public endpoints refused this tweet — enter the details manually.",
      );
    }
    if (status !== 200 || json === null) {
      throw new NewsProviderError(
        "FETCH_FAILED",
        "Twitter's public endpoints refused this tweet — enter the details manually.",
      );
    }
    const oembed = json as { author_name?: string; html?: string };
    const html = oembed.html ?? "";
    const text = html
      .match(/<p[^>]*>(.*?)<\/p>/s)?.[1]
      ?.replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    // The trailing anchor holds the human date: ">March 21, 2006</a>"
    const dateText = html.match(/>([A-Z]\w+ \d{1,2}, \d{4})<\/a>/)?.[1];
    const parsed = parsePublishedDate(dateText);
    if (!text) {
      throw new NewsProviderError(
        "EXTRACTION_INCOMPLETE",
        "Could not read the tweet text from Twitter's oEmbed response.",
      );
    }
    return {
      headline: text.slice(0, 500),
      source: this.id,
      publisher: oembed.author_name,
      url: tweetUrl,
      publishedAt: parsed?.epochMs,
      publishedAtPrecision: parsed?.precision, // "day" — suppresses auto-generate
      body: text.slice(0, 2000),
    };
  }
}
