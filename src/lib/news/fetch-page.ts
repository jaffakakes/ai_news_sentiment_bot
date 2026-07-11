import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { NewsProviderError } from "./errors";
import { isPrivateAddress, validateUrlShape } from "./ssrf";

/**
 * Hardened fetch for user-pasted URLs. https-only, SSRF-guarded (hostname +
 * resolved-IP checks, re-run per redirect hop), ≤3 redirects, 10s deadline,
 * 2MB streamed cap, charset-aware decoding. Sends no cookies and no auth —
 * paywalled/login-gated pages fail honestly instead of being bypassed.
 */

const MAX_REDIRECTS = 3;
const DEADLINE_MS = 10_000;
const MAX_BYTES = 2 * 1024 * 1024;

// A realistic browser UA: several news CDNs (verified: CoinDesk) serve bot
// UAs a challenge page while serving browsers the real article markup.
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// Per-host courtesy limit so a fast-clicking user can't hammer one site.
const HOST_LIMIT = 10;
const HOST_WINDOW_MS = 60_000;
const globalStore = globalThis as unknown as {
  __newsHostRate?: Map<string, { count: number; windowStart: number }>;
};

function checkHostRate(host: string): void {
  const map = (globalStore.__newsHostRate ??= new Map());
  const now = Date.now();
  const entry = map.get(host);
  if (!entry || now - entry.windowStart >= HOST_WINDOW_MS) {
    map.set(host, { count: 1, windowStart: now });
    return;
  }
  entry.count += 1;
  if (entry.count > HOST_LIMIT) {
    throw new NewsProviderError(
      "RATE_LIMITED",
      `Too many requests to ${host} — wait a moment and try again.`,
    );
  }
}

async function assertResolvesPublic(hostname: string): Promise<void> {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return; // literal already validated by validateUrlShape
  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new NewsProviderError(
      "FETCH_FAILED",
      `Could not resolve ${host} — check the URL.`,
    );
  }
  for (const { address } of addresses) {
    if (isPrivateAddress(address)) {
      throw new NewsProviderError(
        "BLOCKED_URL",
        `${host} resolves to a private address — not fetched.`,
      );
    }
  }
}

export interface FetchedPage {
  finalUrl: string;
  status: number;
  contentType: string;
  text: string;
  truncated: boolean;
}

export type PageFetcher = (url: string) => Promise<FetchedPage>;

/** Read up to MAX_BYTES from the body, aborting the stream past the cap. */
async function readCapped(
  response: Response,
): Promise<{ bytes: Uint8Array; truncated: boolean }> {
  const reader = response.body?.getReader();
  if (!reader) return { bytes: new Uint8Array(0), truncated: false };
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      chunks.push(value.subarray(0, value.byteLength - (total - MAX_BYTES)));
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(Math.min(total, MAX_BYTES));
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes, truncated };
}

function detectCharset(contentType: string, head: Uint8Array): string {
  const fromHeader = contentType.match(/charset=([\w-]+)/i)?.[1];
  if (fromHeader) return fromHeader;
  // Sniff <meta charset> in the first KB (spec says it must appear early).
  const ascii = new TextDecoder("latin1").decode(head.subarray(0, 1024));
  const fromMeta =
    ascii.match(/<meta\s+charset=["']?([\w-]+)/i)?.[1] ??
    ascii.match(/charset=([\w-]+)["']?\s*\/?>/i)?.[1];
  return fromMeta ?? "utf-8";
}

function decode(bytes: Uint8Array, charset: string): string {
  try {
    return new TextDecoder(charset, { fatal: false }).decode(bytes);
  } catch {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }
}

function looksLikeLoginWall(url: URL): boolean {
  const path = url.pathname.toLowerCase();
  const host = url.hostname.toLowerCase();
  return (
    host.startsWith("consent.") ||
    host.startsWith("accounts.") ||
    host.startsWith("login.") ||
    /\/(login|signin|sign-in|auth|consent)(\/|$)/.test(path)
  );
}

export async function safeFetchPage(
  inputUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchedPage> {
  let url: URL;
  try {
    url = new URL(inputUrl);
  } catch {
    throw new NewsProviderError("BLOCKED_URL", "Not a valid URL.");
  }
  if (url.protocol === "http:") url.protocol = "https:"; // upgrade, never plain http

  const deadline = AbortSignal.timeout(DEADLINE_MS);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const shapeError = validateUrlShape(url);
    if (shapeError) throw new NewsProviderError("BLOCKED_URL", shapeError);
    await assertResolvesPublic(url.hostname);
    checkHostRate(url.hostname);

    let response: Response;
    try {
      response = await fetchImpl(url.toString(), {
        redirect: "manual",
        signal: deadline,
        headers: {
          "User-Agent": USER_AGENT,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en",
        },
      });
    } catch (err) {
      if (deadline.aborted) {
        throw new NewsProviderError(
          "FETCH_FAILED",
          "The site took longer than 10 seconds to respond.",
        );
      }
      throw new NewsProviderError(
        "FETCH_FAILED",
        `Could not reach ${url.hostname}: ${err instanceof Error ? err.message : "network error"}`,
      );
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new NewsProviderError("FETCH_FAILED", "Redirect without a target.");
      }
      url = new URL(location, url); // relative or absolute
      if (url.protocol === "http:") url.protocol = "https:";
      if (looksLikeLoginWall(url)) {
        throw new NewsProviderError(
          "ACCESS_DENIED",
          "The page redirects to a login/consent wall — no bypass attempted. Fill the fields manually.",
        );
      }
      continue;
    }

    if (response.status === 401 || response.status === 403) {
      throw new NewsProviderError(
        "ACCESS_DENIED",
        `${url.hostname} blocks automated access or requires login (HTTP ${response.status}) — no paywall bypass attempted. Copy the details manually.`,
      );
    }
    if (response.status === 404 || response.status === 410) {
      throw new NewsProviderError("NOT_FOUND", "The page does not exist (HTTP 404).");
    }
    if (response.status === 429) {
      throw new NewsProviderError(
        "RATE_LIMITED",
        `${url.hostname} is rate-limiting requests — try again shortly.`,
      );
    }
    if (!response.ok) {
      throw new NewsProviderError(
        "FETCH_FAILED",
        `${url.hostname} returned HTTP ${response.status}.`,
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    const { bytes, truncated } = await readCapped(response);
    if (bytes.byteLength === 0) {
      // Verified in the wild: binance.com's WAF answers bots with an empty
      // 2xx instead of an error status.
      throw new NewsProviderError(
        "ACCESS_DENIED",
        `${url.hostname} returned an empty page — it likely blocks automated access. Fill the fields manually.`,
      );
    }
    const text = decode(bytes, detectCharset(contentType, bytes));
    return {
      finalUrl: url.toString(),
      status: response.status,
      contentType,
      text,
      truncated,
    };
  }

  throw new NewsProviderError(
    "FETCH_FAILED",
    `Too many redirects (more than ${MAX_REDIRECTS}).`,
  );
}
