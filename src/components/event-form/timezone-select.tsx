"use client";

import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const COMMON_ZONES = [
  "UTC",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Dubai",
  "Australia/Sydney",
];

export function TimezoneSelect({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (tz: string) => void;
  id?: string;
}) {
  const zones = useMemo(() => {
    const all = Intl.supportedValuesOf("timeZone");
    const rest = all.filter((z) => !COMMON_ZONES.includes(z));
    return { common: COMMON_ZONES, rest };
  }, []);

  return (
    <Select value={value} onValueChange={(v) => v !== null && onChange(v)}>
      <SelectTrigger id={id} className="w-full" aria-label="Timezone">
        <SelectValue placeholder="Timezone" />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {zones.common.map((zone) => (
          <SelectItem key={zone} value={zone}>
            {zone}
          </SelectItem>
        ))}
        {zones.rest.map((zone) => (
          <SelectItem key={zone} value={zone}>
            {zone}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
