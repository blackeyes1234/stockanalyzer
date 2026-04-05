import { describe, expect, it } from "vitest";
import {
  runQqqRsiSmaBacktest,
  summarizeCompletedTrades,
} from "@/lib/backtest/qqq-rsi-sma";
import type { AlignedBar, CompletedTrade } from "@/lib/backtest/types";

function isoDay(base: Date, addDays: number): string {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + addDays);
  return d.toISOString().slice(0, 10);
}

describe("summarizeCompletedTrades", () => {
  it("computes win rate and profit factor from completed trades", () => {
    const trades: CompletedTrade[] = [
      {
        entryDate: "a",
        exitDate: "b",
        entryOpen: 100,
        exitOpen: 110,
        simpleReturn: 0.1,
        win: true,
      },
      {
        entryDate: "c",
        exitDate: "d",
        entryOpen: 100,
        exitOpen: 95,
        simpleReturn: -0.05,
        win: false,
      },
    ];
    const s = summarizeCompletedTrades(trades);
    expect(s.wins).toBe(1);
    expect(s.winRate).toBeCloseTo(0.5, 5);
    expect(s.avgWin).toBeCloseTo(0.1, 5);
    expect(s.avgLoss).toBeCloseTo(-0.05, 5);
    expect(s.profitFactor).toBeCloseTo(0.1 / 0.05, 5);
  });

  it("returns null aggregates when there are no trades", () => {
    const s = summarizeCompletedTrades([]);
    expect(s.winRate).toBeNull();
    expect(s.avgWin).toBeNull();
    expect(s.avgLoss).toBeNull();
    expect(s.profitFactor).toBeNull();
    expect(s.wins).toBe(0);
  });
});

describe("runQqqRsiSmaBacktest", () => {
  it("returns null win rate and no trades for empty or short series", () => {
    const empty = runQqqRsiSmaBacktest([], {
      rsiPeriod: 14,
      smaPeriod: 200,
      oversold: 30,
      overbought: 70,
    });
    expect(empty.completedTrades).toEqual([]);
    expect(empty.winRate).toBeNull();

    const oneBar: AlignedBar[] = [
      {
        date: "2024-01-02",
        signalClose: 100,
        execOpen: 100,
        execClose: 100,
      },
    ];
    const short = runQqqRsiSmaBacktest(oneBar, {
      rsiPeriod: 14,
      smaPeriod: 200,
      oversold: 30,
      overbought: 70,
    });
    expect(short.completedTrades).toEqual([]);
    expect(short.winRate).toBeNull();
  });

  it("finds at least one round-trip on a bounded synthetic path (trend strictly above SMA)", () => {
    const base = new Date(Date.UTC(2024, 0, 1));
    let found = false;
    for (let len = 40; len <= 220 && !found; len += 5) {
      const aligned: AlignedBar[] = [];
      for (let i = 0; i < len; i++) {
        const signalClose = 100 + 25 * Math.sin(i * 0.35) + i * 0.08;
        aligned.push({
          date: isoDay(base, i),
          signalClose,
          execOpen: 100,
          execClose: signalClose,
        });
      }
      const r = runQqqRsiSmaBacktest(aligned, {
        rsiPeriod: 2,
        smaPeriod: 8,
        oversold: 38,
        overbought: 62,
      });
      if (r.completedTrades.length > 0) {
        found = true;
        expect(r.winRate).not.toBeNull();
        expect(r.wins).toBe(
          r.completedTrades.filter((t) => t.win).length,
        );
        for (const t of r.completedTrades) {
          expect(t.simpleReturn).toBeCloseTo(t.exitOpen / t.entryOpen - 1, 8);
        }
      }
    }
    expect(found).toBe(true);
  });

  it("marks a win when exit open exceeds entry open on the same path", () => {
    const base = new Date(Date.UTC(2024, 0, 1));
    for (let len = 40; len <= 220; len += 5) {
      const aligned: AlignedBar[] = [];
      for (let i = 0; i < len; i++) {
        const signalClose = 100 + 25 * Math.sin(i * 0.35) + i * 0.08;
        aligned.push({
          date: isoDay(base, i),
          signalClose,
          execOpen: 100 + i * 0.2,
          execClose: signalClose,
        });
      }
      const r = runQqqRsiSmaBacktest(aligned, {
        rsiPeriod: 2,
        smaPeriod: 8,
        oversold: 38,
        overbought: 62,
      });
      const winning = r.completedTrades.filter((t) => t.win);
      if (winning.length > 0) {
        const w = winning[0]!;
        expect(w.exitOpen).toBeGreaterThan(w.entryOpen);
        expect(w.simpleReturn).toBeGreaterThan(0);
        return;
      }
    }
    expect.fail("expected at least one winning trade on rising execution opens");
  });
});
