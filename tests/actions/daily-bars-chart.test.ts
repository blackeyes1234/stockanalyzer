import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({
    get(name: string) {
      if (name === "x-forwarded-for") return "127.0.0.1";
      return null;
    },
  })),
}));

const { mockGetSupabaseAdmin } = vi.hoisted(() => ({
  mockGetSupabaseAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: mockGetSupabaseAdmin,
}));

import { getStoredDailyBarsForChart } from "@/app/actions/daily-bars-chart";

describe("getStoredDailyBarsForChart", () => {
  beforeEach(() => {
    mockGetSupabaseAdmin.mockReset();
  });

  it("returns empty bars when Supabase is not configured", async () => {
    mockGetSupabaseAdmin.mockReturnValue(null);

    const r = await getStoredDailyBarsForChart("AAPL");

    expect(r).toEqual({ bars: [] });
  });

  it("returns empty bars when symbol row is missing", async () => {
    mockGetSupabaseAdmin.mockReturnValue({
      from(table: string) {
        if (table === "symbols") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          };
        }
        throw new Error(`unexpected: ${table}`);
      },
    });

    const r = await getStoredDailyBarsForChart("ZZZZ");

    expect(r).toEqual({ bars: [] });
  });

  it("returns normalized bars ordered from daily_bars", async () => {
    mockGetSupabaseAdmin.mockReturnValue({
      from(table: string) {
        if (table === "symbols") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: "sym-1" },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "daily_bars") {
          return {
            select: () => ({
              eq: () => ({
                gte: () => ({
                  order: async () => ({
                    data: [
                      {
                        trade_date: "2024-01-02",
                        open: "10",
                        high: 11,
                        low: 9,
                        close: 10.5,
                        volume: 1000,
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected: ${table}`);
      },
    });

    const r = await getStoredDailyBarsForChart("AAPL");

    expect(r.bars).toHaveLength(1);
    expect(r.bars[0]).toMatchObject({
      date: "2024-01-02",
      open: 10,
      high: 11,
      low: 9,
      close: 10.5,
      volume: 1000,
    });
  });
});
