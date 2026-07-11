/**
 * Display-only formatting helpers. Values arrive as decimal strings; these
 * functions format for the UI and never feed back into calculations.
 */

export function formatPrice(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  if (num >= 1000) {
    return num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  if (num >= 1) return num.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return num.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

export function formatPct(
  value: string | null | undefined,
  opts: { sign?: boolean; digits?: number } = {},
): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  const digits = opts.digits ?? 2;
  const sign = opts.sign !== false && num > 0 ? "+" : "";
  return `${sign}${num.toFixed(digits)}%`;
}

export function formatQuote(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  const sign = num > 0 ? "+" : "";
  return `${sign}${num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} USDT`;
}

export function formatCompactVolume(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  return Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(num);
}

/** Tailwind class for signed values: profit green / loss red / neutral. */
export function signClass(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) return "";
  return num > 0 ? "text-profit" : "text-loss";
}
