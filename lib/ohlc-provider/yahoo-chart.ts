import type { ChartResultArrayQuote } from "yahoo-finance2/modules/chart";
import {
  withYahooTimeout,
  YahooRequestTimeoutError,
  yahooFinance,
  YAHOO_REQUEST_TIMEOUT_MS,
} from "@/lib/yahoo-client";
import type { DailyBar, OhlcProvider } from "./types";

function formatTradeDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Maps Yahoo `chart` array-format quotes to `DailyBar` rows (exported for tests). */
export function mapChartQuotesToDailyBars(
  quotes: ChartResultArrayQuote[],
): DailyBar[] {
  const out: DailyBar[] = [];
  for (const q of quotes) {
    if (
      q.open == null ||
      q.high == null ||
      q.low == null ||
      q.close == null
    ) {
      continue;
    }
    const date = q.date instanceof Date ? q.date : new Date(String(q.date));
    if (Number.isNaN(date.getTime())) continue;

    const adj =
      q.adjclose != null && Number.isFinite(q.adjclose) ? q.adjclose : null;
    const vol = q.volume != null && Number.isFinite(q.volume) ? q.volume : 0;

    out.push({
      date: formatTradeDate(date),
      open: q.open,
      high: q.high,
      low: q.low,
      close: q.close,
      volume: Math.round(vol),
      adjClose: adj,
    });
  }
  return out;
}

export function createYahooChartOhlcProvider(): OhlcProvider {
  return {
    async fetchDailyHistory(yahooStyleTicker: string): Promise<DailyBar[]> {
      const symbol = yahooStyleTicker.trim();
      if (!symbol) {
        throw new Error("Missing symbol.");
      }

      try {
        const result = await withYahooTimeout(
          yahooFinance.chart(symbol, {
            period1: new Date("1970-01-01"),
            interval: "1d",
            return: "array",
          }),
          YAHOO_REQUEST_TIMEOUT_MS,
        );

        const quotes = result.quotes ?? [];
        const bars = mapChartQuotesToDailyBars(quotes);
        if (bars.length === 0) {
          throw new Error(
            `No daily price data returned for ${symbol}. The symbol may be invalid or delisted.`,
          );
        }
        return bars;
      } catch (e) {
        if (e instanceof YahooRequestTimeoutError) {
          throw new Error(
            "Request timed out while loading historical prices. Please try again.",
          );
        }
        if (e instanceof Error) {
          throw e;
        }
        throw new Error(
          "Failed to download OHLC data from Yahoo Finance.",
        );
      }
    },
  };
}
