import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { serializeEvent, serializeEventStats } from "@/lib/db/serializers";
import { errorResponse, jsonError, jsonOk } from "@/lib/api-utils";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const event = await prisma().event.findUnique({
      where: { id },
      include: { stats: true, _count: { select: { simulations: true } } },
    });
    if (!event) return jsonError(404, "NOT_FOUND", "Event not found");
    return jsonOk({
      event: serializeEvent(event),
      stats: event.stats ? serializeEventStats(event.stats) : null,
      simulationCount: event._count.simulations,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    await prisma().event.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch {
    return jsonError(404, "NOT_FOUND", "Event not found");
  }
}
