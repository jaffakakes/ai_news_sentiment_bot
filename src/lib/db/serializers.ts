import "server-only";

import type {
  Event,
  EventStats,
  TradeSimulation,
} from "@/generated/prisma/client";

/**
 * Prisma Decimal/Date → string DTO mapping. Decimals must serialize via
 * .toString() so values round-trip byte-identical; Dates go out as epoch ms
 * to match the rest of the API surface.
 */

const s = (d: { toString(): string } | null): string | null =>
  d === null ? null : d.toString();

export function serializeEvent(event: Event) {
  return {
    id: event.id,
    headline: event.headline,
    url: event.url,
    source: event.source,
    ticker: event.ticker,
    eventTime: event.timestamp.getTime(),
    timezone: event.timezone,
    exchange: event.exchange,
    market: event.market,
    category: event.category,
    priceAtEvent: event.priceAtEvent.toString(),
    notes: event.notes,
    createdAt: event.createdAt.getTime(),
  };
}

export function serializeEventStats(stats: EventStats) {
  return {
    id: stats.id,
    eventId: stats.eventId,
    lookbackMinutes: stats.lookbackMinutes,
    lookforwardMinutes: stats.lookforwardMinutes,
    priceBefore: stats.priceBefore.toString(),
    highAfter: stats.highAfter.toString(),
    highAfterPct: stats.highAfterPct.toString(),
    lowAfter: stats.lowAfter.toString(),
    lowAfterPct: stats.lowAfterPct.toString(),
    timeToHighMs: stats.timeToHighMs,
    timeToLowMs: stats.timeToLowMs,
    returns: {
      "1m": s(stats.return1mPct),
      "5m": s(stats.return5mPct),
      "15m": s(stats.return15mPct),
      "30m": s(stats.return30mPct),
      "60m": s(stats.return60mPct),
    },
    volumeBefore: stats.volumeBefore.toString(),
    volumeAfter: stats.volumeAfter.toString(),
    volumeChangePct: s(stats.volumeChangePct),
    avgCandleRangePct: stats.avgCandleRangePct.toString(),
    postEventVolatilityPct: s(stats.postEventVolatilityPct),
    dataComplete: stats.dataComplete,
  };
}

export function serializeSimulation(sim: TradeSimulation) {
  return {
    id: sim.id,
    eventId: sim.eventId,
    direction: sim.direction,
    accountSize: sim.accountSize.toString(),
    margin: sim.margin.toString(),
    leverage: sim.leverage.toString(),
    entryPrice: sim.entryPrice.toString(),
    entryTime: sim.entryTime.getTime(),
    exitPrice: s(sim.exitPrice),
    stopLoss: s(sim.stopLoss),
    takeProfit: s(sim.takeProfit),
    takerFeePct: sim.takerFeePct.toString(),
    makerFeePct: sim.makerFeePct.toString(),
    slippagePct: sim.slippagePct.toString(),
    maintenanceMarginRatePct: sim.maintMarginPct.toString(),
    effectiveEntryPrice: sim.effectiveEntryPrice.toString(),
    effectiveExitPrice: sim.effectiveExitPrice.toString(),
    positionSizeQuote: sim.positionSizeQuote.toString(),
    quantityBase: sim.quantityBase.toString(),
    liquidationPrice: sim.liquidationPrice.toString(),
    exitReason: sim.exitReason,
    exitTime: sim.exitTime ? sim.exitTime.getTime() : null,
    timeInTradeMs: sim.timeInTradeMs,
    ambiguousCandle: sim.ambiguousCandle,
    grossPnl: sim.grossPnl.toString(),
    totalFees: sim.totalFees.toString(),
    netPnl: sim.netPnl.toString(),
    returnOnMarginPct: sim.returnOnMarginPct.toString(),
    returnOnAccountPct: sim.returnOnAccountPct.toString(),
    riskRewardRatio: s(sim.riskRewardRatio),
    mfePct: sim.mfePct.toString(),
    maePct: sim.maePct.toString(),
    liquidationBreached: sim.liquidationBreached,
    createdAt: sim.createdAt.getTime(),
  };
}

export type EventDTO = ReturnType<typeof serializeEvent>;
export type EventStatsDTO = ReturnType<typeof serializeEventStats>;
export type SimulationDTO = ReturnType<typeof serializeSimulation>;
