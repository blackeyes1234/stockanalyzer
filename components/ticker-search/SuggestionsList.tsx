"use client";

import { memo } from "react";
import type { TickerSuggestion } from "@/app/actions/search-ticker";

export type SuggestionsListProps = {
  listId: string;
  suggestions: TickerSuggestion[];
  activeIndex: number;
  loading: boolean;
  visible: boolean;
  onSelect: (s: TickerSuggestion) => void;
  onItemHover: (index: number) => void;
};

export const SuggestionsList = memo(function SuggestionsList({
  listId,
  suggestions,
  activeIndex,
  loading,
  visible,
  onSelect,
  onItemHover,
}: SuggestionsListProps) {
  if (!visible) return null;

  return (
    <ul
      id={listId}
      role="listbox"
      aria-label="Ticker and company suggestions"
      aria-busy={loading && suggestions.length === 0}
      className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-950"
    >
      {loading && suggestions.length === 0 ? (
        <li
          className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400"
          role="status"
          aria-live="polite"
        >
          Loading suggestions…
        </li>
      ) : null}
      {suggestions.map((s, index) => {
        const optionLabel = [s.symbol, s.name, s.exchange]
          .filter(Boolean)
          .join(", ");
        return (
          <li
            key={`${s.symbol}-${index}`}
            id={`${listId}-option-${index}`}
            role="option"
            aria-label={optionLabel}
            aria-selected={index === activeIndex}
            className={`cursor-pointer px-4 py-2.5 text-left text-sm transition ${
              index === activeIndex
                ? "bg-zinc-100 dark:bg-zinc-800"
                : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
            }`}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => onItemHover(index)}
            onClick={() => onSelect(s)}
          >
            <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              {s.symbol}
            </span>
            <span className="mt-0.5 block text-zinc-600 dark:text-zinc-400">
              {s.name}
              {s.exchange ? (
                <span className="text-zinc-400 dark:text-zinc-500">
                  {" "}
                  · {s.exchange}
                </span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
});
