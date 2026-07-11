import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { jsonError } from "@/lib/api-utils";

export const runtime = "nodejs";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await prisma().tradeSimulation.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch {
    return jsonError(404, "NOT_FOUND", "Simulation not found");
  }
}
