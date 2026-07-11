"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRunSimulation } from "@/hooks/use-events";
import { useTerminalState } from "@/hooks/use-terminal-state";
import { ApiClientError } from "@/hooks/api";
import { InfoHint } from "@/components/common/info-hint";
import { HELP } from "@/lib/help-copy";
import type { SimulationDTO } from "@/lib/db/serializers";
import { cn } from "@/lib/utils";

interface SimFormProps {
  defaultEntryPrice: string | undefined; // priceAtEvent, once stats load
  onResult: (result: SimulationDTO) => void;
}

/**
 * Trade simulator inputs. Simulation requires a SAVED event (results are
 * persisted against it); the run button says so when unsaved.
 */
export function SimForm({ defaultEntryPrice, onResult }: SimFormProps) {
  const { params, savedEventId } = useTerminalState();
  const runSimulation = useRunSimulation(savedEventId);

  const [direction, setDirection] = useState<"long" | "short">("long");
  const [accountSize, setAccountSize] = useState("10000");
  const [margin, setMargin] = useState("500");
  const [leverage, setLeverage] = useState("10");
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [takerFee, setTakerFee] = useState("0.05");
  const [makerFee, setMakerFee] = useState("0.02");
  const [slippage, setSlippage] = useState("0.02");

  // Pre-fill entry with the price at event when a new chart is generated
  // (adjust-state-during-render pattern; avoids an effect).
  const [prevDefault, setPrevDefault] = useState(defaultEntryPrice);
  if (defaultEntryPrice !== prevDefault) {
    setPrevDefault(defaultEntryPrice);
    if (defaultEntryPrice) setEntryPrice(defaultEntryPrice);
  }

  const disabled = !params || !savedEventId;

  const onRun = () => {
    if (!params || !savedEventId) return;
    runSimulation.mutate(
      {
        direction,
        accountSize,
        margin,
        leverage,
        entryPrice,
        entryTime: params.eventTime,
        exitPrice: exitPrice || undefined,
        stopLoss: stopLoss || undefined,
        takeProfit: takeProfit || undefined,
        takerFeePct: takerFee,
        makerFeePct: makerFee,
        slippagePct: slippage,
        maintenanceMarginRatePct: "0.5",
      },
      {
        onSuccess: (result) => onResult(result),
        onError: (err) =>
          toast.error(
            err instanceof ApiClientError ? err.message : "Simulation failed",
          ),
      },
    );
  };

  const field = (
    id: string,
    label: string,
    value: string,
    set: (v: string) => void,
    opts?: { placeholder?: string; hint?: string },
  ) => (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <Label htmlFor={id} className="text-xs">
          {label}
        </Label>
        {opts?.hint && (
          <InfoHint
            hint={opts.hint}
            label={`About ${label.toLowerCase()}`}
            className="[&_svg]:size-3"
          />
        )}
      </div>
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(e) => set(e.target.value)}
        placeholder={opts?.placeholder}
        className="h-8 font-mono text-sm"
        autoComplete="off"
      />
    </div>
  );

  return (
    <form
      className="flex flex-col gap-2.5 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        onRun();
      }}
    >
      <div className="flex items-center gap-1">
        <span className="text-xs font-medium">Direction</span>
        <InfoHint
          hint={HELP.sim.direction}
          label="About long and short"
          className="[&_svg]:size-3"
        />
      </div>
      <div
        className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1"
        role="radiogroup"
        aria-label="Direction"
      >
        {(["long", "short"] as const).map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={direction === d}
            onClick={() => setDirection(d)}
            className={cn(
              "rounded px-2 py-1 text-xs font-semibold uppercase tracking-wide transition-colors",
              direction === d
                ? d === "long"
                  ? "bg-profit/20 text-profit"
                  : "bg-loss/20 text-loss"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {field("sim-account", "Account (USDT)", accountSize, setAccountSize, {
          hint: HELP.sim.account,
        })}
        {field("sim-margin", "Margin (USDT)", margin, setMargin, {
          hint: HELP.sim.margin,
        })}
        {field("sim-leverage", "Leverage", leverage, setLeverage, {
          hint: HELP.sim.leverage,
        })}
        {field("sim-entry", "Entry price", entryPrice, setEntryPrice, {
          hint: HELP.sim.entryPrice,
        })}
        {field("sim-sl", "Stop loss", stopLoss, setStopLoss, {
          placeholder: "optional",
          hint: HELP.sim.stopLoss,
        })}
        {field("sim-tp", "Take profit", takeProfit, setTakeProfit, {
          placeholder: "optional",
          hint: HELP.sim.takeProfit,
        })}
        {field("sim-exit", "Manual exit", exitPrice, setExitPrice, {
          placeholder: "optional",
          hint: HELP.sim.manualExit,
        })}
        {field("sim-slippage", "Slippage %", slippage, setSlippage, {
          hint: HELP.sim.slippage,
        })}
        {field("sim-taker", "Taker fee %", takerFee, setTakerFee, {
          hint: HELP.sim.takerFee,
        })}
        {field("sim-maker", "Maker fee %", makerFee, setMakerFee, {
          hint: HELP.sim.makerFee,
        })}
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={disabled || runSimulation.isPending || !entryPrice}
      >
        {runSimulation.isPending
          ? "Simulating…"
          : disabled
            ? "Save the analysis first"
            : "Run simulation"}
      </Button>
      <p className="text-center text-[10px] text-muted-foreground">
        A practice replay against real historical prices. No real money —
        nothing is ever traded.
      </p>
    </form>
  );
}
