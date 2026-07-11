"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./api";
import type { CandleResult } from "@/lib/market/types";
import type { EventStatsResult } from "@/lib/stats/event-stats";
import type { EventParams } from "./use-terminal-state";

export function useCandles(params: EventParams | null) {
  return useQuery({
    queryKey: [
      "candles",
      params?.symbol,
      params?.market,
      params?.interval,
      params?.eventTime,
      params?.lookbackMinutes,
      params?.lookforwardMinutes,
    ],
    enabled: params !== null,
    queryFn: () => {
      const p = params!;
      const search = new URLSearchParams({
        symbol: p.symbol,
        exchange: p.exchange,
        market: p.market,
        interval: p.interval,
        eventTime: String(p.eventTime),
        lookbackMinutes: String(p.lookbackMinutes),
        lookforwardMinutes: String(p.lookforwardMinutes),
      });
      return apiFetch<CandleResult>(`/api/candles?${search}`);
    },
    staleTime: 5 * 60_000,
  });
}

export function useEventStats(params: EventParams | null) {
  return useQuery({
    queryKey: [
      "event-stats",
      params?.symbol,
      params?.market,
      params?.eventTime,
      params?.lookbackMinutes,
      params?.lookforwardMinutes,
    ],
    enabled: params !== null,
    queryFn: () => {
      const p = params!;
      const search = new URLSearchParams({
        symbol: p.symbol,
        exchange: p.exchange,
        market: p.market,
        eventTime: String(p.eventTime),
        lookbackMinutes: String(p.lookbackMinutes),
        lookforwardMinutes: String(p.lookforwardMinutes),
      });
      return apiFetch<EventStatsResult>(`/api/event-stats?${search}`);
    },
    staleTime: 5 * 60_000,
  });
}
