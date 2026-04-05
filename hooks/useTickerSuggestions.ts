"use client";

import { useEffect, useState } from "react";
import { suggestTickers, type TickerSuggestion } from "@/app/actions/search-ticker";
import {
  SEARCH_QUERY_MAX_LENGTH,
  SEARCH_QUERY_MIN_LENGTH,
} from "@/lib/search-constraints";

/**
 * Fetches debounced autocomplete suggestions from the server.
 */
export function useTickerSuggestions(debouncedQuery: string) {
  const [suggestions, setSuggestions] = useState<TickerSuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const q = debouncedQuery;
    if (
      q.length < SEARCH_QUERY_MIN_LENGTH ||
      q.length > SEARCH_QUERY_MAX_LENGTH
    ) {
      setSuggestions([]);
      setSuggestLoading(false);
      return;
    }

    setSuggestLoading(true);
    void (async () => {
      try {
        const res = await suggestTickers(q);
        if (cancelled) return;
        if (res.success) {
          setSuggestions(res.suggestions);
        } else {
          setSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setSuggestLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  return { suggestions, suggestLoading, setSuggestions };
}
