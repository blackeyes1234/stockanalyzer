"use server";

import { chartWindowStartDateIso } from "@/lib/chart-window";
import {
  DEFAULT_QQQ_RSI_SMA_PARAMS,
  mergeSignalAndExecutionBars,
  runQqqRsiSmaBacktest,
  type MinimalBar,
} from "@/lib/backtest";
import { checkSearchRateLimit } from "@/lib/server-rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const SIGNAL_SYMBOL = "QQQ";

function asNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

function normalizeDate(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

async function loadMinimalBarsForSymbol(
  symbol: string,
  fromDate: string,
): Promise<MinimalBar[] | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const sym = symbol.trim().toUpperCase();
  const { data: symRow, error: symErr } = await supabase
    .from("symbols")
    .select("id")
    .eq("symbol", sym)
    .maybeSingle();

  if (symErr || !symRow) {
    if (symErr) {
      console.error("[loadMinimalBarsForSymbol] symbols", symErr);
    }
    return null;
  }

  const symbolId = symRow.id as string;
  const { data: rows, error: barErr } = await supabase
    .from("daily_bars")
    .select("trade_date, open, close")
    .eq("symbol_id", symbolId)
    .gte("trade_date", fromDate)
    .order("trade_date", { ascending: true });

  if (barErr) {
    console.error("[loadMinimalBarsForSymbol] daily_bars", barErr);
    return null;
  }

  if (!rows?.length) return [];

  const out: MinimalBar[] = [];
  for (const r of rows) {
    const date = normalizeDate(r.trade_date as unknown);
    const open = asNumber(r.open);
    const close = asNumber(r.close);
    if (!date || !Number.isFinite(open) || !Number.isFinite(close)) continue;
    out.push({ date, open, close });
  }
  return out;
}

export type QqqRsiBacktestSummaryOk = {
  ok: true;
  eligible: true;
  signalSymbol: typeof SIGNAL_SYMBOL;
  executionSymbol: string;
  completedTrades: number;
  wins: number;
  winRate: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  profitFactor: number | null;
};

export type QqqRsiBacktestSummaryNotEligible = {
  ok: true;
  eligible: false;
};

export type QqqRsiBacktestSummaryMissing = {
  ok: false;
  eligible: true;
  code: "db_not_configured" | "missing_qqq" | "missing_execution" | "no_overlap";
  message: string;
};

export type QqqRsiBacktestSummaryRateLimited = {
  ok: false;
  eligible: true;
  code: "rate_limited";
  message: string;
};

export type QqqRsiBacktestSummaryResponse =
  | QqqRsiBacktestSummaryOk
  | QqqRsiBacktestSummaryNotEligible
  | QqqRsiBacktestSummaryMissing
  | QqqRsiBacktestSummaryRateLimited;

/**
 * Historical QQQ RSI + 200 SMA backtest for detail panel (QQQ / TQQQ lookups only).
 * Signals on QQQ; execution on TQQQ when the user symbol is TQQQ, else QQQ.
 */
export async function getQqqRsiBacktestSummary(
  rawSymbol: string,
): Promise<QqqRsiBacktestSummaryResponse> {
  const userSymbol = rawSymbol.trim().toUpperCase();
  if (userSymbol !== "QQQ" && userSymbol !== "TQQQ") {
    return { ok: true, eligible: false };
  }

  const limited = await checkSearchRateLimit("getQqqRsiBacktest");
  if (!limited.ok) {
    return {
      ok: false,
      eligible: true,
      code: "rate_limited",
      message: limited.error,
    };
  }

  if (!getSupabaseAdmin()) {
    return {
      ok: false,
      eligible: true,
      code: "db_not_configured",
      message:
        "Database is not configured. Add Supabase credentials to run the backtest.",
    };
  }

  const executionSymbol = userSymbol === "TQQQ" ? "TQQQ" : "QQQ";
  const fromDate = chartWindowStartDateIso();

  const qqqBars = await loadMinimalBarsForSymbol(SIGNAL_SYMBOL, fromDate);
  if (qqqBars === null) {
    return {
      ok: false,
      eligible: true,
      code: "missing_qqq",
      message: "Could not load QQQ daily bars.",
    };
  }
  if (qqqBars.length === 0) {
    return {
      ok: false,
      eligible: true,
      code: "missing_qqq",
      message:
        "No stored QQQ history in range. Download historical data for QQQ first.",
    };
  }

  const execBars = await loadMinimalBarsForSymbol(executionSymbol, fromDate);
  if (execBars === null) {
    return {
      ok: false,
      eligible: true,
      code: "missing_execution",
      message: `Could not load ${executionSymbol} daily bars.`,
    };
  }
  if (execBars.length === 0) {
    const hint =
      executionSymbol === "TQQQ"
        ? "Download historical data for TQQQ (and QQQ) first."
        : "Download historical data for QQQ first.";
    return {
      ok: false,
      eligible: true,
      code: "missing_execution",
      message: `No stored ${executionSymbol} history in range. ${hint}`,
    };
  }

  const aligned = mergeSignalAndExecutionBars(qqqBars, execBars);
  if (aligned.length === 0) {
    return {
      ok: false,
      eligible: true,
      code: "no_overlap",
      message:
        "QQQ and execution symbol have no overlapping trading days in range. Download both histories.",
    };
  }

  const result = runQqqRsiSmaBacktest(aligned, DEFAULT_QQQ_RSI_SMA_PARAMS);

  return {
    ok: true,
    eligible: true,
    signalSymbol: SIGNAL_SYMBOL,
    executionSymbol,
    completedTrades: result.completedTrades.length,
    wins: result.wins,
    winRate: result.winRate,
    avgWin: result.avgWin,
    avgLoss: result.avgLoss,
    profitFactor: result.profitFactor,
  };
}
