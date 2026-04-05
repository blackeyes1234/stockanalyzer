"use client";

import { memo, useEffect, useState } from "react";
import { getQqqRsiBacktestSummary } from "@/app/actions/qqq-rsi-backtest-summary";

function pct(n: number | null): string {
  if (n === null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function signedPct(n: number | null): string {
  if (n === null) return "—";
  const s = (n * 100).toFixed(2);
  return n >= 0 ? `+${s}%` : `${s}%`;
}

type QqqRsiBacktestPanelProps = {
  symbol: string;
};

export const QqqRsiBacktestPanel = memo(function QqqRsiBacktestPanel({
  symbol,
}: QqqRsiBacktestPanelProps) {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ready"; payload: Awaited<ReturnType<typeof getQqqRsiBacktestSummary>> }
  >({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void getQqqRsiBacktestSummary(symbol).then((payload) => {
      if (!cancelled) setState({ kind: "ready", payload });
    });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  if (state.kind === "loading") {
    return (
      <section
        className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-700"
        aria-label="QQQ RSI backtest"
      >
        <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          QQQ RSI backtest (historical)
        </h3>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Loading backtest…
        </p>
      </section>
    );
  }

  const r = state.payload;

  if (r.ok === true && r.eligible === false) {
    return null;
  }

  if (r.ok === false && r.code === "rate_limited") {
    return (
      <section
        className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-700"
        aria-label="QQQ RSI backtest"
      >
        <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          QQQ RSI backtest (historical)
        </h3>
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
          {r.message}
        </p>
      </section>
    );
  }

  if (r.ok === false) {
    return (
      <section
        className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-700"
        aria-label="QQQ RSI backtest"
      >
        <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          QQQ RSI backtest (historical)
        </h3>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {r.message}
        </p>
      </section>
    );
  }

  const winRateLabel = pct(r.winRate);
  const pf =
    r.profitFactor === null
      ? "—"
      : Number.isFinite(r.profitFactor)
        ? r.profitFactor.toFixed(2)
        : "—";

  return (
    <section
      className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-700"
      aria-label="QQQ RSI backtest"
    >
      <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        QQQ RSI backtest (historical)
      </h3>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Signals use{" "}
        <span className="font-medium text-zinc-800 dark:text-zinc-200">
          {r.signalSymbol}
        </span>{" "}
        (14-day RSI, 200-day SMA): long when price is above the SMA and RSI
        crosses below 30; exit when RSI crosses above 70 or{" "}
        {r.signalSymbol} closes below the SMA. Entries and exits fill at the{" "}
        <span className="font-medium text-zinc-800 dark:text-zinc-200">
          next session open
        </span>{" "}
        on{" "}
        <span className="font-medium text-zinc-800 dark:text-zinc-200">
          {r.executionSymbol}
        </span>
        . Same 5-year window as the chart. Not financial advice.
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">Completed trades</dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-100">
            {r.completedTrades.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">Win rate</dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-100">
            {winRateLabel}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">Wins</dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-100">
            {r.wins.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">Avg win (per trade)</dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-100">
            {signedPct(r.avgWin)}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">Avg loss (per trade)</dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-100">
            {signedPct(r.avgLoss)}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">Profit factor</dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-100">{pf}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-500">
        Uses unadjusted opens from stored daily bars; results do not model
        stops, slippage, or fees.
      </p>
    </section>
  );
});
