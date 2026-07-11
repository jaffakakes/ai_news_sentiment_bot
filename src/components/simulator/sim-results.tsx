"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SimulationDTO } from "@/lib/db/serializers";
import {
  formatPct,
  formatPrice,
  formatQuote,
  signClass,
} from "@/lib/format";
import { formatDurationMs } from "@/lib/time";
import { cn } from "@/lib/utils";

const EXIT_LABELS: Record<string, string> = {
  TAKE_PROFIT: "Take profit hit",
  STOP_LOSS: "Stop loss hit",
  MANUAL_EXIT: "Manual exit",
  LIQUIDATED: "Liquidated",
  WINDOW_END: "Window end",
};

function Row({
  label,
  value,
  valueClass,
  hint,
}: {
  label: string;
  value: string;
  valueClass?: string;
  hint?: string;
}) {
  const content = (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("font-mono text-xs tabular-nums", valueClass)}>
        {value}
      </span>
    </div>
  );
  if (!hint) return content;
  return (
    <Tooltip>
      <TooltipTrigger className="w-full text-left">{content}</TooltipTrigger>
      <TooltipContent className="max-w-64">{hint}</TooltipContent>
    </Tooltip>
  );
}

export function SimResults({ result }: { result: SimulationDTO | null }) {
  if (!result) {
    return (
      <p className="p-3 text-center text-xs text-muted-foreground">
        Run a simulation to see hypothetical results here.
      </p>
    );
  }

  const exitLabel = EXIT_LABELS[result.exitReason] ?? result.exitReason;
  const liquidated = result.exitReason === "LIQUIDATED";

  return (
    <section aria-label="Simulation results" className="flex flex-col gap-2 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge
          className={cn(
            liquidated || result.exitReason === "STOP_LOSS"
              ? "bg-loss/15 text-loss border-loss/40"
              : result.exitReason === "TAKE_PROFIT"
                ? "bg-profit/15 text-profit border-profit/40"
                : "bg-secondary",
          )}
        >
          {exitLabel}
        </Badge>
        {result.ambiguousCandle && (
          <Tooltip>
            <TooltipTrigger>
              <Badge className="bg-warning/15 text-warning border-warning/40">
                Ambiguous candle
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-64">
              Take profit and stop loss both fell inside one candle. OHLC data
              cannot show which was touched first, so the worse outcome (stop
              loss) is assumed.
            </TooltipContent>
          </Tooltip>
        )}
        {result.liquidationBreached && !liquidated && (
          <Badge className="bg-loss/15 text-loss border-loss/40">
            Liq level touched
          </Badge>
        )}
      </div>

      <div className="rounded-md border border-border/60 bg-card/50 px-3 py-2">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Net PnL
        </p>
        <p className={cn("font-mono text-xl tabular-nums", signClass(result.netPnl))}>
          {formatQuote(result.netPnl)}
        </p>
        <p className={cn("font-mono text-xs", signClass(result.returnOnMarginPct))}>
          {formatPct(result.returnOnMarginPct)} on margin ·{" "}
          {formatPct(result.returnOnAccountPct)} on account
        </p>
      </div>

      <div>
        <Row label="Position size" value={`${formatPrice(result.positionSizeQuote)} USDT`} />
        <Row label="Quantity" value={formatPrice(result.quantityBase)} />
        <Row
          label="Effective entry"
          value={formatPrice(result.effectiveEntryPrice)}
          hint="Entry after adverse slippage"
        />
        <Row
          label="Effective exit"
          value={formatPrice(result.effectiveExitPrice)}
          hint="Exit after adverse slippage (take-profit limit fills get none)"
        />
        <Row
          label="Liquidation est."
          value={formatPrice(result.liquidationPrice)}
          valueClass="text-loss"
          hint="Isolated-margin estimate with a flat 0.5% maintenance rate. Real Binance liquidation uses tiered maintenance brackets, mark price and a liquidation fee — treat this as approximate."
        />
        <Row label="Gross PnL" value={formatQuote(result.grossPnl)} valueClass={signClass(result.grossPnl)} />
        <Row label="Fees" value={formatQuote(result.totalFees === "0" ? "0" : `-${result.totalFees}`)} />
        <Row
          label="Risk / reward"
          value={result.riskRewardRatio ? `1 : ${Number(result.riskRewardRatio).toFixed(2)}` : "—"}
        />
        <Row
          label="MFE"
          value={formatPct(result.mfePct, { sign: false })}
          valueClass="text-profit"
          hint="Max favorable excursion — the best the position looked before exit"
        />
        <Row
          label="MAE (max drawdown)"
          value={formatPct(result.maePct, { sign: false })}
          valueClass="text-loss"
          hint="Max adverse excursion — the worst the position looked before exit"
        />
        <Row
          label="Time in trade"
          value={result.timeInTradeMs !== null ? formatDurationMs(result.timeInTradeMs) : "—"}
        />
      </div>
    </section>
  );
}
