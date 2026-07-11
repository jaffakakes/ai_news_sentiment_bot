"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { Interval, MarketType } from "@/lib/market/types";

export interface EventParams {
  symbol: string;
  exchange: string;
  market: MarketType;
  interval: Interval;
  eventTime: number; // epoch ms UTC
  timezone: string; // IANA, display-only
  lookbackMinutes: number;
  lookforwardMinutes: number;
  headline?: string;
  source?: string;
  url?: string;
  notes?: string;
  category: string;
}

interface TerminalState {
  params: EventParams | null;
  savedEventId: string | null;
  generate: (params: EventParams) => void;
  setInterval: (interval: Interval) => void;
  setSavedEventId: (id: string | null) => void;
}

const TerminalContext = createContext<TerminalState | null>(null);

export function TerminalStateProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [params, setParams] = useState<EventParams | null>(null);
  const [savedEventId, setSavedEventId] = useState<string | null>(null);

  const generate = useCallback((next: EventParams) => {
    setParams(next);
    setSavedEventId(null);
  }, []);

  const setInterval = useCallback((interval: Interval) => {
    setParams((prev) => (prev ? { ...prev, interval } : prev));
  }, []);

  const value = useMemo(
    () => ({ params, savedEventId, generate, setInterval, setSavedEventId }),
    [params, savedEventId, generate, setInterval],
  );

  return (
    <TerminalContext.Provider value={value}>
      {children}
    </TerminalContext.Provider>
  );
}

export function useTerminalState(): TerminalState {
  const ctx = useContext(TerminalContext);
  if (!ctx) {
    throw new Error("useTerminalState must be used within TerminalStateProvider");
  }
  return ctx;
}
