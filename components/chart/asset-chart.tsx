"use client";

import { createChart, CrosshairMode } from "lightweight-charts";
import { useEffect, useRef } from "react";
import { asChartTime } from "@/lib/utils";
import { IndicatorPoint } from "@/types/candle";
import { SignalView } from "@/types/signal";

export function AssetChart({
  candles,
  signals,
}: {
  candles: IndicatorPoint[];
  signals: SignalView[];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const chart = createChart(containerRef.current, {
      layout: { background: { color: "transparent" }, textColor: "#dbeafe" },
      grid: { vertLines: { color: "rgba(255,255,255,0.08)" }, horzLines: { color: "rgba(255,255,255,0.08)" } },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.12)" },
      timeScale: { borderColor: "rgba(255,255,255,0.12)" },
      crosshair: { mode: CrosshairMode.Normal },
      height: 460,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#10b981",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });

    const ema20Series = chart.addLineSeries({ color: "#22d3ee", lineWidth: 2 });
    const ema60Series = chart.addLineSeries({ color: "#f59e0b", lineWidth: 2 });

    candleSeries.setData(
      candles.map((candle) => ({
        time: asChartTime(candle.time),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      }))
    );

    ema20Series.setData(
      candles
        .filter((candle) => candle.ema20 !== null && candle.ema20 !== undefined)
        .map((candle) => ({ time: asChartTime(candle.time), value: candle.ema20! }))
    );

    ema60Series.setData(
      candles
        .filter((candle) => candle.ema60 !== null && candle.ema60 !== undefined)
        .map((candle) => ({ time: asChartTime(candle.time), value: candle.ema60! }))
    );

    candleSeries.setMarkers(
      signals.map((signal) => ({
        time: asChartTime(signal.timestamp),
        position: signal.signalType === "BUY" ? "belowBar" : "aboveBar",
        color: signal.signalType === "BUY" ? "#10b981" : "#f43f5e",
        shape: signal.signalType === "BUY" ? "arrowUp" : "arrowDown",
        text: `${signal.signalType} ${signal.signalStage}차`,
      }))
    );

    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [candles, signals]);

  return <div ref={containerRef} className="w-full" />;
}

