import type { NextRequest } from "next/server";
import { extractFromUrl } from "@/lib/news/registry";
import {
  checkInboundRate,
  errorResponse,
  jsonOk,
  parseBody,
} from "@/lib/api-utils";
import { extractNewsSchema } from "@/lib/validation/news";

export const runtime = "nodejs";

/**
 * Extract news metadata from a pasted public URL. Read-only, server-side
 * fetching with SSRF guards; never bypasses authentication or paywalls.
 */
export async function POST(request: NextRequest) {
  const limited = checkInboundRate(request);
  if (limited) return limited;

  const parsed = await parseBody(extractNewsSchema, request);
  if (!parsed.ok) return parsed.response;

  try {
    const result = await extractFromUrl(parsed.value.url);
    return jsonOk(result);
  } catch (err) {
    return errorResponse(err);
  }
}
