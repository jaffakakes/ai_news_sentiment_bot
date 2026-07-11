"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * lightweight-charts touches window/canvas, so the chart loads client-side
 * only. Everything importing the chart goes through this container.
 */
export const EventChartContainer = dynamic(
  () => import("./event-chart").then((m) => ({ default: m.EventChart })),
  {
    ssr: false,
    loading: () => <Skeleton className="h-full w-full rounded-md" />,
  },
);

export type { PriceLevel } from "./event-chart";
