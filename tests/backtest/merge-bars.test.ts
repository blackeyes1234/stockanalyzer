import { describe, expect, it } from "vitest";
import { mergeSignalAndExecutionBars } from "@/lib/backtest/merge-bars";

describe("mergeSignalAndExecutionBars", () => {
  it("inner-joins by date and maps execution OHLC fields", () => {
    const signal = [
      { date: "2024-01-02", open: 1, close: 10 },
      { date: "2024-01-03", open: 2, close: 20 },
      { date: "2024-01-04", open: 3, close: 30 },
    ];
    const exec = [
      { date: "2024-01-02", open: 100, close: 110 },
      { date: "2024-01-04", open: 300, close: 330 },
    ];
    const m = mergeSignalAndExecutionBars(signal, exec);
    expect(m).toEqual([
      {
        date: "2024-01-02",
        signalClose: 10,
        execOpen: 100,
        execClose: 110,
      },
      {
        date: "2024-01-04",
        signalClose: 30,
        execOpen: 300,
        execClose: 330,
      },
    ]);
  });
});
