import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  valueClass,
  title,
}: {
  label: string;
  value: string;
  valueClass?: string;
  title?: string;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-card/50 px-2.5 py-1.5" title={title}>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className={cn("font-mono text-sm tabular-nums", valueClass)}>
        {value}
      </dd>
    </div>
  );
}
