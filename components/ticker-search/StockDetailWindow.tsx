"use client";

import {
  memo,
  useEffect,
  useRef,
  type TransitionEvent as ReactTransitionEvent,
} from "react";
import type { SearchTickerData } from "@/app/actions/search-ticker";
import { OhlcDownloadSection } from "./OhlcDownloadSection";
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
      <OhlcDownloadSection
        key={data.ticker}
        symbol={data.ticker}
        companyName={data.companyName}
      />
    </div>
  );
});
