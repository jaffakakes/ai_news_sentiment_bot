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
  ) {
    super(message);
    this.name = "ApiClientError";
  }
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
    error?: { code: string; message: string };
  };
  if (!response.ok || envelope.error) {
    throw new ApiClientError(
      envelope.error?.code ?? "UNKNOWN",
      envelope.error?.message ?? `Request failed (HTTP ${response.status})`,
      response.status,
    );
  }
  return envelope.data as T;
}
