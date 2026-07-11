"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/common/error-state";
import { FiltersBar } from "./filters-bar";
import {
  useDeleteEvent,
  useEvents,
  type EventFilters,
  type EventWithStats,
} from "@/hooks/use-events";
import { useTerminalState } from "@/hooks/use-terminal-state";
import { formatEpochMs } from "@/lib/time";
import { formatPct, signClass } from "@/lib/format";

/**
 * Bottom-panel saved analyses. Clicking a row replays the event's params
 * into the terminal (chart + stats reload from the market API; stored
 * statistics remain the snapshot of record in the DB).
 */
export function SavedAnalysesTable() {
  const [filters, setFilters] = useState<EventFilters>({});
  const { data, isLoading, error } = useEvents(filters);
  const deleteEvent = useDeleteEvent();
  const { generate, setSavedEventId } = useTerminalState();

  const loadEvent = (event: EventWithStats) => {
    generate({
      symbol: event.ticker,
      exchange: event.exchange,
      market: event.market === "PERP" ? "perp" : "spot",
      interval: "1m",
      eventTime: event.eventTime,
      timezone: event.timezone,
      lookbackMinutes: event.stats?.lookbackMinutes ?? 60,
      lookforwardMinutes: event.stats?.lookforwardMinutes ?? 120,
      headline: event.headline ?? undefined,
      source: event.source ?? undefined,
      url: event.url ?? undefined,
      notes: event.notes ?? undefined,
      category: event.category,
    });
    setSavedEventId(event.id);
    toast.info(`Loaded ${event.ticker} — ${event.headline ?? "saved event"}`);
  };

  if (error) return <ErrorState error={error} title="Could not load saved analyses" />;

  return (
    <div className="flex h-full flex-col">
      <FiltersBar filters={filters} onChange={setFilters} />
      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? (
          <div className="space-y-1.5 p-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title="No saved analyses yet"
            hint="Generate a chart and press “Save analysis” to build your research library."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Time (UTC)</TableHead>
                <TableHead scope="col">Ticker</TableHead>
                <TableHead scope="col">Market</TableHead>
                <TableHead scope="col">Category</TableHead>
                <TableHead scope="col">Headline</TableHead>
                <TableHead scope="col" className="text-right">
                  High
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Low
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Sims
                </TableHead>
                <TableHead scope="col" aria-label="Actions" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((event) => (
                <TableRow
                  key={event.id}
                  className="cursor-pointer"
                  onClick={() => loadEvent(event)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") loadEvent(event);
                  }}
                >
                  <TableCell className="whitespace-nowrap font-mono text-xs">
                    {formatEpochMs(event.eventTime, "UTC", "yyyy-MM-dd HH:mm")}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-semibold">
                    {event.ticker}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px]">
                      {event.market}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs capitalize">
                    {event.category.toLowerCase().replace(/_/g, " ")}
                  </TableCell>
                  <TableCell className="max-w-64 truncate text-xs">
                    {event.headline ?? "—"}
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono text-xs ${signClass(event.stats?.highAfterPct)}`}
                  >
                    {formatPct(event.stats?.highAfterPct ?? null)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono text-xs ${signClass(event.stats?.lowAfterPct)}`}
                  >
                    {formatPct(event.stats?.lowAfterPct ?? null)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {event.simulationCount}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-6"
                      aria-label={`Delete ${event.ticker} analysis`}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteEvent.mutate(event.id, {
                          onSuccess: () => toast.success("Analysis deleted"),
                        });
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
