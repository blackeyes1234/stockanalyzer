import { describe, expect, it } from "vitest";

import { mapChartQuotesToDailyBars } from "@/lib/ohlc-provider/yahoo-chart";

describe("mapChartQuotesToDailyBars", () => {
  it("maps valid quotes and skips rows with null OHLC", () => {
    const bars = mapChartQuotesToDailyBars([
      {
        date: new Date("2024-01-02T00:00:00.000Z"),
        open: 10,
        high: 11,
        low: 9,
        close: 10.5,
        volume: 1_000,
        adjclose: 10.4,
      },
      {
        date: new Date("2024-01-03T00:00:00.000Z"),
        open: null,
        high: 11,
        low: 9,
        close: 10,
        volume: 500,
      },
    ]);

    expect(bars).toHaveLength(1);
    expect(bars[0]).toMatchObject({
      date: "2024-01-02",
      open: 10,
      high: 11,
      low: 9,
      close: 10.5,
      volume: 1000,
      adjClose: 10.4,
    });
  });

  it("uses null adjClose when missing and rounds volume", () => {
    const bars = mapChartQuotesToDailyBars([
      {
        date: new Date("2024-06-15T12:00:00.000Z"),
        open: 1,
        high: 2,
        low: 0.5,
        close: 1.5,
        volume: 99.7,
      },
    ]);

    expect(bars[0].adjClose).toBeNull();
    expect(bars[0].volume).toBe(100);
  });
});
