import type { NextRequest } from "next/server";
import { getProvider } from "@/lib/market/registry";
import {
  checkInboundRate,
  errorResponse,
  jsonError,
  jsonOk,
  parseQuery,
} from "@/lib/api-utils";
import { eventWindowSchema } from "@/lib/validation/candles";
import {
  computeEventStats,
  InsufficientDataError,
} from "@/lib/stats/event-stats";

export const runtime = "nodejs";

const MINUTE_MS = 60_000;

/**
 * On-the-fly event statistics (no persistence). Always computed on 1m
 * candles regardless of the chart timeframe so +Nm returns are exact.
 */
export async function GET(request: NextRequest) {
  const limited = checkInboundRate(request);
  if (limited) return limited;

  const parsed = parseQuery(eventWindowSchema, new URL(request.url));
  if (!parsed.ok) return parsed.response;
  const q = parsed.value;

  const provider = getProvider(q.exchange, q.market);
  if (!provider) {
    return jsonError(
      400,
      "UNKNOWN_EXCHANGE",
      `No provider for ${q.exchange} ${q.market}`,
    );
  }

  const startTime = q.eventTime - q.lookbackMinutes * MINUTE_MS;
  const endTime = Math.min(
    q.eventTime + q.lookforwardMinutes * MINUTE_MS,
    Date.now(),
  );
  if (startTime >= endTime) {
    return jsonError(
      400,
      "WINDOW_IN_FUTURE",
      "The event window is entirely in the future — nothing to analyse yet.",
    );
  }

  try {
    const result = await provider.getCandles({
      symbol: q.symbol,
      interval: "1m",
      startTime,
      endTime,
    });
    const stats = computeEventStats({
      candles: result.candles,
      eventTime: q.eventTime,
      symbol: q.symbol,
      exchange: q.exchange,
      market: q.market,
      dataComplete: !result.partial,
    });
    return jsonOk(stats);
  } catch (err) {
    if (err instanceof InsufficientDataError) {
      return jsonError(422, "INSUFFICIENT_DATA", err.message);
    }
    return errorResponse(err);
  }
}
