"use client";

import { StatTile } from "./stat-tile";
import { ErrorState } from "@/components/common/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { EventStatsResult } from "@/lib/stats/event-stats";
import {
  formatCompactVolume,
  formatPct,
  formatPrice,
  signClass,
} from "@/lib/format";
import { formatDurationMs } from "@/lib/time";
import { HELP } from "@/lib/help-copy";

export function StatsPanel({
  stats,
  isLoading,
  error,
}: {
  stats: EventStatsResult | undefined;
  isLoading: boolean;
  error: unknown;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-md" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-3">
        <ErrorState error={error} title="Could not compute event statistics" />
      </div>
    );
  }
  if (!stats) return null;

  return (
    <section aria-label="Event statistics" className="p-3">
      {!stats.dataComplete && (
        <p className="mb-2 rounded border border-warning/40 bg-warning/10 px-2 py-1 text-xs text-warning">
          Partial data — {HELP.badges.partialData}
        </p>
      )}
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        <StatTile
          label="Price before"
          value={formatPrice(stats.priceBefore)}
          hint={HELP.stats.priceBefore}
        />
        <StatTile
          label="Price at event"
          value={formatPrice(stats.priceAtEvent)}
          hint={HELP.stats.priceAtEvent}
        />
        <StatTile
          label="High after"
          value={`${formatPrice(stats.highAfter)} (${formatPct(stats.highAfterPct)})`}
          valueClass={signClass(stats.highAfterPct)}
          hint={HELP.stats.highAfter}
        />
        <StatTile
          label="Low after"
          value={`${formatPrice(stats.lowAfter)} (${formatPct(stats.lowAfterPct)})`}
          valueClass={signClass(stats.lowAfterPct)}
          hint={HELP.stats.lowAfter}
        />
        <StatTile
          label="Time to high"
          value={formatDurationMs(stats.timeToHighMs)}
          hint={HELP.stats.timeToHigh}
        />
        <StatTile
          label="Time to low"
          value={formatDurationMs(stats.timeToLowMs)}
          hint={HELP.stats.timeToLow}
        />
        {(Object.entries(stats.returns) as [string, string | null][]).map(
          ([horizon, value]) => (
            <StatTile
              key={horizon}
              label={`Return +${horizon}`}
              value={formatPct(value)}
              valueClass={signClass(value)}
              hint={
                value === null
                  ? HELP.stats.returnMissing
                  : HELP.stats.returnHorizon
              }
            />
          ),
        )}
        <StatTile
          label="Volatility (after)"
          value={stats.postEventVolatilityPct ? formatPct(stats.postEventVolatilityPct, { sign: false }) : "—"}
          hint={HELP.stats.volatilityPost}
        />
        <StatTile
          label="Volume before"
          value={formatCompactVolume(stats.volumeBefore)}
          hint={HELP.stats.volumeBefore}
        />
        <StatTile
          label="Volume after"
          value={formatCompactVolume(stats.volumeAfter)}
          hint={HELP.stats.volumeAfter}
        />
        <StatTile
          label="Volume change"
          value={formatPct(stats.volumeChangePct)}
          valueClass={signClass(stats.volumeChangePct)}
          hint={HELP.stats.volumeChange}
        />
        <StatTile
          label="Avg candle range"
          value={formatPct(stats.avgCandleRangePct, { sign: false })}
          hint={HELP.stats.avgCandleRange}
        />
        <StatTile
          label="Candles (pre/post)"
          value={`${stats.candleCountBefore} / ${stats.candleCountAfter}`}
          hint={HELP.stats.candleCount}
        />
      </dl>
    </section>
  );
}
