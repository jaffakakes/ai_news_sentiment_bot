import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { serializeEvent, serializeEventStats } from "@/lib/db/serializers";
import { getProvider } from "@/lib/market/registry";
import {
  computeEventStats,
  InsufficientDataError,
} from "@/lib/stats/event-stats";
import { isValidTimeZone } from "@/lib/time";
import {
  checkInboundRate,
  errorResponse,
  jsonError,
  jsonOk,
  parseBody,
  parseQuery,
} from "@/lib/api-utils";
import { createEventSchema, eventFilterSchema } from "@/lib/validation/events";
import type { Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";

const MINUTE_MS = 60_000;

/**
 * Create an event. Stats are recomputed server-side from fresh 1m candles —
 * client-supplied statistics are never trusted or stored.
 */
export async function POST(request: NextRequest) {
  const limited = checkInboundRate(request);
  if (limited) return limited;

  const parsed = await parseBody(createEventSchema, request);
  if (!parsed.ok) return parsed.response;
  const input = parsed.value;

  if (!isValidTimeZone(input.timezone)) {
    return jsonError(400, "INVALID_TIMEZONE", `Unknown IANA timezone "${input.timezone}"`);
  }

  const provider = getProvider(input.exchange, input.market);
  if (!provider) {
    return jsonError(400, "UNKNOWN_EXCHANGE", `No provider for ${input.exchange} ${input.market}`);
  }

  try {
    const result = await provider.getCandles({
      symbol: input.ticker,
      interval: "1m",
      startTime: input.eventTime - input.lookbackMinutes * MINUTE_MS,
      endTime: Math.min(
        input.eventTime + input.lookforwardMinutes * MINUTE_MS,
        Date.now(),
      ),
    });

    const stats = computeEventStats({
      candles: result.candles,
      eventTime: input.eventTime,
      symbol: input.ticker,
      exchange: input.exchange,
      market: input.market,
      dataComplete: !result.partial,
    });

    const event = await prisma().event.create({
      data: {
        headline: input.headline,
        url: input.url,
        source: input.source,
        ticker: input.ticker,
        timestamp: new Date(input.eventTime),
        timezone: input.timezone,
        exchange: input.exchange,
        market: input.market === "spot" ? "SPOT" : "PERP",
        category: input.category,
        priceAtEvent: stats.priceAtEvent,
        notes: input.notes,
        stats: {
          create: {
            lookbackMinutes: input.lookbackMinutes,
            lookforwardMinutes: input.lookforwardMinutes,
            priceBefore: stats.priceBefore,
            highAfter: stats.highAfter,
            highAfterPct: stats.highAfterPct,
            lowAfter: stats.lowAfter,
            lowAfterPct: stats.lowAfterPct,
            timeToHighMs: stats.timeToHighMs,
            timeToLowMs: stats.timeToLowMs,
            return1mPct: stats.returns["1m"],
            return5mPct: stats.returns["5m"],
            return15mPct: stats.returns["15m"],
            return30mPct: stats.returns["30m"],
            return60mPct: stats.returns["60m"],
            volumeBefore: stats.volumeBefore,
            volumeAfter: stats.volumeAfter,
            volumeChangePct: stats.volumeChangePct,
            avgCandleRangePct: stats.avgCandleRangePct,
            postEventVolatilityPct: stats.postEventVolatilityPct,
            dataComplete: stats.dataComplete,
          },
        },
      },
      include: { stats: true },
    });

    return jsonOk(
      {
        event: serializeEvent(event),
        stats: event.stats ? serializeEventStats(event.stats) : null,
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof InsufficientDataError) {
      return jsonError(422, "INSUFFICIENT_DATA", err.message);
    }
    return errorResponse(err);
  }
}

export async function GET(request: NextRequest) {
  const limited = checkInboundRate(request);
  if (limited) return limited;

  const parsed = parseQuery(eventFilterSchema, new URL(request.url));
  if (!parsed.ok) return parsed.response;
  const filter = parsed.value;

  const where: Prisma.EventWhereInput = {};
  if (filter.ticker) where.ticker = filter.ticker;
  if (filter.source) where.source = filter.source;
  if (filter.exchange) where.exchange = filter.exchange;
  if (filter.category) where.category = filter.category;
  if (filter.from || filter.to) {
    where.timestamp = {
      ...(filter.from ? { gte: new Date(filter.from) } : {}),
      ...(filter.to ? { lte: new Date(filter.to) } : {}),
    };
  }

  try {
    const [items, total] = await Promise.all([
      prisma().event.findMany({
        where,
        include: { stats: true, _count: { select: { simulations: true } } },
        orderBy: { timestamp: "desc" },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      prisma().event.count({ where }),
    ]);

    return jsonOk({
      items: items.map((event) => ({
        ...serializeEvent(event),
        stats: event.stats ? serializeEventStats(event.stats) : null,
        simulationCount: event._count.simulations,
      })),
      total,
      page: filter.page,
      pageSize: filter.pageSize,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
