import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({
    get(name: string) {
      if (name === "x-forwarded-for") return "127.0.0.1";
      return null;
    },
  })),
}));

const { mockGetSupabaseAdmin, mockGetOhlcProvider } = vi.hoisted(() => ({
  mockGetSupabaseAdmin: vi.fn(),
  mockGetOhlcProvider: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: mockGetSupabaseAdmin,
}));

vi.mock("@/lib/ohlc-provider", () => ({
  getOhlcProvider: mockGetOhlcProvider,
}));

import {
  checkOhlcStatus,
  ingestDailyOhlc,
} from "@/app/actions/ingest-ohlc";

type SymbolRow = { id: string; ohlc_synced_at: string | null };

function supabaseForCheckStatus(row: SymbolRow | null, barCount: number) {
  return {
    from(table: string) {
      if (table === "symbols") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: row, error: null }),
            }),
          }),
        };
      }
      if (table === "daily_bars") {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({ count: barCount, error: null } as const),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  };
}

function supabaseForIngest(opts: {
  existing: SymbolRow | null;
  upsertSymbolId: string;
  barsUpsertError?: boolean;
  updateSyncedError?: boolean;
}) {
  return {
    from(table: string) {
      if (table === "symbols") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: opts.existing,
                error: null,
              }),
            }),
          }),
          upsert: () => ({
            select: () => ({
              single: async () => ({
                data: { id: opts.upsertSymbolId },
                error: null,
              }),
            }),
          }),
          update: () => ({
            eq: async () => ({
              error: opts.updateSyncedError ? { message: "update failed" } : null,
            }),
          }),
        };
      }
      if (table === "daily_bars") {
        return {
          upsert: async () => ({
            error: opts.barsUpsertError
              ? { message: "upsert bars failed" }
              : null,
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  };
}

describe("checkOhlcStatus", () => {
  beforeEach(() => {
    mockGetSupabaseAdmin.mockReset();
    mockGetOhlcProvider.mockReset();
  });

  it("returns error when Supabase is not configured", async () => {
    mockGetSupabaseAdmin.mockReturnValue(null);

    const r = await checkOhlcStatus("AAPL");

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("Database is not configured");
    }
  });

  it("returns missing when symbol row does not exist", async () => {
    mockGetSupabaseAdmin.mockReturnValue(supabaseForCheckStatus(null, 0));

    const r = await checkOhlcStatus("ZZZZ");

    expect(r).toEqual({ ok: true, status: "missing" });
  });

  it("returns synced when ohlc_synced_at is set", async () => {
    mockGetSupabaseAdmin.mockReturnValue(
      supabaseForCheckStatus(
        { id: "s1", ohlc_synced_at: "2024-01-01T00:00:00.000Z" },
        42,
      ),
    );

    const r = await checkOhlcStatus("AAPL");

    expect(r).toEqual({
      ok: true,
      status: "synced",
      syncedAt: "2024-01-01T00:00:00.000Z",
      barCount: 42,
    });
  });

  it("returns partial when bars exist but not marked synced", async () => {
    mockGetSupabaseAdmin.mockReturnValue(
      supabaseForCheckStatus({ id: "s1", ohlc_synced_at: null }, 10),
    );

    const r = await checkOhlcStatus("AAPL");

    expect(r).toEqual({
      ok: true,
      status: "partial",
      barCount: 10,
    });
  });

  it("returns missing when row exists but bar count is zero and not synced", async () => {
    mockGetSupabaseAdmin.mockReturnValue(
      supabaseForCheckStatus({ id: "s1", ohlc_synced_at: null }, 0),
    );

    const r = await checkOhlcStatus("AAPL");

    expect(r).toEqual({ ok: true, status: "missing", barCount: 0 });
  });

  it("returns error for empty symbol", async () => {
    mockGetSupabaseAdmin.mockReturnValue(supabaseForCheckStatus(null, 0));

    const r = await checkOhlcStatus("   ");

    expect(r).toEqual({ ok: false, error: "Missing symbol." });
  });
});

describe("ingestDailyOhlc", () => {
  beforeEach(() => {
    mockGetSupabaseAdmin.mockReset();
    mockGetOhlcProvider.mockReset();
  });

  it("skips when symbol is already fully synced", async () => {
    mockGetSupabaseAdmin.mockReturnValue(
      supabaseForIngest({
        existing: { id: "s1", ohlc_synced_at: "2024-01-01T00:00:00.000Z" },
        upsertSymbolId: "s1",
      }),
    );
    mockGetOhlcProvider.mockReturnValue({
      fetchDailyHistory: vi.fn(),
    });

    const r = await ingestDailyOhlc("AAPL");

    expect(r).toEqual({
      ok: true,
      skipped: true,
      message:
        "Daily OHLC for this symbol is already in the database. Download is not necessary.",
    });
    expect(mockGetOhlcProvider).not.toHaveBeenCalled();
  });

  it("ingests bars and returns row count on success", async () => {
    const bars = [
      {
        date: "2024-01-02",
        open: 1,
        high: 2,
        low: 0.5,
        close: 1.5,
        volume: 100,
        adjClose: null as number | null,
      },
      {
        date: "2024-01-03",
        open: 1.5,
        high: 2,
        low: 1,
        close: 1.75,
        volume: 200,
        adjClose: null,
      },
    ];
    mockGetSupabaseAdmin.mockReturnValue(
      supabaseForIngest({
        existing: null,
        upsertSymbolId: "new-sym-id",
      }),
    );
    mockGetOhlcProvider.mockReturnValue({
      fetchDailyHistory: vi.fn().mockResolvedValue(bars),
    });

    const r = await ingestDailyOhlc("AAPL", "Apple Inc.");

    expect(r).toEqual({ ok: true, skipped: false, rowsInserted: 2 });
    expect(mockGetOhlcProvider).toHaveBeenCalled();
  });

  it("returns error when provider fetch fails", async () => {
    mockGetSupabaseAdmin.mockReturnValue(
      supabaseForIngest({ existing: null, upsertSymbolId: "x" }),
    );
    mockGetOhlcProvider.mockReturnValue({
      fetchDailyHistory: vi
        .fn()
        .mockRejectedValue(new Error("Yahoo chart failed")),
    });

    const r = await ingestDailyOhlc("AAPL");

    expect(r).toEqual({ ok: false, error: "Yahoo chart failed" });
  });

  it("returns error when daily_bars upsert fails", async () => {
    mockGetSupabaseAdmin.mockReturnValue(
      supabaseForIngest({
        existing: null,
        upsertSymbolId: "id1",
        barsUpsertError: true,
      }),
    );
    mockGetOhlcProvider.mockReturnValue({
      fetchDailyHistory: vi.fn().mockResolvedValue([
        {
          date: "2024-01-02",
          open: 1,
          high: 1,
          low: 1,
          close: 1,
          volume: 0,
          adjClose: null,
        },
      ]),
    });

    const r = await ingestDailyOhlc("AAPL");

    expect(r).toEqual({
      ok: false,
      error: "Failed to save OHLC rows to the database.",
    });
  });
});
