"use client";

import { useMemo, useState } from "react";
import { HeaderBar } from "./header-bar";
import { EventInputForm } from "@/components/event-form/event-input-form";
import { EventChartContainer } from "@/components/chart/event-chart-container";
import type { PriceLevel } from "@/components/chart/event-chart";
import { ChartToolbar } from "@/components/chart/chart-toolbar";
import { HowItWorks } from "@/components/chart/how-it-works";
import { StatsPanel } from "@/components/stats/stats-panel";
import { SimForm } from "@/components/simulator/sim-form";
import { SimResults } from "@/components/simulator/sim-results";
import { SavedAnalysesTable } from "@/components/saved/saved-analyses-table";
import { SimulationsTable } from "@/components/saved/simulations-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/common/error-state";
import {
  TerminalStateProvider,
  useTerminalState,
} from "@/hooks/use-terminal-state";
import { useCandles, useEventStats } from "@/hooks/use-market-data";
import type { SimulationDTO } from "@/lib/db/serializers";

function ChartArea({
  simResult,
}: {
  simResult: SimulationDTO | null;
}) {
  const { params, setInterval } = useTerminalState();
  const candlesQuery = useCandles(params);
  const statsQuery = useEventStats(params);

  const priceLevels = useMemo<PriceLevel[]>(() => {
    if (!simResult) return [];
    const levels: PriceLevel[] = [
      {
        price: Number(simResult.effectiveEntryPrice),
        label: "Entry",
        color: "#3b82f6",
      },
      {
        price: Number(simResult.liquidationPrice),
        label: "Liq est.",
        color: "#ef4444",
        dashed: true,
      },
    ];
    if (simResult.stopLoss) {
      levels.push({
        price: Number(simResult.stopLoss),
        label: "SL",
        color: "#f97316",
        dashed: true,
      });
    }
    if (simResult.takeProfit) {
      levels.push({
        price: Number(simResult.takeProfit),
        label: "TP",
        color: "#22c55e",
        dashed: true,
      });
    }
    return levels;
  }, [simResult]);

  if (!params) {
    return <HowItWorks />;
  }

  return (
    <div className="flex h-full flex-col">
      <ChartToolbar
        symbol={params.symbol}
        market={params.market}
        interval={params.interval}
        eventTime={params.eventTime}
        timezone={params.timezone}
        partial={candlesQuery.data?.partial ?? false}
        partialNote={candlesQuery.data?.note}
        onIntervalChange={setInterval}
      />
      <div className="min-h-0 flex-1">
        {candlesQuery.isLoading ? (
          <Skeleton className="h-full w-full" />
        ) : candlesQuery.error ? (
          <ErrorState error={candlesQuery.error} title="Could not load candles" />
        ) : candlesQuery.data && candlesQuery.data.candles.length > 0 ? (
          <EventChartContainer
            candles={candlesQuery.data.candles}
            eventTime={params.eventTime}
            timezone={params.timezone}
            priceLevels={priceLevels}
          />
        ) : (
          <EmptyState
            title="No candles in this window"
            hint={
              candlesQuery.data?.note ??
              "This coin may not have been trading on this market at that time. Try Spot instead of Perp, or a different date."
            }
          />
        )}
      </div>
      <div className="max-h-56 shrink-0 overflow-auto border-t border-border">
        <StatsPanel
          stats={statsQuery.data}
          isLoading={statsQuery.isLoading}
          error={statsQuery.error}
        />
      </div>
    </div>
  );
}

function SimPanel({
  simResult,
  onResult,
}: {
  simResult: SimulationDTO | null;
  onResult: (result: SimulationDTO) => void;
}) {
  const { params } = useTerminalState();
  const statsQuery = useEventStats(params);
  return (
    <div className="flex h-full flex-col overflow-auto">
      <h2 className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Trade simulator
      </h2>
      <p className="px-3 pt-2 text-[11px] text-muted-foreground/80">
        Replay a practice trade with pretend money. Nothing real is bought or
        sold.
      </p>
      <SimForm
        defaultEntryPrice={statsQuery.data?.priceAtEvent}
        onResult={onResult}
      />
      <div className="border-t border-border">
        <SimResults result={simResult} />
      </div>
    </div>
  );
}

function TerminalInner() {
  const [simResult, setSimResult] = useState<SimulationDTO | null>(null);

  return (
    <div className="flex h-dvh flex-col">
      <HeaderBar />
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[280px_1fr] xl:grid-cols-[300px_1fr_340px]">
        <aside
          aria-label="Event input"
          className="min-h-0 overflow-y-auto border-r border-border"
        >
          <h2 className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Event input
          </h2>
          <p className="px-3 pt-2 text-[11px] text-muted-foreground/80">
            Pick a coin and the moment the news broke.
          </p>
          <EventInputForm />
        </aside>
        <main className="min-h-0 min-w-0 overflow-hidden max-md:min-h-96">
          <ChartArea simResult={simResult} />
        </main>
        <aside
          aria-label="Trade simulator"
          className="min-h-0 overflow-hidden border-l border-border max-xl:border-t max-xl:md:col-span-2"
        >
          <SimPanel simResult={simResult} onResult={setSimResult} />
        </aside>
      </div>
      <section
        aria-label="History"
        className="h-56 shrink-0 border-t border-border"
      >
        <Tabs defaultValue="analyses" className="flex h-full flex-col gap-0">
          <TabsList className="h-8 w-fit rounded-none border-b border-border bg-transparent px-2">
            <TabsTrigger value="analyses" className="text-xs">
              Saved analyses
            </TabsTrigger>
            <TabsTrigger value="simulations" className="text-xs">
              Simulations
            </TabsTrigger>
          </TabsList>
          <TabsContent value="analyses" className="min-h-0 flex-1">
            <SavedAnalysesTable />
          </TabsContent>
          <TabsContent value="simulations" className="min-h-0 flex-1">
            <SimulationsTable onSelect={setSimResult} />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}

export function Terminal() {
  return (
    <TerminalStateProvider>
      <TerminalInner />
    </TerminalStateProvider>
  );
}
