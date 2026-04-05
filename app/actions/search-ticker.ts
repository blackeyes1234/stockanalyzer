"use server";

import YahooFinance from "yahoo-finance2";
import type { SearchQuoteYahoo } from "yahoo-finance2/modules/search";
import {
  SEARCH_QUERY_MAX_LENGTH,
  SEARCH_QUERY_MIN_LENGTH,
} from "@/lib/search-constraints";
import { checkSearchRateLimit } from "@/lib/server-rate-limit";

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
});

const TICKER_PATTERN = /^[A-Z0-9.^\-]{1,20}$/;
const PREFERRED_QUOTE_TYPES = new Set(["EQUITY", "ETF"]);
const REQUEST_TIMEOUT_MS = 15_000;

class RequestTimeoutError extends Error {
  constructor() {
    super("Request timed out");
    this.name = "RequestTimeoutError";
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new RequestTimeoutError()),
      ms,
    );
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

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
    const quote = await withTimeout(
      yahooFinance.quote(symbol),
      REQUEST_TIMEOUT_MS,
    );

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
  } catch (e) {
    console.error("[searchTicker] quote failed", symbol, e);
    if (e instanceof RequestTimeoutError) {
      return {
        success: false,
        error: "Request timed out. Please try again.",
      };
    }
    return {
      success: false,
      error: "Ticker not found or unavailable.",
    };
  }
}

export async function suggestTickers(raw: string): Promise<SuggestTickersResult> {
  const limited = await checkSearchRateLimit("suggestTickers");
  if (!limited.ok) {
    return { success: false };
  }

  const trimmed = raw.trim();
  if (
    trimmed.length < SEARCH_QUERY_MIN_LENGTH ||
    trimmed.length > SEARCH_QUERY_MAX_LENGTH
  ) {
    return { success: true, suggestions: [] };
  }

  try {
    const results = await withTimeout(
      yahooFinance.search(trimmed, { quotesCount: 10 }),
      REQUEST_TIMEOUT_MS,
    );
    const picked = pickSearchQuotes(results.quotes);
    const suggestions = picked.slice(0, 10).map(toSuggestion);
    return { success: true, suggestions };
  } catch (e) {
    console.error("[suggestTickers] search failed", e);
    return { success: false };
  }
}

export async function searchTicker(raw: string): Promise<SearchTickerResult> {
  const limited = await checkSearchRateLimit("searchTicker");
  if (!limited.ok) {
    return { success: false, error: limited.error };
  }

  const trimmed = raw.trim();

  if (!trimmed) {
    return {
      success: false,
      error: "Enter a ticker or company name.",
    };
  }

  if (trimmed.length > SEARCH_QUERY_MAX_LENGTH) {
    return {
      success: false,
      error: `Use at most ${SEARCH_QUERY_MAX_LENGTH} characters.`,
    };
  }

  const upper = trimmed.toUpperCase();

  if (TICKER_PATTERN.test(upper)) {
    return quoteToResult(upper);
  }

  try {
    const results = await withTimeout(
      yahooFinance.search(trimmed, { quotesCount: 5 }),
      REQUEST_TIMEOUT_MS,
    );
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
  } catch (e) {
    console.error("[searchTicker] name search failed", e);
    if (e instanceof RequestTimeoutError) {
      return {
        success: false,
        error: "Request timed out. Please try again.",
      };
    }
    return {
      success: false,
      error: "Something went wrong. Please try again.",
    };
  }
}
