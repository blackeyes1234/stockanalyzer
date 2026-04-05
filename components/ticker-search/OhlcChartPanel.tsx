"use client";

import {
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type Time,
} from "lightweight-charts";
import { memo, useEffect, useRef, useState } from "react";
import {
  getStoredDailyBarsForChart,
  type ChartDailyBar,
} from "@/app/actions/daily-bars-chart";

const CHART_HEIGHT = 380;

function chartColors() {
  const dark = document.documentElement.classList.contains("dark");
  return {
    dark,
    bg: dark ? "#18181b" : "#ffffff",
    text: dark ? "#a1a1aa" : "#52525b",
    grid: dark ? "#3f3f46" : "#e4e4e7",
  };
}

type OhlcChartPanelProps = {
  symbol: string;
};

export const OhlcChartPanel = memo(function OhlcChartPanel({
  symbol,
}: OhlcChartPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [bars, setBars] = useState<ChartDailyBar[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getStoredDailyBarsForChart(symbol).then(({ bars: next }) => {
      if (!cancelled) setBars(next);
    });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  useEffect(() => {
    if (bars === null || bars.length === 0) {
      chartRef.current?.remove();
      chartRef.current = null;
      return;
    }

    const el = containerRef.current;
    if (!el) return;

    chartRef.current?.remove();
    chartRef.current = null;

    const { bg, text, grid } = chartColors();
    const chart = createChart(el, {
      width: el.clientWidth,
      height: CHART_HEIGHT,
      layout: {
        background: { type: ColorType.Solid, color: bg },
        textColor: text,
      },
      grid: {
        vertLines: { color: grid },
        horzLines: { color: grid },
      },
      rightPriceScale: { borderColor: grid },
      timeScale: { borderColor: grid },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#16a34a",
      downColor: "#dc2626",
      borderUpColor: "#16a34a",
      borderDownColor: "#dc2626",
      wickUpColor: "#16a34a",
      wickDownColor: "#dc2626",
    });

    series.setData(
      bars.map((b) => ({
        time: b.date as Time,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      })),
    );
    chart.timeScale().fitContent();
    chartRef.current = chart;

    const ro = new ResizeObserver(() => {
      if (!containerRef.current || !chartRef.current) return;
      chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(el);

    const obs = new MutationObserver(() => {
      if (!chartRef.current || !containerRef.current) return;
      const c = chartColors();
      chartRef.current.applyOptions({
        layout: {
          background: { type: ColorType.Solid, color: c.bg },
          textColor: c.text,
        },
        grid: {
          vertLines: { color: c.grid },
          horzLines: { color: c.grid },
        },
        rightPriceScale: { borderColor: c.grid },
        timeScale: { borderColor: c.grid },
      });
    });
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      obs.disconnect();
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [bars]);

  if (bars === null || bars.length === 0) {
    return null;
  }

  return (
    <section
      className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-700"
      aria-label={`Daily price chart for ${symbol}`}
    >
      <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Price chart
      </h3>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Daily candles from your stored history (last 5 years,{" "}
        {bars.length.toLocaleString()} trading days in range).
      </p>
      <div
        ref={containerRef}
        className="mt-3 w-full min-w-0"
        style={{ height: CHART_HEIGHT }}
      />
    </section>
  );
});
