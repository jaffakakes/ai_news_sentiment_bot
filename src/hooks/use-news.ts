"use client";

import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "./api";
import type { ExtractNewsResponse } from "@/lib/news/registry";

export function useExtractNews() {
  return useMutation({
    mutationFn: (url: string) =>
      apiFetch<ExtractNewsResponse>("/api/news/extract", {
        method: "POST",
        body: JSON.stringify({ url }),
      }),
  });
}
