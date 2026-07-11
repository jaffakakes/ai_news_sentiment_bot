"use client";

import { AlertTriangle } from "lucide-react";
import { ApiClientError } from "@/hooks/api";

/**
 * Honest error card: shows the server's actual message (including
 * "no data — symbol may not have traded yet" notes) rather than a
 * generic failure line.
 */
export function ErrorState({
  error,
  title = "Could not load data",
}: {
  error: unknown;
  title?: string;
}) {
  const message =
    error instanceof ApiClientError
      ? error.message
      : error instanceof Error
        ? error.message
        : "Unknown error";

  return (
    <div
      role="alert"
      className="flex h-full min-h-32 flex-col items-center justify-center gap-2 rounded-md border border-loss/30 bg-loss/5 p-6 text-center"
    >
      <AlertTriangle className="size-5 text-loss" aria-hidden />
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-md text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

export function EmptyState({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex h-full min-h-32 flex-col items-center justify-center gap-1 p-6 text-center">
      <p className="text-sm text-muted-foreground">{title}</p>
      {hint && <p className="text-xs text-muted-foreground/70">{hint}</p>}
    </div>
  );
}
