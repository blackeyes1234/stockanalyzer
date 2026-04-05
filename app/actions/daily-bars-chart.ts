"use server";

import { checkSearchRateLimit } from "@/lib/server-rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/** Rolling calendar window: bars from this date (inclusive) through latest stored bar. */
const CHART_LOOKBACK_YEARS = 5;

function chartWindowStartDateIso(): string {
  const now = new Date();
  const start = new Date(
    Date.UTC(
      now.getUTCFullYear() - CHART_LOOKBACK_YEARS,
      now.getUTCMonth(),
      now.getUTCDate(),
    ),
  );
  return start.toISOString().slice(0, 10);
}

export type ChartDailyBar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

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

/**
 * Loads stored daily bars for Lightweight Charts (rolling 5 calendar years through
 * today). Returns [] if Supabase is not configured, the symbol is unknown, or there
 * are no rows in range (chart hidden).
 */
export async function getStoredDailyBarsForChart(
  rawSymbol: string,
): Promise<{ bars: ChartDailyBar[] }> {
  const limited = await checkSearchRateLimit("getChartDailyBars");
  if (!limited.ok) {
    return { bars: [] };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { bars: [] };
  }

  const symbol = rawSymbol.trim().toUpperCase();
  if (!symbol) {
    return { bars: [] };
  }

  const { data: symRow, error: symErr } = await supabase
    .from("symbols")
    .select("id")
    .eq("symbol", symbol)
    .maybeSingle();

  if (symErr || !symRow) {
    if (symErr) {
      console.error("[getStoredDailyBarsForChart] symbols", symErr);
    }
    return { bars: [] };
  }

  const symbolId = symRow.id as string;
  const fromDate = chartWindowStartDateIso();

  const { data: rows, error: barErr } = await supabase
    .from("daily_bars")
    .select("trade_date, open, high, low, close, volume")
    .eq("symbol_id", symbolId)
    .gte("trade_date", fromDate)
    .order("trade_date", { ascending: true });

  if (barErr) {
    console.error("[getStoredDailyBarsForChart] daily_bars", barErr);
    return { bars: [] };
  }

  if (!rows?.length) {
    return { bars: [] };
  }

  const bars: ChartDailyBar[] = [];
  for (const r of rows) {
    const date = normalizeDate(r.trade_date as unknown);
    const open = asNumber(r.open);
    const high = asNumber(r.high);
    const low = asNumber(r.low);
    const close = asNumber(r.close);
    const volume = asNumber(r.volume);
    if (
      !date ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close)
    ) {
      continue;
    }
    bars.push({
      date,
      open,
      high,
      low,
      close,
      volume: Number.isFinite(volume) ? Math.max(0, Math.round(volume)) : 0,
    });
  }

  return { bars };
}
