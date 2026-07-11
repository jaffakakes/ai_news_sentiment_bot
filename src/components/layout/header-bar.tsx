import { Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function HeaderBar() {
  return (
    <header className="flex items-center gap-3 border-b border-border px-4 py-2">
      <Activity className="size-4 text-profit" aria-hidden />
      <h1 className="text-sm font-semibold tracking-tight">Event Terminal</h1>
      <span className="hidden text-xs text-muted-foreground sm:inline">
        Crypto news event analysis &amp; trade simulation
      </span>
      <Badge
        variant="outline"
        className="ml-auto border-warning/40 text-[10px] text-warning"
        title="This tool analyses historical data and simulates hypothetical outcomes. It never places trades and never connects to exchange trading APIs."
      >
        Research tool — no live trading
      </Badge>
    </header>
  );
}
