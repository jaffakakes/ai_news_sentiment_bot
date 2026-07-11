import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { serializeSimulation } from "@/lib/db/serializers";
import { getProvider } from "@/lib/market/registry";
import { simulate, SimulationError } from "@/lib/sim/engine";
import {
  checkInboundRate,
  errorResponse,
  jsonError,
  jsonOk,
  parseBody,
} from "@/lib/api-utils";
import { simulationInputSchema } from "@/lib/validation/simulation";

export const runtime = "nodejs";

const MINUTE_MS = 60_000;

/**
 * Run a simulation against real candles for a saved event and persist the
 * full input+output snapshot. The candle walk starts at entryTime and runs
 * to the end of the event's stored lookforward window.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = checkInboundRate(request);
  if (limited) return limited;

  const { id } = await params;
  const parsed = await parseBody(simulationInputSchema, request);
  if (!parsed.ok) return parsed.response;
  const input = parsed.value;

  try {
    const event = await prisma().event.findUnique({
      where: { id },
      include: { stats: true },
    });
    if (!event) return jsonError(404, "NOT_FOUND", "Event not found");

    const market = event.market === "SPOT" ? "spot" : "perp";
    const provider = getProvider(event.exchange, market);
    if (!provider) {
      return jsonError(400, "UNKNOWN_EXCHANGE", `No provider for ${event.exchange} ${market}`);
    }

    const lookforwardMinutes = event.stats?.lookforwardMinutes ?? 120;
    const windowEnd = Math.min(
      event.timestamp.getTime() + lookforwardMinutes * MINUTE_MS,
      Date.now(),
    );
    if (input.entryTime >= windowEnd) {
      return jsonError(
        422,
        "ENTRY_OUTSIDE_WINDOW",
        "Entry time is at or beyond the end of the analysed window.",
      );
    }

    const result = await provider.getCandles({
      symbol: event.ticker,
      interval: "1m",
      startTime: input.entryTime,
      endTime: windowEnd,
    });
    if (result.candles.length === 0) {
      return jsonError(
        422,
        "NO_CANDLES",
        result.note ?? "No candles available after the entry time.",
      );
    }

    const sim = simulate(
      {
        direction: input.direction,
        accountSize: input.accountSize,
        margin: input.margin,
        leverage: input.leverage,
        entryPrice: input.entryPrice,
        entryTime: input.entryTime,
        exitPrice: input.exitPrice,
        stopLoss: input.stopLoss,
        takeProfit: input.takeProfit,
        takerFeePct: input.takerFeePct,
        makerFeePct: input.makerFeePct,
        slippagePct: input.slippagePct,
        maintenanceMarginRatePct: input.maintenanceMarginRatePct,
      },
      result.candles,
    );

    const saved = await prisma().tradeSimulation.create({
      data: {
        eventId: event.id,
        direction: input.direction === "long" ? "LONG" : "SHORT",
        accountSize: input.accountSize,
        margin: input.margin,
        leverage: input.leverage,
        entryPrice: input.entryPrice,
        entryTime: new Date(input.entryTime),
        exitPrice: input.exitPrice,
        stopLoss: input.stopLoss,
        takeProfit: input.takeProfit,
        takerFeePct: input.takerFeePct,
        makerFeePct: input.makerFeePct,
        slippagePct: input.slippagePct,
        maintMarginPct: input.maintenanceMarginRatePct,
        effectiveEntryPrice: sim.effectiveEntryPrice,
        effectiveExitPrice: sim.effectiveExitPrice,
        positionSizeQuote: sim.positionSizeQuote,
        quantityBase: sim.quantityBase,
        liquidationPrice: sim.liquidationPrice,
        exitReason: sim.exitReason.toUpperCase() as
          | "TAKE_PROFIT"
          | "STOP_LOSS"
          | "MANUAL_EXIT"
          | "LIQUIDATED"
          | "WINDOW_END",
        exitTime: sim.exitTime !== null ? new Date(sim.exitTime) : null,
        timeInTradeMs: sim.timeInTradeMs,
        ambiguousCandle: sim.ambiguousCandle,
        grossPnl: sim.grossPnl,
        totalFees: sim.totalFees,
        netPnl: sim.netPnl,
        returnOnMarginPct: sim.returnOnMarginPct,
        returnOnAccountPct: sim.returnOnAccountPct,
        riskRewardRatio: sim.riskRewardRatio,
        mfePct: sim.maxFavorableExcursionPct,
        maePct: sim.maxAdverseExcursionPct,
        liquidationBreached: sim.liquidationBreached,
      },
    });

    return jsonOk(serializeSimulation(saved), { status: 201 });
  } catch (err) {
    if (err instanceof SimulationError) {
      return jsonError(422, "SIMULATION_ERROR", err.message);
    }
    return errorResponse(err);
  }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const sims = await prisma().tradeSimulation.findMany({
      where: { eventId: id },
      orderBy: { createdAt: "desc" },
    });
    return jsonOk(sims.map(serializeSimulation));
  } catch (err) {
    return errorResponse(err);
  }
}
