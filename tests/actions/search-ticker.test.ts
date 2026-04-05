import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({
    get(name: string) {
      if (name === "x-forwarded-for") return "127.0.0.1";
      return null;
    },
  })),
}));

const { mockQuote, mockSearch } = vi.hoisted(() => ({
  mockQuote: vi.fn(),
  mockSearch: vi.fn(),
}));

vi.mock("yahoo-finance2", () => ({
  default: class MockYahooFinance {
    constructor() {}
    quote = mockQuote;
    search = mockSearch;
  },
}));

import {
  searchTicker,
  suggestTickers,
} from "@/app/actions/search-ticker";
import { SEARCH_QUERY_MAX_LENGTH } from "@/lib/search-constraints";

describe("searchTicker", () => {
  beforeEach(() => {
    mockQuote.mockReset();
    mockSearch.mockReset();
  });

  it("returns error for empty input", async () => {
    const r = await searchTicker("   ");
    expect(r).toEqual({
      success: false,
      error: "Enter a ticker or company name.",
    });
    expect(mockQuote).not.toHaveBeenCalled();
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("returns error when input exceeds max length", async () => {
    const r = await searchTicker("x".repeat(SEARCH_QUERY_MAX_LENGTH + 1));
    expect(r).toEqual({
      success: false,
      error: `Use at most ${SEARCH_QUERY_MAX_LENGTH} characters.`,
    });
    expect(mockQuote).not.toHaveBeenCalled();
  });

  it("resolves ticker-shaped input via quote()", async () => {
    mockQuote.mockResolvedValue({
      symbol: "AAPL",
      longName: "Apple Inc.",
      shortName: "Apple",
    });

    const r = await searchTicker("aapl");

    expect(r).toEqual({
      success: true,
      data: { ticker: "AAPL", companyName: "Apple Inc." },
    });
    expect(mockQuote).toHaveBeenCalledWith("AAPL");
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("returns error when quote() throws", async () => {
    mockQuote.mockRejectedValue(new Error("network"));

    const r = await searchTicker("MSFT");

    expect(r).toEqual({
      success: false,
      error: "Ticker not found or unavailable.",
    });
  });

  it("resolves company-style input via search() then quote()", async () => {
    mockSearch.mockResolvedValue({
      quotes: [
        {
          isYahooFinance: true,
          symbol: "MSFT",
          quoteType: "EQUITY",
          longname: "Microsoft Corporation",
        },
      ],
    });
    mockQuote.mockResolvedValue({
      symbol: "MSFT",
      longName: "Microsoft Corporation",
    });

    const r = await searchTicker("Microsoft Corp");

    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.ticker).toBe("MSFT");
      expect(r.data.companyName).toBe("Microsoft Corporation");
    }
    expect(mockSearch).toHaveBeenCalled();
    expect(mockQuote).toHaveBeenCalledWith("MSFT");
  });

  it("returns error when name search has no Yahoo quotes", async () => {
    mockSearch.mockResolvedValue({ quotes: [] });

    const r = await searchTicker("orphan zzzz");

    expect(r).toEqual({
      success: false,
      error:
        "No matches found. Try a different name or pick from suggestions.",
    });
    expect(mockQuote).not.toHaveBeenCalled();
  });

  it("returns generic error when name search throws", async () => {
    mockSearch.mockRejectedValue(new Error("timeout"));

    const r = await searchTicker("Some Company");

    expect(r).toEqual({
      success: false,
      error: "Something went wrong. Please try again.",
    });
  });
});

describe("suggestTickers", () => {
  beforeEach(() => {
    mockQuote.mockReset();
    mockSearch.mockReset();
  });

  it("returns empty suggestions for short query", async () => {
    const r = await suggestTickers("a");
    expect(r).toEqual({ success: true, suggestions: [] });
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("returns empty suggestions for over-long query", async () => {
    const r = await suggestTickers("x".repeat(SEARCH_QUERY_MAX_LENGTH + 1));
    expect(r).toEqual({ success: true, suggestions: [] });
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("maps search quotes to suggestions", async () => {
    mockSearch.mockResolvedValue({
      quotes: [
        {
          isYahooFinance: true,
          symbol: "AAPL",
          quoteType: "EQUITY",
          longname: "Apple Inc.",
          exchange: "NMS",
        },
      ],
    });

    const r = await suggestTickers("app");

    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.suggestions).toHaveLength(1);
      expect(r.suggestions[0]).toMatchObject({
        symbol: "AAPL",
        name: "Apple Inc.",
      });
    }
  });

  it("returns success false on search failure", async () => {
    mockSearch.mockRejectedValue(new Error("fail"));

    const r = await suggestTickers("app");

    expect(r).toEqual({ success: false });
  });
});
