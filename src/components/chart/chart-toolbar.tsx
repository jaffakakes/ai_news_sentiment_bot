"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HELP } from "@/lib/help-copy";
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
          <TooltipContent className="max-w-64 text-left leading-relaxed">
            {partialNote ?? HELP.badges.partialData}
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
          const button = (
            <Button
              key={candidate}
              size="sm"
              variant={candidate === interval ? "secondary" : "ghost"}
              className={cn("h-7 px-2 font-mono text-xs", {
                // pointer-events-none lets the tooltip span receive hover;
                // native title tooltips never fire on disabled elements.
                "pointer-events-none opacity-40": unsupported,
              })}
              disabled={unsupported}
              aria-pressed={candidate === interval}
              onClick={() => onIntervalChange(candidate)}
            >
              {candidate}
            </Button>
          );
          if (!unsupported) return button;
          return (
            <Tooltip key={candidate}>
              <TooltipTrigger
                render={<span className="inline-flex" tabIndex={0} />}
                aria-label="Why 1s is unavailable"
              >
                {button}
              </TooltipTrigger>
              <TooltipContent className="max-w-64 text-left leading-relaxed">
                {HELP.badges.oneSecondPerp}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
