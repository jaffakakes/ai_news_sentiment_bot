"use client";

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
import { InfoHint } from "@/components/common/info-hint";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HELP } from "@/lib/help-copy";
import {
  useDeleteSimulation,
  useRecentSimulations,
  type SimulationWithEvent,
} from "@/hooks/use-events";
import { useTerminalState } from "@/hooks/use-terminal-state";
import { formatEpochMs } from "@/lib/time";
import { formatPct, formatQuote, signClass } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Bottom-panel historical simulations across all events. Clicking a row
 * reloads its event into the terminal; the stored outputs remain the
 * snapshot of record.
 */
export function SimulationsTable({
  onSelect,
}: {
  onSelect: (sim: SimulationWithEvent) => void;
}) {
  const { data, isLoading, error } = useRecentSimulations();
  const deleteSimulation = useDeleteSimulation();
  const { generate, setSavedEventId } = useTerminalState();

  const loadSimulation = (sim: SimulationWithEvent) => {
    generate({
      symbol: sim.event.ticker,
      exchange: sim.event.exchange,
      market: sim.event.market === "PERP" ? "perp" : "spot",
      interval: "1m",
      eventTime: sim.event.eventTime,
      timezone: sim.event.timezone,
      lookbackMinutes: 60,
      lookforwardMinutes: 120,
      headline: sim.event.headline ?? undefined,
      category: sim.event.category,
    });
    setSavedEventId(sim.event.id);
    onSelect(sim);
    toast.info(`Loaded ${sim.event.ticker} simulation`);
  };

  if (error) return <ErrorState error={error} title="Could not load simulations" />;

  return (
    <div className="h-full overflow-auto">
      {isLoading ? (
        <div className="space-y-1.5 p-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="No simulations yet"
          hint="Save an analysis first, then use the Trade simulator panel to replay a pretend trade — it will show up here."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Run at (UTC)</TableHead>
              <TableHead scope="col">Ticker</TableHead>
              <TableHead scope="col">Dir</TableHead>
              <TableHead scope="col" className="text-right">Lev</TableHead>
              <TableHead scope="col" className="text-right">Entry</TableHead>
              <TableHead scope="col">Exit</TableHead>
              <TableHead scope="col" className="text-right">Net PnL</TableHead>
              <TableHead scope="col" className="text-right">
                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                  Return on margin
                  <InfoHint
                    hint={HELP.badges.rom}
                    label="About return on margin"
                    className="[&_svg]:size-3"
                  />
                </span>
              </TableHead>
              <TableHead scope="col" aria-label="Actions" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((sim) => (
              <TableRow
                key={sim.id}
                className="cursor-pointer"
                onClick={() => loadSimulation(sim)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") loadSimulation(sim);
                }}
              >
                <TableCell className="whitespace-nowrap font-mono text-xs">
                  {formatEpochMs(sim.createdAt, "UTC", "yyyy-MM-dd HH:mm")}
                </TableCell>
                <TableCell className="font-mono text-xs font-semibold">
                  {sim.event.ticker}
                </TableCell>
                <TableCell>
                  <Badge
                    className={cn(
                      "text-[10px] uppercase",
                      sim.direction === "LONG"
                        ? "bg-profit/15 text-profit border-profit/40"
                        : "bg-loss/15 text-loss border-loss/40",
                    )}
                  >
                    {sim.direction}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {Number(sim.leverage)}x
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {Number(sim.entryPrice).toLocaleString()}
                </TableCell>
                <TableCell className="text-xs capitalize">
                  {sim.exitReason.toLowerCase().replace(/_/g, " ")}
                  {sim.ambiguousCandle && (
                    <Tooltip>
                      <TooltipTrigger
                        type="button"
                        aria-label="About this warning"
                        className="ml-1 text-warning"
                        onClick={(e) => e.stopPropagation()}
                      >
                        ⚠
                      </TooltipTrigger>
                      <TooltipContent className="max-w-64 text-left leading-relaxed">
                        {HELP.badges.ambiguousCandle}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </TableCell>
                <TableCell
                  className={`text-right font-mono text-xs ${signClass(sim.netPnl)}`}
                >
                  {formatQuote(sim.netPnl)}
                </TableCell>
                <TableCell
                  className={`text-right font-mono text-xs ${signClass(sim.returnOnMarginPct)}`}
                >
                  {formatPct(sim.returnOnMarginPct)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-6"
                    aria-label="Delete simulation"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSimulation.mutate(sim.id, {
                        onSuccess: () => toast.success("Simulation deleted"),
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
  );
}
