"use server";

import { buildSheetRows, type DailyBarExportInput } from "@/lib/export/build-sheet-rows";
import { createSheetsClient } from "@/lib/google-sheets/client";
import {
  getGoogleSheetsSpreadsheetIdFromEnv,
  isGoogleSheetsExportEnvConfigured,
} from "@/lib/google-sheets/credentials";
import { sanitizeWorksheetTitle } from "@/lib/google-sheets/sheet-title";
import { ensureSheetAndWriteValues } from "@/lib/google-sheets/write-daily-bars";
import { checkSearchRateLimit } from "@/lib/server-rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

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

export async function checkGoogleSheetsExportConfigured(): Promise<{
  configured: boolean;
}> {
  return { configured: isGoogleSheetsExportEnvConfigured() };
}

export type ExportDailyBarsToGoogleSheetResult =
  | { ok: true; rowsWritten: number; sheetTitle: string }
  | { ok: false; error: string };

/**
 * Exports all stored daily bars for the symbol to a worksheet named after the ticker
 * in the configured Google Spreadsheet (service account must have Editor access).
 */
export async function exportDailyBarsToGoogleSheet(
  rawSymbol: string,
): Promise<ExportDailyBarsToGoogleSheetResult> {
  const limited = await checkSearchRateLimit("exportGoogleSheets");
  if (!limited.ok) {
    return { ok: false, error: limited.error };
  }

  const spreadsheetId = getGoogleSheetsSpreadsheetIdFromEnv();
  if (!spreadsheetId || !isGoogleSheetsExportEnvConfigured()) {
    return {
      ok: false,
      error:
        "Google Sheets export is not configured on the server (spreadsheet ID and service account credentials).",
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return {
      ok: false,
      error:
        "Database is not configured. Add Supabase credentials to export stored bars.",
    };
  }

  const symbol = rawSymbol.trim().toUpperCase();
  if (!symbol) {
    return { ok: false, error: "Missing symbol." };
  }

  const { data: symRow, error: symErr } = await supabase
    .from("symbols")
    .select("id")
    .eq("symbol", symbol)
    .maybeSingle();

  if (symErr || !symRow) {
    if (symErr) {
      console.error("[exportDailyBarsToGoogleSheet] symbols", symErr);
    }
    return {
      ok: false,
      error: "Unknown symbol or no data in the database for this ticker.",
    };
  }

  const symbolId = symRow.id as string;
  const { data: rows, error: barErr } = await supabase
    .from("daily_bars")
    .select("trade_date, open, high, low, close, volume")
    .eq("symbol_id", symbolId)
    .order("trade_date", { ascending: true });

  if (barErr) {
    console.error("[exportDailyBarsToGoogleSheet] daily_bars", barErr);
    return { ok: false, error: "Could not load daily bars from the database." };
  }

  if (!rows?.length) {
    return {
      ok: false,
      error: "No daily bars stored for this symbol. Download OHLC first.",
    };
  }

  const bars: DailyBarExportInput[] = [];
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

  if (bars.length === 0) {
    return {
      ok: false,
      error: "No valid daily bar rows to export after parsing.",
    };
  }

  const values = buildSheetRows(bars);
  const sheetTitle = sanitizeWorksheetTitle(symbol);

  const sheetsResult = await createSheetsClient();
  if (!sheetsResult.ok) {
    return { ok: false, error: sheetsResult.message };
  }

  try {
    await ensureSheetAndWriteValues(
      sheetsResult.sheets,
      spreadsheetId,
      sheetTitle,
      values,
    );
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Google Sheets API request failed.";
    const friendly =
      /permission|forbidden|403/i.test(msg) || /insufficient/i.test(msg)
        ? "The service account cannot access this spreadsheet. Share the file with the service account email (from your GCP JSON) as Editor, and ensure the Google Sheets API is enabled."
        : msg;
    console.error("[exportDailyBarsToGoogleSheet] sheets API", e);
    return { ok: false, error: friendly };
  }

  return {
    ok: true,
    rowsWritten: values.length,
    sheetTitle,
  };
}
