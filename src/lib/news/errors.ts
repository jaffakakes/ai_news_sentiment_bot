export type NewsErrorCode =
  | "BLOCKED_URL" // SSRF guard / non-https / disallowed port → 400
  | "UNSUPPORTED_CONTENT" // pdf/image/binary → 422
  | "FETCH_FAILED" // network / 5xx / timeout → 502
  | "ACCESS_DENIED" // 401/403/paywall/bot-wall — we never bypass → 422
  | "NOT_FOUND" // 404/410, deleted tweet → 404
  | "EXTRACTION_INCOMPLETE" // fetched OK but no usable headline → 422
  | "RATE_LIMITED"; // → 429

/**
 * Extraction failures carry an honest, user-facing message — the UI shows it
 * verbatim so the user knows exactly why manual entry is needed.
 */
export class NewsProviderError extends Error {
  constructor(
    public readonly code: NewsErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "NewsProviderError";
  }
}
