"use server";

import { getOhlcProvider } from "@/lib/ohlc-provider";
import { checkSearchRateLimit } from "@/lib/server-rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const UPSERT_BATCH = 500;

export type OhlcStatusResult =
  | {
      ok: true;
      status: "missing" | "synced" | "partial";
      syncedAt?: string;
      barCount?: number;
    }
  | { ok: false; error: string };

export async function checkOhlcStatus(
  rawSymbol: string,
): Promise<OhlcStatusResult> {
  const limited = await checkSearchRateLimit("checkOhlcStatus");
  if (!limited.ok) {
    return { ok: false, error: limited.error };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return {
      ok: false,
      error:
        "Database is not configured. Add SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.",
    };
  }

  const symbol = rawSymbol.trim().toUpperCase();
  if (!symbol) {
    return { ok: false, error: "Missing symbol." };
  }

  const { data: row, error } = await supabase
    .from("symbols")
    .select("id, ohlc_synced_at")
    .eq("symbol", symbol)
    .maybeSingle();

  if (error) {
    console.error("[checkOhlcStatus] select symbols", error);
    return { ok: false, error: "Could not read symbol status." };
  }

  if (!row) {
    return { ok: true, status: "missing" };
  }

  const { count, error: countErr } = await supabase
    .from("daily_bars")
    .select("*", { count: "exact", head: true })
    .eq("symbol_id", row.id);

  if (countErr) {
    console.error("[checkOhlcStatus] count bars", countErr);
    return { ok: false, error: "Could not read bar count." };
  }

  const barCount = count ?? 0;

  if (row.ohlc_synced_at) {
    return {
      ok: true,
      status: "synced",
      syncedAt: row.ohlc_synced_at,
      barCount,
    };
  }

  return {
    ok: true,
    status: barCount > 0 ? "partial" : "missing",
    barCount,
  };
}

export type IngestOhlcResult =
  | { ok: true; skipped: true; message: string }
  | { ok: true; skipped: false; rowsInserted: number }
  | { ok: false; error: string };

export async function ingestDailyOhlc(
  rawSymbol: string,
  companyName?: string,
): Promise<IngestOhlcResult> {
  const limited = await checkSearchRateLimit("ingestOhlc");
  if (!limited.ok) {
    return { ok: false, error: limited.error };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return {
      ok: false,
      error:
        "Database is not configured. Add SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.",
    };
  }

  const symbol = rawSymbol.trim().toUpperCase();
  if (!symbol) {
    return { ok: false, error: "Missing symbol." };
  }

  const { data: existing, error: exErr } = await supabase
    .from("symbols")
    .select("id, ohlc_synced_at")
    .eq("symbol", symbol)
    .maybeSingle();

  if (exErr) {
    console.error("[ingestDailyOhlc] select existing", exErr);
    return { ok: false, error: "Could not read symbol." };
  }

  if (existing?.ohlc_synced_at) {
    return {
      ok: true,
      skipped: true,
      message:
        "Daily OHLC for this symbol is already in the database. Download is not necessary.",
    };
  }

  const provider = getOhlcProvider();
  let bars;
  try {
    bars = await provider.fetchDailyHistory(rawSymbol.trim());
  } catch (e) {
    console.error("[ingestDailyOhlc] provider fetch", e);
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "Failed to download OHLC data from Yahoo Finance.",
    };
  }

  const name =
    typeof companyName === "string" && companyName.trim()
      ? companyName.trim()
      : null;

  const { data: symRow, error: symErr } = await supabase
    .from("symbols")
    .upsert(
      { symbol, company_name: name },
      { onConflict: "symbol" },
    )
    .select("id")
    .single();

  if (symErr || !symRow) {
    console.error("[ingestDailyOhlc] upsert symbol", symErr);
    return { ok: false, error: "Could not save symbol row." };
  }

  const symbolId = symRow.id as string;

  for (let i = 0; i < bars.length; i += UPSERT_BATCH) {
    const slice = bars.slice(i, i + UPSERT_BATCH);
    const rows = slice.map((b) => ({
      symbol_id: symbolId,
      trade_date: b.date,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume,
      adj_close: b.adjClose,
    }));

    const { error: barErr } = await supabase.from("daily_bars").upsert(rows, {
      onConflict: "symbol_id,trade_date",
    });

    if (barErr) {
      console.error("[ingestDailyOhlc] upsert bars", barErr);
      return {
        ok: false,
        error: "Failed to save OHLC rows to the database.",
      };
    }
  }

  const syncedAt = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("symbols")
    .update({ ohlc_synced_at: syncedAt })
    .eq("id", symbolId);

  if (updErr) {
    console.error("[ingestDailyOhlc] update synced", updErr);
    return {
      ok: false,
      error: "Saved bars but could not mark sync as complete. Try again.",
    };
  }

  return { ok: true, skipped: false, rowsInserted: bars.length };
}
