"use client";

import { useState } from "react";
import { CircleHelp } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Small (?) icon that explains a field or metric in plain English on
 * hover/focus, or on tap for touch devices. Place as a SIBLING of a
 * <Label>, never inside it (a button inside a label breaks label
 * click-forwarding and pollutes the input's accessible name).
 */
export function InfoHint({
  hint,
  label,
  side = "top",
  className,
}: {
  hint: React.ReactNode;
  /** Accessible name for the trigger, e.g. "About stop loss". */
  label?: string;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}) {
  // Controlled so a tap toggles it on touch devices; base-ui still drives
  // onOpenChange from hover and focus, so desktop behavior is unchanged.
  const [open, setOpen] = useState(false);
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        type="button"
        aria-label={label ?? "More information"}
        data-slot="info-hint"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex shrink-0 text-muted-foreground/60 transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none",
          className,
        )}
      >
        <CircleHelp aria-hidden className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-64 text-left leading-relaxed">
        {hint}
      </TooltipContent>
    </Tooltip>
  );
}
