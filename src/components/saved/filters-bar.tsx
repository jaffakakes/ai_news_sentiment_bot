"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EventFilters } from "@/hooks/use-events";

const CATEGORIES = [
  "ALL",
  "TOKEN_BURN",
  "LISTING",
  "HACK",
  "PARTNERSHIP",
  "WHALE",
  "ETF",
  "MACRO",
  "UPGRADE",
  "OTHER",
];

export function FiltersBar({
  filters,
  onChange,
}: {
  filters: EventFilters;
  onChange: (next: EventFilters) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2">
      <Input
        value={filters.ticker ?? ""}
        onChange={(e) =>
          onChange({ ...filters, ticker: e.target.value.toUpperCase(), page: 1 })
        }
        placeholder="Ticker"
        aria-label="Filter by ticker"
        className="h-7 w-28 font-mono text-xs uppercase"
      />
      <Input
        type="date"
        value={filters.from?.slice(0, 10) ?? ""}
        onChange={(e) =>
          onChange({
            ...filters,
            from: e.target.value ? `${e.target.value}T00:00:00Z` : undefined,
            page: 1,
          })
        }
        aria-label="From date"
        className="h-7 w-36 text-xs"
      />
      <Input
        type="date"
        value={filters.to?.slice(0, 10) ?? ""}
        onChange={(e) =>
          onChange({
            ...filters,
            to: e.target.value ? `${e.target.value}T23:59:59Z` : undefined,
            page: 1,
          })
        }
        aria-label="To date"
        className="h-7 w-36 text-xs"
      />
      <Input
        value={filters.source ?? ""}
        onChange={(e) =>
          onChange({ ...filters, source: e.target.value, page: 1 })
        }
        placeholder="Source"
        aria-label="Filter by source"
        className="h-7 w-28 text-xs"
      />
      <Select
        value={filters.category ?? "ALL"}
        onValueChange={(v) =>
          onChange({
            ...filters,
            category: v === "ALL" || v === null ? undefined : v,
            page: 1,
          })
        }
      >
        <SelectTrigger className="h-7 w-36 text-xs" aria-label="Filter by category">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CATEGORIES.map((c) => (
            <SelectItem key={c} value={c}>
              {c === "ALL"
                ? "All categories"
                : c.toLowerCase().replace(/_/g, " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
