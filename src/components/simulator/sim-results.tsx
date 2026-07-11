"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { InfoHint } from "@/components/common/info-hint";
import { HELP } from "@/lib/help-copy";
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
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {hint && (
          <InfoHint
            hint={hint}
            label={`About ${label.toLowerCase()}`}
            className="[&_svg]:size-3"
          />
        )}
      </span>
      <span className={cn("font-mono text-xs tabular-nums", valueClass)}>
        {value}
      </span>
    </div>
  );
}

export function SimResults({ result }: { result: SimulationDTO | null }) {
  if (!result) {
    return (
      <p className="p-3 text-center text-xs text-muted-foreground">
        After you generate and save a chart, set up a pretend trade above and
        press Run simulation. Results appear here.
      </p>
    );
  }

  const exitLabel = EXIT_LABELS[result.exitReason] ?? result.exitReason;
  const exitHint =
    HELP.exitReasons[result.exitReason as keyof typeof HELP.exitReasons];
  const liquidated = result.exitReason === "LIQUIDATED";

  return (
    <section aria-label="Simulation results" className="flex flex-col gap-2 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger type="button" aria-label="Why the trade ended">
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
          </TooltipTrigger>
          {exitHint && (
            <TooltipContent className="max-w-64 text-left leading-relaxed">
              {exitHint}
            </TooltipContent>
          )}
        </Tooltip>
        {result.ambiguousCandle && (
          <Tooltip>
            <TooltipTrigger type="button" aria-label="About ambiguous candles">
              <Badge className="bg-warning/15 text-warning border-warning/40">
                Ambiguous candle
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-64 text-left leading-relaxed">
              {HELP.badges.ambiguousCandle}
            </TooltipContent>
          </Tooltip>
        )}
        {result.liquidationBreached && !liquidated && (
          <Tooltip>
            <TooltipTrigger
              type="button"
              aria-label="About the liquidation level being touched"
            >
              <Badge className="bg-loss/15 text-loss border-loss/40">
                Liq level touched
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-64 text-left leading-relaxed">
              {HELP.badges.liqTouched}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="rounded-md border border-border/60 bg-card/50 px-3 py-2">
        <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          Net result
          <InfoHint
            hint={HELP.simResults.netPnl}
            label="About the net result"
            className="[&_svg]:size-3"
          />
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
        <Row
          label="Position size"
          value={`${formatPrice(result.positionSizeQuote)} USDT`}
          hint={HELP.simResults.positionSize}
        />
        <Row
          label="Quantity"
          value={formatPrice(result.quantityBase)}
          hint={HELP.simResults.quantity}
        />
        <Row
          label="Effective entry"
          value={formatPrice(result.effectiveEntryPrice)}
          hint={HELP.simResults.effectiveEntry}
        />
        <Row
          label="Effective exit"
          value={formatPrice(result.effectiveExitPrice)}
          hint={HELP.simResults.effectiveExit}
        />
        <Row
          label="Liquidation est."
          value={formatPrice(result.liquidationPrice)}
          valueClass="text-loss"
          hint={HELP.simResults.liquidation}
        />
        <Row
          label="PnL before fees"
          value={formatQuote(result.grossPnl)}
          valueClass={signClass(result.grossPnl)}
          hint={HELP.simResults.grossPnl}
        />
        <Row
          label="Fees"
          value={formatQuote(result.totalFees === "0" ? "0" : `-${result.totalFees}`)}
          hint={HELP.simResults.fees}
        />
        <Row
          label="Risk / reward"
          value={result.riskRewardRatio ? `1 : ${Number(result.riskRewardRatio).toFixed(2)}` : "—"}
          hint={HELP.simResults.riskReward}
        />
        <Row
          label="Best point (MFE)"
          value={formatPct(result.mfePct, { sign: false })}
          valueClass="text-profit"
          hint={HELP.simResults.mfe}
        />
        <Row
          label="Worst point (MAE)"
          value={formatPct(result.maePct, { sign: false })}
          valueClass="text-loss"
          hint={HELP.simResults.mae}
        />
        <Row
          label="Time in trade"
          value={result.timeInTradeMs !== null ? formatDurationMs(result.timeInTradeMs) : "—"}
          hint={HELP.simResults.timeInTrade}
        />
      </div>
    </section>
  );
}
