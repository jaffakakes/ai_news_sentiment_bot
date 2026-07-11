import { fromZonedTime, formatInTimeZone } from "date-fns-tz";

/**
 * Parse a wall-clock datetime string ("YYYY-MM-DDTHH:mm" or with seconds)
 * in an IANA timezone into epoch ms UTC. All storage and computation is
 * UTC; timezones exist only at the input/display edge.
 */
export function zonedInputToEpochMs(local: string, timeZone: string): number {
  const ms = fromZonedTime(local, timeZone).getTime();
  if (Number.isNaN(ms)) {
    throw new Error(`Unparseable datetime "${local}" for zone "${timeZone}"`);
  }
  return ms;
}

export function formatEpochMs(
  epochMs: number,
  timeZone: string,
  pattern = "yyyy-MM-dd HH:mm:ss zzz",
): string {
  return formatInTimeZone(new Date(epochMs), timeZone, pattern);
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function formatDurationMs(ms: number): string {
  const sign = ms < 0 ? "-" : "";
  const abs = Math.abs(ms);
  const totalSeconds = Math.floor(abs / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${sign}${h}h ${m}m`;
  if (m > 0) return `${sign}${m}m ${s}s`;
  return `${sign}${s}s`;
}
