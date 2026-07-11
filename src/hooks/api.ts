"use client";

/**
 * Client-side API access. Every response uses the { data } / { error }
 * envelope; this helper unwraps it and throws a typed ApiClientError so
 * components can show the server's honest message.
 */

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

/** "takeProfit" → "Take profit" */
function humanizeField(field: string): string {
  const spaced = field.replace(/([A-Z])/g, " $1").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Prefer per-field validation messages (zod fieldErrors in error.details)
 * over the generic envelope message, so toasts say what is actually wrong.
 */
function errorMessage(
  error: { message: string; details?: unknown } | undefined,
  status: number,
): string {
  if (!error) return `Request failed (HTTP ${status})`;
  if (error.details && typeof error.details === "object") {
    const lines = Object.entries(error.details as Record<string, unknown>)
      .filter(([, messages]) => Array.isArray(messages) && messages.length > 0)
      .map(
        ([field, messages]) =>
          `${humanizeField(field)}: ${(messages as string[])[0]}`,
      );
    if (lines.length > 0) return lines.join("; ");
  }
  return error.message;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (response.status === 204) return undefined as T;
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiClientError(
      "BAD_RESPONSE",
      `Unexpected response (HTTP ${response.status})`,
      response.status,
    );
  }
  const envelope = body as {
    data?: T;
    error?: { code: string; message: string; details?: unknown };
  };
  if (!response.ok || envelope.error) {
    throw new ApiClientError(
      envelope.error?.code ?? "UNKNOWN",
      errorMessage(envelope.error, response.status),
      response.status,
      envelope.error?.details,
    );
  }
  return envelope.data as T;
}
