"use server";

import YahooFinance from "yahoo-finance2";
import type { SearchQuoteYahoo } from "yahoo-finance2/modules/search";

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
});

const TICKER_PATTERN = /^[A-Z0-9.^\-]{1,20}$/;
const QUERY_MAX = 64;
const PREFERRED_QUOTE_TYPES = new Set(["EQUITY", "ETF"]);

export type SearchTickerData = {
  ticker: string;
  companyName: string;
};

export type SearchTickerResult =
  | { success: true; data: SearchTickerData }
  | { success: false; error: string };

export type TickerSuggestion = {
  symbol: string;
  name: string;
  exchange?: string;
};

export type SuggestTickersResult =
  | { success: true; suggestions: TickerSuggestion[] }
  | { success: false };

function isYahooQuote(
  q: unknown,
): q is SearchQuoteYahoo & { symbol: string } {
  return (
    typeof q === "object" &&
    q !== null &&
    "isYahooFinance" in q &&
    q.isYahooFinance === true &&
    "symbol" in q &&
    typeof (q as { symbol: unknown }).symbol === "string" &&
    (q as { symbol: string }).symbol.length > 0
  );
}

function toSuggestion(q: SearchQuoteYahoo & { symbol: string }): TickerSuggestion {
  const name =
    (typeof q.longname === "string" && q.longname.trim()) ||
    (typeof q.shortname === "string" && q.shortname.trim()) ||
    q.symbol;
  const exchange =
    (typeof q.exchDisp === "string" && q.exchDisp) ||
    (typeof q.exchange === "string" && q.exchange) ||
    undefined;
  return { symbol: q.symbol, name, exchange };
}

function pickSearchQuotes(
  quotes: Array<SearchQuoteYahoo | (object & { isYahooFinance?: boolean })>,
): Array<SearchQuoteYahoo & { symbol: string }> {
  const yahoo = quotes.filter(isYahooQuote);
  const preferred = yahoo.filter(
    (q) =>
      "quoteType" in q &&
      typeof q.quoteType === "string" &&
      PREFERRED_QUOTE_TYPES.has(q.quoteType),
  );
  const list = preferred.length > 0 ? preferred : yahoo;
  return list;
}

async function quoteToResult(symbol: string): Promise<SearchTickerResult> {
  try {
    const quote = await yahooFinance.quote(symbol);

    const companyName =
      quote.longName?.trim() ||
      quote.shortName?.trim() ||
      quote.symbol ||
      symbol;

    return {
      success: true,
      data: {
        ticker: quote.symbol ?? symbol,
        companyName,
      },
    };
  } catch {
    return {
      success: false,
      error: "Ticker not found or unavailable.",
    };
  }
}

export async function suggestTickers(raw: string): Promise<SuggestTickersResult> {
  const trimmed = raw.trim();
  if (trimmed.length < 2 || trimmed.length > QUERY_MAX) {
    return { success: true, suggestions: [] };
  }

  try {
    const results = await yahooFinance.search(trimmed, { quotesCount: 10 });
    const picked = pickSearchQuotes(results.quotes);
    const suggestions = picked.slice(0, 10).map(toSuggestion);
    return { success: true, suggestions };
  } catch {
    return { success: true, suggestions: [] };
  }
}

export async function searchTicker(raw: string): Promise<SearchTickerResult> {
  const trimmed = raw.trim();

  if (!trimmed) {
    return {
      success: false,
      error: "Enter a ticker or company name.",
    };
  }

  if (trimmed.length > QUERY_MAX) {
    return {
      success: false,
      error: `Use at most ${QUERY_MAX} characters.`,
    };
  }

  const upper = trimmed.toUpperCase();

  if (TICKER_PATTERN.test(upper)) {
    return quoteToResult(upper);
  }

  try {
    const results = await yahooFinance.search(trimmed, { quotesCount: 5 });
    const picked = pickSearchQuotes(results.quotes);
    const first = picked[0];

    if (!first) {
      return {
        success: false,
        error:
          "No matches found. Try a different name or pick from suggestions.",
      };
    }

    return quoteToResult(first.symbol);
  } catch {
    return {
      success: false,
      error: "Ticker not found or unavailable.",
    };
  }
}
