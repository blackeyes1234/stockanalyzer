import { computeRsiWilder, computeSma } from "@/lib/backtest/indicators";

const RSI_PERIOD = 14;
const SMA_PERIOD = 200;

export type DailyBarExportInput = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const HEADERS = [
  "date",
  "open",
  "high",
  "low",
  "close",
  "volume",
  "rsi_14",
  "sma_200",
] as const;

/**
 * Builds a grid for Google Sheets: header row + one row per bar with RSI(14) and SMA(200) on closes.
 */
export function buildSheetRows(
  bars: DailyBarExportInput[],
): (string | number)[][] {
  if (bars.length === 0) {
    return [Array.from(HEADERS)];
  }

  const closes = bars.map((b) => b.close);
  const rsi = computeRsiWilder(closes, RSI_PERIOD);
  const sma = computeSma(closes, SMA_PERIOD);

  const rows: (string | number)[][] = [Array.from(HEADERS)];

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i]!;
    const r = rsi[i];
    const s = sma[i];
    rows.push([
      b.date,
      b.open,
      b.high,
      b.low,
      b.close,
      b.volume,
      r === null ? "" : roundIndicator(r),
      s === null ? "" : roundIndicator(s),
    ]);
  }

  return rows;
}

function roundIndicator(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
