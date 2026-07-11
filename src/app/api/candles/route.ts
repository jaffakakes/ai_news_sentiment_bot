import type { NextRequest } from "next/server";
import { getProvider } from "@/lib/market/registry";
import {
  checkInboundRate,
  errorResponse,
  jsonError,
  jsonOk,
  parseQuery,
} from "@/lib/api-utils";
import { candlesQuerySchema } from "@/lib/validation/candles";

export const runtime = "nodejs";

const MINUTE_MS = 60_000;

export async function GET(request: NextRequest) {
  const limited = checkInboundRate(request);
  if (limited) return limited;

  const parsed = parseQuery(candlesQuerySchema, new URL(request.url));
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
  if (!provider.supportsInterval(q.interval)) {
    return jsonError(
      400,
      "UNSUPPORTED_INTERVAL",
      "Binance futures klines start at 1m — the 1s timeframe is spot-only.",
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
      interval: q.interval,
      startTime,
      endTime,
    });
    return jsonOk(result);
  } catch (err) {
    return errorResponse(err);
  }
}
