"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Interval, MarketType } from "@/lib/market/types";
import { formatEpochMs } from "@/lib/time";
import { cn } from "@/lib/utils";

const INTERVALS: Interval[] = ["1s", "1m", "5m", "15m", "1h"];

interface ChartToolbarProps {
  symbol: string;
  market: MarketType;
  interval: Interval;
  eventTime: number;
  timezone: string;
  partial: boolean;
  partialNote?: string;
  onIntervalChange: (interval: Interval) => void;
}

export function ChartToolbar({
  symbol,
  market,
  interval,
  eventTime,
  timezone,
  partial,
  partialNote,
  onIntervalChange,
}: ChartToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
      <span className="font-mono text-sm font-semibold">{symbol}</span>
      <Badge variant="secondary" className="uppercase">
        {market === "perp" ? "Perp" : "Spot"}
      </Badge>
      <span className="text-xs text-muted-foreground">
        Event: {formatEpochMs(eventTime, timezone)}
      </span>
      {partial && (
        <Tooltip>
          <TooltipTrigger>
            <Badge className="bg-warning/15 text-warning border-warning/40">
              Partial data
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-64">
            {partialNote ?? "The exchange returned less data than requested."}
          </TooltipContent>
        </Tooltip>
      )}
      <div
        className="ml-auto flex items-center gap-1"
        role="group"
        aria-label="Chart timeframe"
      >
        {INTERVALS.map((candidate) => {
          const unsupported = candidate === "1s" && market === "perp";
          return (
            <Button
              key={candidate}
              size="sm"
              variant={candidate === interval ? "secondary" : "ghost"}
              className={cn("h-7 px-2 font-mono text-xs", {
                "opacity-40": unsupported,
              })}
              disabled={unsupported}
              title={
                unsupported ? "Binance futures klines start at 1m" : undefined
              }
              aria-pressed={candidate === interval}
              onClick={() => onIntervalChange(candidate)}
            >
              {candidate}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
