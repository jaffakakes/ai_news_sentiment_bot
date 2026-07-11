import { NextResponse } from "next/server";
import { z } from "zod";
import { MarketProviderError } from "./market/types";

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}

export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ data }, init);
}

export function jsonError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
  headers?: HeadersInit,
): NextResponse {
  return NextResponse.json(
    { error: { code, message, ...(details !== undefined ? { details } : {}) } },
    { status, headers },
  );
}

export function parseQuery<S extends z.ZodType>(
  schema: S,
  url: URL,
): { ok: true; value: z.infer<S> } | { ok: false; response: NextResponse } {
  const raw = Object.fromEntries(url.searchParams.entries());
  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      response: jsonError(
        400,
        "VALIDATION_ERROR",
        "Invalid query parameters",
        z.flattenError(result.error).fieldErrors,
      ),
    };
  }
  return { ok: true, value: result.data };
}

export async function parseBody<S extends z.ZodType>(
  schema: S,
  request: Request,
): Promise<
  { ok: true; value: z.infer<S> } | { ok: false; response: NextResponse }
> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: jsonError(400, "INVALID_JSON", "Request body must be JSON"),
    };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      response: jsonError(
        400,
        "VALIDATION_ERROR",
        "Invalid request body",
        z.flattenError(result.error).fieldErrors,
      ),
    };
  }
  return { ok: true, value: result.data };
}

/** Map thrown provider/other errors to the API error envelope. */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof MarketProviderError) {
    switch (err.code) {
      case "INVALID_SYMBOL":
        return jsonError(400, err.code, err.message);
      case "UNSUPPORTED_INTERVAL":
        return jsonError(400, err.code, err.message);
      case "RATE_LIMITED":
        return jsonError(429, err.code, err.message, undefined, {
          "Retry-After": String(err.retryAfterSeconds ?? 5),
        });
      case "UPSTREAM_ERROR":
        return jsonError(502, err.code, err.message);
    }
  }
  console.error("Unhandled API error:", err);
  return jsonError(500, "INTERNAL_ERROR", "Something went wrong");
}

// ---------------------------------------------------------------------------
// Inbound rate limiting: a light guard against runaway client loops.
// ---------------------------------------------------------------------------

const INBOUND_LIMIT = 60; // requests per window
const INBOUND_WINDOW_MS = 60_000;

const globalStore = globalThis as unknown as {
  __inboundRate?: Map<string, { count: number; windowStart: number }>;
};

export function checkInboundRate(request: Request): NextResponse | null {
  const map = (globalStore.__inboundRate ??= new Map());
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const now = Date.now();
  const entry = map.get(ip);
  if (!entry || now - entry.windowStart >= INBOUND_WINDOW_MS) {
    map.set(ip, { count: 1, windowStart: now });
    return null;
  }
  entry.count += 1;
  if (entry.count > INBOUND_LIMIT) {
    const retryAfter = Math.ceil(
      (entry.windowStart + INBOUND_WINDOW_MS - now) / 1_000,
    );
    return jsonError(
      429,
      "RATE_LIMITED",
      "Too many requests — slow down.",
      undefined,
      { "Retry-After": String(retryAfter) },
    );
  }
  return null;
}
