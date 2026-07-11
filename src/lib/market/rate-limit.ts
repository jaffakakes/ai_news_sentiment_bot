import "server-only";

/**
 * Token bucket for outbound Binance request weight. Binance allows 2400+
 * weight/min per IP on both spot and futures; we self-cap far below that so
 * this tool can never contribute to a ban. State lives on `globalThis` to
 * survive dev-server HMR.
 */
const CAPACITY = 1000; // weight per minute
const REFILL_PER_MS = CAPACITY / 60_000;
const MAX_WAIT_MS = 10_000;

interface BucketState {
  tokens: number;
  lastRefill: number;
  pausedUntil: number; // epoch ms; set when Binance returns 429/418
}

const globalStore = globalThis as unknown as {
  __marketRateBucket?: BucketState;
};

function bucket(): BucketState {
  if (!globalStore.__marketRateBucket) {
    globalStore.__marketRateBucket = {
      tokens: CAPACITY,
      lastRefill: Date.now(),
      pausedUntil: 0,
    };
  }
  return globalStore.__marketRateBucket;
}

function refill(state: BucketState): void {
  const now = Date.now();
  state.tokens = Math.min(
    CAPACITY,
    state.tokens + (now - state.lastRefill) * REFILL_PER_MS,
  );
  state.lastRefill = now;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Acquire `weight` tokens, waiting up to MAX_WAIT_MS. Throws on timeout so
 * callers surface a 429 instead of queueing unboundedly.
 */
export async function acquireWeight(weight: number): Promise<void> {
  const state = bucket();
  const deadline = Date.now() + MAX_WAIT_MS;

  for (;;) {
    const now = Date.now();
    if (state.pausedUntil <= now) {
      refill(state);
      if (state.tokens >= weight) {
        state.tokens -= weight;
        return;
      }
    }
    if (now >= deadline) {
      throw new RateBudgetExceededError(
        Math.ceil(Math.max(state.pausedUntil - now, 1_000) / 1_000),
      );
    }
    await sleep(Math.min(250, deadline - now));
  }
}

/** Called when Binance itself rate-limits us (HTTP 429/418). */
export function pauseOutbound(seconds: number): void {
  const state = bucket();
  state.pausedUntil = Math.max(
    state.pausedUntil,
    Date.now() + seconds * 1_000,
  );
  state.tokens = 0;
}

export class RateBudgetExceededError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super("Outbound market-data rate budget exhausted");
    this.name = "RateBudgetExceededError";
  }
}
