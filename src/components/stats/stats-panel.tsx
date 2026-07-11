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
          Partial data — the exchange did not return the full requested window.
          Statistics cover only the candles that exist.
        </p>
      )}
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        <StatTile label="Price before" value={formatPrice(stats.priceBefore)} />
        <StatTile label="Price at event" value={formatPrice(stats.priceAtEvent)} />
        <StatTile
          label="High after"
          value={`${formatPrice(stats.highAfter)} (${formatPct(stats.highAfterPct)})`}
          valueClass={signClass(stats.highAfterPct)}
        />
        <StatTile
          label="Low after"
          value={`${formatPrice(stats.lowAfter)} (${formatPct(stats.lowAfterPct)})`}
          valueClass={signClass(stats.lowAfterPct)}
        />
        <StatTile label="Time to high" value={formatDurationMs(stats.timeToHighMs)} />
        <StatTile label="Time to low" value={formatDurationMs(stats.timeToLowMs)} />
        {(Object.entries(stats.returns) as [string, string | null][]).map(
          ([horizon, value]) => (
            <StatTile
              key={horizon}
              label={`Return +${horizon}`}
              value={formatPct(value)}
              valueClass={signClass(value)}              title={value === null ? "No candle at this horizon — not interpolated" : undefined}
            />
          ),
        )}
        <StatTile
          label="Volatility (post)"
          value={stats.postEventVolatilityPct ? formatPct(stats.postEventVolatilityPct, { sign: false }) : "—"}
          title="Sample stddev of 1m returns after the event"
        />
        <StatTile
          label="Vol before"
          value={formatCompactVolume(stats.volumeBefore)}
          title="Quote volume over the lookback window"
        />
        <StatTile
          label="Vol after"
          value={formatCompactVolume(stats.volumeAfter)}
          title="Quote volume over the lookforward window"
        />
        <StatTile
          label="Vol change"
          value={formatPct(stats.volumeChangePct)}
          valueClass={signClass(stats.volumeChangePct)}
        />
        <StatTile
          label="Avg candle range"
          value={formatPct(stats.avgCandleRangePct, { sign: false })}
        />
        <StatTile
          label="Candles (pre/post)"
          value={`${stats.candleCountBefore} / ${stats.candleCountAfter}`}
        />
      </dl>
    </section>
  );
}
