import { computeRsiWilder, computeSma } from "./indicators";
import type {
  CompletedTrade,
  QqqRsiSmaBacktestParams,
  QqqRsiSmaBacktestResult,
  AlignedBar,
} from "./types";

function crossBelowOversold(
  prev: number | null,
  curr: number | null,
  oversold: number,
): boolean {
  if (prev === null || curr === null) return false;
  return prev > oversold && curr <= oversold;
}

function crossAboveOverbought(
  prev: number | null,
  curr: number | null,
  overbought: number,
): boolean {
  if (prev === null || curr === null) return false;
  return prev < overbought && curr >= overbought;
}

/** Aggregates win rate and P/L stats from completed round-trips (for tests and reuse). */
export function summarizeCompletedTrades(
  completed: CompletedTrade[],
): Pick<
  QqqRsiSmaBacktestResult,
  "wins" | "winRate" | "avgWin" | "avgLoss" | "profitFactor"
> {
  const wins = completed.filter((t) => t.win).length;
  const winRate = completed.length === 0 ? null : wins / completed.length;

  const winReturns = completed.filter((t) => t.win).map((t) => t.simpleReturn);
  const lossReturns = completed
    .filter((t) => !t.win)
    .map((t) => t.simpleReturn);

  const avgWin =
    winReturns.length === 0
      ? null
      : winReturns.reduce((a, b) => a + b, 0) / winReturns.length;
  const avgLoss =
    lossReturns.length === 0
      ? null
      : lossReturns.reduce((a, b) => a + b, 0) / lossReturns.length;

  const grossProfit = winReturns.reduce((a, b) => a + b, 0);
  const grossLossAbs = lossReturns.reduce((a, b) => a + Math.abs(b), 0);
  const profitFactor =
    lossReturns.length === 0 || grossLossAbs === 0
      ? null
      : grossProfit / grossLossAbs;

  return {
    wins,
    winRate,
    avgWin,
    avgLoss,
    profitFactor,
  };
}

/**
 * Signals from QQQ closes (RSI + SMA on `signalClose`); fills at next bar's `execOpen`.
 * Bear exit: QQQ close below SMA(200) → exit next exec open.
 */
export function runQqqRsiSmaBacktest(
  aligned: AlignedBar[],
  params: QqqRsiSmaBacktestParams,
): QqqRsiSmaBacktestResult {
  const { rsiPeriod, smaPeriod, oversold, overbought } = params;
  const n = aligned.length;
  if (n < 2) {
    return {
      completedTrades: [],
      wins: 0,
      winRate: null,
      avgWin: null,
      avgLoss: null,
      profitFactor: null,
    };
  }

  const closes = aligned.map((b) => b.signalClose);
  const rsi = computeRsiWilder(closes, rsiPeriod);
  const sma = computeSma(closes, smaPeriod);

  const startJ = Math.max(smaPeriod - 1, rsiPeriod, 1);
  const completed: CompletedTrade[] = [];

  type Position =
    | { kind: "flat" }
    | { kind: "long"; entryDate: string; entryOpen: number };

  let pos: Position = { kind: "flat" };

  for (let j = startJ; j <= n - 2; j++) {
    const qClose = aligned[j]!.signalClose;
    const smaJ = sma[j];
    const rsiPrev = rsi[j - 1];
    const rsiCurr = rsi[j];

    const trendOk = smaJ !== null && qClose > smaJ;
    const bearBreak = smaJ !== null && qClose < smaJ;

    // Execute scheduled actions at open of bar j+1 (signal known after close j)
    let scheduleEntry = false;
    let scheduleExit = false;

    if (pos.kind === "long") {
      if (bearBreak) {
        scheduleExit = true;
      } else if (crossAboveOverbought(rsiPrev, rsiCurr, overbought)) {
        scheduleExit = true;
      }
    } else {
      if (trendOk && crossBelowOversold(rsiPrev, rsiCurr, oversold)) {
        scheduleEntry = true;
      }
    }

    const nextOpen = aligned[j + 1]!.execOpen;
    const nextDate = aligned[j + 1]!.date;

    if (scheduleExit && pos.kind === "long") {
      const exitOpen = nextOpen;
      const entryOpen = pos.entryOpen;
      const simpleReturn = exitOpen / entryOpen - 1;
      completed.push({
        entryDate: pos.entryDate,
        exitDate: nextDate,
        entryOpen,
        exitOpen,
        simpleReturn,
        win: simpleReturn > 0,
      });
      pos = { kind: "flat" };
    }

    if (scheduleEntry && pos.kind === "flat") {
      pos = {
        kind: "long",
        entryDate: nextDate,
        entryOpen: nextOpen,
      };
    }
  }

  const summary = summarizeCompletedTrades(completed);

  return {
    completedTrades: completed,
    ...summary,
  };
}
