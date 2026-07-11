"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  HistogramSeries,
  LineStyle,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "@/lib/market/types";
import { formatEpochMs } from "@/lib/time";

export interface PriceLevel {
  price: number;
  label: string;
  color: string;
  dashed?: boolean;
}

interface EventChartProps {
  candles: Candle[];
  eventTime: number; // epoch ms UTC
  timezone: string; // IANA, for axis/crosshair labels
  priceLevels?: PriceLevel[]; // entry / SL / TP / liquidation
}

const UP = "#22c55e";
const DOWN = "#ef4444";

/**
 * Event-centred candlestick + volume chart (lightweight-charts v5).
 * Client-only: mounted via next/dynamic({ ssr: false }) in the container.
 * The decimal-string → number conversion for rendering happens here and
 * nowhere else.
 */
export function EventChart({
  candles,
  eventTime,
  timezone,
  priceLevels = [],
}: EventChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);

  // Create the chart once per mount.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#a1a1aa",
        fontSize: 11,
        attributionLogo: true,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: "rgba(255,255,255,0.1)",
      },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.1)" },
      crosshair: { mode: 0 },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      borderUpColor: UP,
      borderDownColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
      priceLineVisible: false,
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: "volume",
      priceFormat: { type: "volume" },
      priceLineVisible: false,
      lastValueVisible: false,
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    markersRef.current = createSeriesMarkers(candleSeries, []);

    return () => {
      markersRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      priceLinesRef.current = [];
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // Axis/crosshair labels in the event's timezone.
  useEffect(() => {
    chartRef.current?.applyOptions({
      localization: {
        timeFormatter: (time: Time) =>
          formatEpochMs((time as number) * 1000, timezone, "MMM d HH:mm:ss"),
      },
      timeScale: {
        timeVisible: true,
        tickMarkFormatter: (time: Time) =>
          formatEpochMs((time as number) * 1000, timezone, "HH:mm"),
      },
    });
  }, [timezone]);

  // Feed data + event marker.
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    const chart = chartRef.current;
    if (!candleSeries || !volumeSeries || !chart) return;

    candleSeries.setData(
      candles.map((c) => ({
        time: (c.openTime / 1000) as UTCTimestamp,
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
      })),
    );
    volumeSeries.setData(
      candles.map((c) => ({
        time: (c.openTime / 1000) as UTCTimestamp,
        value: Number(c.volume),
        color:
          Number(c.close) >= Number(c.open)
            ? "rgba(34,197,94,0.35)"
            : "rgba(239,68,68,0.35)",
      })),
    );

    // Event marker on the candle containing the event timestamp.
    const eventCandle = candles.find(
      (c) => c.openTime <= eventTime && eventTime <= c.closeTime,
    );
    markersRef.current?.setMarkers(
      eventCandle
        ? [
            {
              time: (eventCandle.openTime / 1000) as UTCTimestamp,
              position: "aboveBar",
              color: "#eab308",
              shape: "arrowDown",
              text: "EVENT",
            },
          ]
        : [],
    );

    chart.timeScale().fitContent();
  }, [candles, eventTime]);

  // Price levels (entry / SL / TP / liquidation estimate).
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    if (!candleSeries) return;
    for (const line of priceLinesRef.current) {
      candleSeries.removePriceLine(line);
    }
    priceLinesRef.current = priceLevels
      .filter((level) => Number.isFinite(level.price) && level.price > 0)
      .map((level) =>
        candleSeries.createPriceLine({
          price: level.price,
          color: level.color,
          lineWidth: 1,
          lineStyle: level.dashed ? LineStyle.Dashed : LineStyle.Solid,
          axisLabelVisible: true,
          title: level.label,
        }),
      );
  }, [priceLevels]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      role="img"
      aria-label="Event-centred candlestick chart"
    />
  );
}
