import { InfoHint } from "@/components/common/info-hint";
import { cn } from "@/lib/utils";

export function StatTile({
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
    <div className="rounded-md border border-border/60 bg-card/50 px-2.5 py-1.5">
      <dt className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
        {hint && (
          <InfoHint
            hint={hint}
            label={`About ${label.toLowerCase()}`}
            className="[&_svg]:size-3"
          />
        )}
      </dt>
      <dd className={cn("font-mono text-sm tabular-nums", valueClass)}>
        {value}
      </dd>
    </div>
  );
}
