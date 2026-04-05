"use client";

import {
  memo,
  useEffect,
  useRef,
  useState,
  type TransitionEvent as ReactTransitionEvent,
} from "react";
import type { SearchTickerData } from "@/app/actions/search-ticker";
import { OhlcChartPanel } from "./OhlcChartPanel";
import { OhlcDownloadSection } from "./OhlcDownloadSection";
import { QqqRsiBacktestPanel } from "./QqqRsiBacktestPanel";
import { SearchResultCard } from "./SearchResultCard";
import type { DetailPhase } from "./types";

const DETAIL_FADE_MS = 320;

export type StockDetailWindowProps = {
  data: SearchTickerData;
  phase: DetailPhase;
  onEntered: () => void;
  onLeaveComplete: () => void;
};

export const StockDetailWindow = memo(function StockDetailWindow({
  data,
  phase,
  onEntered,
  onLeaveComplete,
}: StockDetailWindowProps) {
  const leaveSettledRef = useRef(false);
  const [chartRefresh, setChartRefresh] = useState(0);

  const opacityClass =
    phase === "visible" ? "opacity-100" : "opacity-0";

  useEffect(() => {
    if (phase !== "enter") return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        onEntered();
      });
    });
    return () => cancelAnimationFrame(id);
  }, [phase, onEntered]);

  useEffect(() => {
    if (phase !== "leave") return;
    leaveSettledRef.current = false;
    const t = window.setTimeout(() => {
      if (leaveSettledRef.current) return;
      leaveSettledRef.current = true;
      onLeaveComplete();
    }, DETAIL_FADE_MS + 120);
    return () => window.clearTimeout(t);
  }, [phase, onLeaveComplete]);

  function handleTransitionEnd(e: ReactTransitionEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    if (e.propertyName !== "opacity") return;
    if (phase !== "leave") return;
    if (leaveSettledRef.current) return;
    leaveSettledRef.current = true;
    onLeaveComplete();
  }

  return (
    <div
      className={`rounded-xl transition-opacity ease-out motion-reduce:transition-none ${opacityClass}`}
      style={{
        transitionDuration: `${DETAIL_FADE_MS}ms`,
      }}
      onTransitionEnd={handleTransitionEnd}
    >
      <SearchResultCard data={data} />
      <OhlcChartPanel
        key={`${data.ticker}-${chartRefresh}`}
        symbol={data.ticker}
      />
      {(data.ticker.toUpperCase() === "QQQ" ||
        data.ticker.toUpperCase() === "TQQQ") && (
        <QqqRsiBacktestPanel
          key={`${data.ticker}-rsi-backtest-${chartRefresh}`}
          symbol={data.ticker}
        />
      )}
      <OhlcDownloadSection
        key={data.ticker}
        symbol={data.ticker}
        companyName={data.companyName}
        onHistoricalDataChanged={() =>
          setChartRefresh((n) => n + 1)
        }
      />
    </div>
  );
});
