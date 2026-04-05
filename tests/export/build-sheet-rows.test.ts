import { describe, expect, it } from "vitest";
import { buildSheetRows } from "@/lib/export/build-sheet-rows";
import { computeRsiWilder, computeSma } from "@/lib/backtest/indicators";

describe("buildSheetRows", () => {
  it("returns only headers when bars are empty", () => {
    const rows = buildSheetRows([]);
    expect(rows).toEqual([
      [
        "date",
        "open",
        "high",
        "low",
        "close",
        "volume",
        "rsi_14",
        "sma_200",
      ],
    ]);
  });

  it("aligns rsi_14 and sma_200 with indicator helpers", () => {
    const bars = [
      {
        date: "2024-01-01",
        open: 10,
        high: 11,
        low: 9,
        close: 10,
        volume: 100,
      },
      {
        date: "2024-01-02",
        open: 10,
        high: 12,
        low: 10,
        close: 12,
        volume: 200,
      },
      {
        date: "2024-01-03",
        open: 12,
        high: 13,
        low: 11,
        close: 11,
        volume: 150,
      },
      {
        date: "2024-01-04",
        open: 11,
        high: 12,
        low: 10,
        close: 13,
        volume: 120,
      },
    ];
    const closes = bars.map((b) => b.close);
    const rsi = computeRsiWilder(closes, 14);
    const sma = computeSma(closes, 200);

    const rows = buildSheetRows(bars);
    expect(rows.length).toBe(5);
    expect(rows[0]).toEqual([
      "date",
      "open",
      "high",
      "low",
      "close",
      "volume",
      "rsi_14",
      "sma_200",
    ]);

    for (let i = 0; i < bars.length; i++) {
      const dataRow = rows[i + 1]!;
      expect(dataRow[0]).toBe(bars[i]!.date);
      expect(dataRow[1]).toBe(bars[i]!.open);
      expect(dataRow[5]).toBe(bars[i]!.volume);
      const r = rsi[i];
      const s = sma[i];
      if (r === null) expect(dataRow[6]).toBe("");
      else expect(dataRow[6]).toBeCloseTo(r, 5);
      if (s === null) expect(dataRow[7]).toBe("");
      else expect(dataRow[7]).toBeCloseTo(s, 5);
    }
  });
});
