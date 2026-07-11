"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TimezoneSelect } from "./timezone-select";
import { useTerminalState, type EventParams } from "@/hooks/use-terminal-state";
import { useCreateEvent } from "@/hooks/use-events";
import { zonedInputToEpochMs } from "@/lib/time";
import type { Interval, MarketType } from "@/lib/market/types";
import { ApiClientError } from "@/hooks/api";

const CATEGORIES = [
  "OTHER",
  "TOKEN_BURN",
  "LISTING",
  "HACK",
  "PARTNERSHIP",
  "WHALE",
  "ETF",
  "MACRO",
  "UPGRADE",
] as const;

const categoryLabel = (c: string) =>
  c
    .toLowerCase()
    .split("_")
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");

/**
 * Left-sidebar event input. Fast mode needs only ticker + timestamp;
 * headline/source/notes are optional manual-news fields (the Phase 3 URL
 * extractor will pre-fill them).
 */
export function EventInputForm() {
  const { params, generate, savedEventId, setSavedEventId } =
    useTerminalState();
  const createEvent = useCreateEvent();

  const [ticker, setTicker] = useState("BTCUSDT");
  const [datetime, setDatetime] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [market, setMarket] = useState<MarketType>("perp");
  const [interval, setInterval] = useState<Interval>("1m");
  const [lookback, setLookback] = useState("60");
  const [lookforward, setLookforward] = useState("120");
  const [headline, setHeadline] = useState("");
  const [source, setSource] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState<string>("OTHER");

  const buildParams = (): EventParams | null => {
    if (!ticker.trim()) {
      toast.error("Enter a ticker, e.g. BTCUSDT");
      return null;
    }
    if (!datetime) {
      toast.error("Enter the event timestamp");
      return null;
    }
    let eventTime: number;
    try {
      eventTime = zonedInputToEpochMs(datetime, timezone);
    } catch {
      toast.error("Could not parse the timestamp");
      return null;
    }
    if (eventTime > Date.now()) {
      toast.error("Event timestamp is in the future");
      return null;
    }
    return {
      symbol: ticker.trim().toUpperCase(),
      exchange: "binance",
      market,
      interval: interval === "1s" && market === "perp" ? "1m" : interval,
      eventTime,
      timezone,
      lookbackMinutes: Number(lookback) || 60,
      lookforwardMinutes: Number(lookforward) || 120,
      headline: headline.trim() || undefined,
      source: source.trim() || undefined,
      url: url.trim() || undefined,
      notes: notes.trim() || undefined,
      category,
    };
  };

  const onGenerate = () => {
    const next = buildParams();
    if (next) generate(next);
  };

  const onSave = () => {
    const next = buildParams();
    if (!next) return;
    generate(next);
    createEvent.mutate(
      {
        ticker: next.symbol,
        eventTime: next.eventTime,
        timezone: next.timezone,
        exchange: "binance",
        market: next.market,
        category: next.category as (typeof CATEGORIES)[number],
        headline: next.headline,
        url: next.url,
        source: next.source ?? (next.headline ? "manual" : undefined),
        notes: next.notes,
        lookbackMinutes: next.lookbackMinutes,
        lookforwardMinutes: next.lookforwardMinutes,
      },
      {
        onSuccess: (data) => {
          setSavedEventId(data.event.id);
          toast.success("Event saved");
        },
        onError: (err) => {
          toast.error(
            err instanceof ApiClientError ? err.message : "Save failed",
          );
        },
      },
    );
  };

  return (
    <form
      className="flex flex-col gap-3 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        onGenerate();
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="ticker">Ticker</Label>
        <Input
          id="ticker"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="BTCUSDT"
          autoComplete="off"
          className="font-mono uppercase"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="datetime">Event time</Label>
        <Input
          id="datetime"
          type="datetime-local"
          step="1"
          value={datetime}
          onChange={(e) => setDatetime(e.target.value)}
          className="font-mono"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="timezone">Timezone</Label>
        <TimezoneSelect id="timezone" value={timezone} onChange={setTimezone} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="market">Market</Label>
          <Select
            value={market}
            onValueChange={(v) => setMarket(v as MarketType)}
          >
            <SelectTrigger id="market" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="perp">Binance Perp</SelectItem>
              <SelectItem value="spot">Binance Spot</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="interval">Timeframe</Label>
          <Select
            value={interval}
            onValueChange={(v) => setInterval(v as Interval)}
          >
            <SelectTrigger id="interval" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1s" disabled={market === "perp"}>
                1s {market === "perp" ? "(spot only)" : ""}
              </SelectItem>
              <SelectItem value="1m">1m</SelectItem>
              <SelectItem value="5m">5m</SelectItem>
              <SelectItem value="15m">15m</SelectItem>
              <SelectItem value="1h">1h</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="lookback">Lookback (min)</Label>
          <Input
            id="lookback"
            type="number"
            min={1}
            max={1440}
            value={lookback}
            onChange={(e) => setLookback(e.target.value)}
            className="font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lookforward">Forward (min)</Label>
          <Input
            id="lookforward"
            type="number"
            min={1}
            max={1440}
            value={lookforward}
            onChange={(e) => setLookforward(e.target.value)}
            className="font-mono"
          />
        </div>
      </div>

      <Button type="submit" className="w-full">
        Generate chart
      </Button>

      <Separator />

      <p className="text-xs text-muted-foreground">
        News details (optional) — used when saving the analysis.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="headline">Headline</Label>
        <Input
          id="headline"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="SEC approves spot Bitcoin ETFs"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="source">Source</Label>
          <Input
            id="source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="coindesk"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="category">Category</Label>
          <Select
            value={category}
            onValueChange={(v) => v !== null && setCategory(v)}
          >
            <SelectTrigger id="category" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {categoryLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="url">URL</Label>
        <Input
          id="url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </div>

      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={onSave}
        disabled={createEvent.isPending || !params}
      >
        {createEvent.isPending
          ? "Saving…"
          : savedEventId
            ? "Saved ✓ (save again)"
            : "Save analysis"}
      </Button>
    </form>
  );
}
