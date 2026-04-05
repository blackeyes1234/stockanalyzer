import { describe, expect, it } from "vitest";
import { computeRsiWilder, computeSma } from "@/lib/backtest/indicators";

describe("computeSma", () => {
  it("averages the last period closes at each index", () => {
    const closes = [1, 2, 3, 4, 5];
    const sma = computeSma(closes, 3);
    expect(sma[0]).toBeNull();
    expect(sma[1]).toBeNull();
    expect(sma[2]).toBe(2);
    expect(sma[3]).toBe(3);
    expect(sma[4]).toBe(4);
  });
});

describe("computeRsiWilder", () => {
  it("matches hand-calculated first RSI for period 3", () => {
    const closes = [10, 12, 11, 13];
    const rsi = computeRsiWilder(closes, 3);
    expect(rsi[0]).toBeNull();
    expect(rsi[1]).toBeNull();
    expect(rsi[2]).toBeNull();
    // Changes 1..3: +2, -1, +2 → avgGain = 4/3, avgLoss = 1/3 → RS = 4 → RSI = 80
    expect(rsi[3]).toBeCloseTo(80, 5);
  });

  it("stays within 0..100 on a random walk", () => {
    const closes: number[] = [100];
    for (let i = 1; i < 80; i++) {
      closes.push(closes[i - 1]! + (i % 5) - 2);
    }
    const rsi = computeRsiWilder(closes, 14);
    for (let i = 0; i < closes.length; i++) {
      const v = rsi[i];
      if (v !== null) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });
});
