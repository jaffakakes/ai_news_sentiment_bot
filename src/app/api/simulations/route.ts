import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { serializeEvent, serializeSimulation } from "@/lib/db/serializers";
import { errorResponse, jsonOk, parseQuery } from "@/lib/api-utils";

export const runtime = "nodejs";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

/** Recent simulations across all events, for the bottom history panel. */
export async function GET(request: NextRequest) {
  const parsed = parseQuery(querySchema, new URL(request.url));
  if (!parsed.ok) return parsed.response;

  try {
    const sims = await prisma().tradeSimulation.findMany({
      include: { event: true },
      orderBy: { createdAt: "desc" },
      take: parsed.value.limit,
    });
    return jsonOk(
      sims.map((sim) => ({
        ...serializeSimulation(sim),
        event: serializeEvent(sim.event),
      })),
    );
  } catch (err) {
    return errorResponse(err);
  }
}
