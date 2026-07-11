"use client";

import { Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HELP } from "@/lib/help-copy";

export function HeaderBar() {
  return (
    <header className="flex items-center gap-3 border-b border-border px-4 py-2">
      <Activity className="size-4 text-profit" aria-hidden />
      <h1 className="text-sm font-semibold tracking-tight">Event Terminal</h1>
      <span className="hidden text-xs text-muted-foreground sm:inline">
        Crypto news event analysis &amp; trade simulation
      </span>
      <Tooltip>
        <TooltipTrigger
          render={<span className="ml-auto inline-flex" tabIndex={0} />}
          aria-label="What this tool does and does not do"
        >
          <Badge
            variant="outline"
            className="border-warning/40 text-[10px] text-warning"
          >
            Research tool — no live trading
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-72 text-left leading-relaxed">
          {HELP.badges.researchTool}
        </TooltipContent>
      </Tooltip>
    </header>
  );
}
