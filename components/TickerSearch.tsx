"use client";

import {
  memo,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { flushSync } from "react-dom";
import {
  searchTicker,
  type SearchTickerResult,
} from "@/app/actions/search-ticker";
import { SearchErrorAlert } from "@/components/ticker-search/SearchErrorAlert";
import { StockDetailWindow } from "@/components/ticker-search/StockDetailWindow";
import { SuggestionsList } from "@/components/ticker-search/SuggestionsList";
import { useStockDetailPanel } from "@/hooks/useStockDetailPanel";
import { useTickerSuggestions } from "@/hooks/useTickerSuggestions";
import {
  SEARCH_QUERY_MAX_LENGTH,
  SEARCH_QUERY_MIN_LENGTH,
} from "@/lib/search-constraints";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

const SUGGEST_DEBOUNCE_MS = 300;

function TickerSearchInner() {
  const [ticker, setTicker] = useState("");
  const debouncedTicker = useDebouncedValue(ticker, SUGGEST_DEBOUNCE_MS);
  const debouncedQuery = debouncedTicker.trim();

  const { suggestions, suggestLoading, setSuggestions } =
    useTickerSuggestions(debouncedQuery);

  const {
    detail,
    errorMessage,
    replaceNextInputRef,
    flushError,
    clearErrorMessage,
    onDetailEntered,
    onDetailLeaveComplete,
    finalizeSearchResult,
  } = useStockDetailPanel();

  const [menuOpen, setMenuOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isPending, startTransition] = useTransition();

  const inputRef = useRef<HTMLInputElement>(null);
  const tickerRef = useRef(ticker);
  const listId = useId();
  const inputLengthErrorId = useId();
  const blurCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    tickerRef.current = ticker;
  }, [ticker]);

  const tickerTrim = ticker.trim();
  const inputTooLong = ticker.length > SEARCH_QUERY_MAX_LENGTH;
  const isDebouncingSuggest =
    tickerTrim.length >= SEARCH_QUERY_MIN_LENGTH &&
    tickerTrim.length <= SEARCH_QUERY_MAX_LENGTH &&
    tickerTrim !== debouncedQuery;

  const clearBlurTimer = useCallback(() => {
    if (blurCloseTimerRef.current !== null) {
      clearTimeout(blurCloseTimerRef.current);
      blurCloseTimerRef.current = null;
    }
  }, []);

  const applyReplaceKeystroke = useCallback(
    (char: string) => {
      flushSync(() => {
        replaceNextInputRef.current = false;
        setTicker(char);
        setMenuOpen(true);
        setActiveIndex(-1);
      });
    },
    [replaceNextInputRef],
  );

  useEffect(() => {
    function isOtherEditableTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      const tag = target.tagName;
      if (tag === "TEXTAREA" || tag === "SELECT") return true;
      if (tag === "INPUT") {
        return target !== inputRef.current;
      }
      return false;
    }

    function onGlobalKeyDown(e: globalThis.KeyboardEvent) {
      if (e.defaultPrevented) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.repeat) return;

      const active = document.activeElement;
      if (active === inputRef.current) return;
      if (isOtherEditableTarget(e.target)) return;

      if (e.key === "Tab" || e.key === "Escape") return;

      const atMaxLength =
        tickerRef.current.length >= SEARCH_QUERY_MAX_LENGTH;

      if (replaceNextInputRef.current) {
        if (e.key === "Backspace") {
          e.preventDefault();
          inputRef.current?.focus();
          applyReplaceKeystroke("");
          return;
        }
        if (e.key.length === 1) {
          e.preventDefault();
          inputRef.current?.focus();
          applyReplaceKeystroke(e.key);
          return;
        }
      }

      if (e.key === "Backspace") {
        e.preventDefault();
        inputRef.current?.focus();
        setTicker((prev) => prev.slice(0, -1));
        setMenuOpen(true);
        setActiveIndex(-1);
        return;
      }

      if (e.key.length !== 1) return;

      if (atMaxLength) return;

      e.preventDefault();
      inputRef.current?.focus();
      setTicker((prev) => prev + e.key);
      setMenuOpen(true);
      setActiveIndex(-1);
    }

    window.addEventListener("keydown", onGlobalKeyDown, true);
    return () => window.removeEventListener("keydown", onGlobalKeyDown, true);
  }, [applyReplaceKeystroke, replaceNextInputRef]);

  const runSearch = useCallback(
    (value: string) => {
      if (value.length > SEARCH_QUERY_MAX_LENGTH) {
        inputRef.current?.focus();
        return;
      }
      const v = value.trim();
      if (!v) {
        inputRef.current?.focus();
        flushError("Enter a ticker or company name.");
        return;
      }
      startTransition(async () => {
        clearErrorMessage();
        try {
          const res = await searchTicker(v);
          finalizeSearchResult(res);
        } catch {
          const fallback: SearchTickerResult = {
            success: false,
            error: "Something went wrong. Please try again.",
          };
          finalizeSearchResult(fallback);
        }
      });
    },
    [clearErrorMessage, finalizeSearchResult, flushError],
  );

  const selectSuggestion = useCallback(
    (s: { symbol: string }) => {
      clearBlurTimer();
      setTicker(s.symbol);
      setMenuOpen(false);
      setActiveIndex(-1);
      setSuggestions([]);
      startTransition(async () => {
        clearErrorMessage();
        try {
          const res = await searchTicker(s.symbol);
          finalizeSearchResult(res);
        } catch {
          const fallback: SearchTickerResult = {
            success: false,
            error: "Something went wrong. Please try again.",
          };
          finalizeSearchResult(fallback);
        }
      });
    },
    [clearBlurTimer, clearErrorMessage, finalizeSearchResult, setSuggestions],
  );

  const handleItemHover = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    clearBlurTimer();
    setMenuOpen(false);
    setActiveIndex(-1);
    runSearch(ticker);
  }

  function handleInputKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (replaceNextInputRef.current) {
      if (e.key === "Backspace") {
        e.preventDefault();
        applyReplaceKeystroke("");
        return;
      }
      if (
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        applyReplaceKeystroke(e.key);
        return;
      }
    }

    const suggestBusy = isDebouncingSuggest || suggestLoading;
    const open = menuOpen && (suggestBusy || suggestions.length > 0);

    if (e.key === "ArrowDown") {
      if (!open && suggestions.length > 0) {
        setMenuOpen(true);
        setActiveIndex(0);
        e.preventDefault();
        return;
      }
      if (open && suggestions.length > 0) {
        e.preventDefault();
        setActiveIndex((i) =>
          i < suggestions.length - 1 ? i + 1 : i,
        );
      }
      return;
    }

    if (e.key === "ArrowUp") {
      if (open && suggestions.length > 0) {
        e.preventDefault();
        setActiveIndex((i) => (i > 0 ? i - 1 : 0));
      }
      return;
    }

    if (e.key === "Escape") {
      if (menuOpen) {
        e.preventDefault();
        setMenuOpen(false);
        setActiveIndex(-1);
      }
      return;
    }

    if (e.key === "Enter" && open && suggestions.length > 0) {
      const idx = activeIndex >= 0 ? activeIndex : 0;
      const pick = suggestions[idx];
      if (pick) {
        e.preventDefault();
        selectSuggestion(pick);
      }
      return;
    }
  }

  const showSuggestSpinner =
    tickerTrim.length >= SEARCH_QUERY_MIN_LENGTH &&
    tickerTrim.length <= SEARCH_QUERY_MAX_LENGTH &&
    (isDebouncingSuggest || suggestLoading);

  const showSuggestionsPanel =
    menuOpen &&
    tickerTrim.length >= SEARCH_QUERY_MIN_LENGTH &&
    (showSuggestSpinner || suggestions.length > 0);

  return (
    <div className="w-full space-y-6">
      <form
        onSubmit={handleSubmit}
        className="space-y-4"
        aria-label="Stock ticker and company search"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <label htmlFor="ticker-input" className="sr-only">
            Ticker or company name
          </label>
          <div className="relative min-w-0 flex-1">
            <input
              ref={inputRef}
              id="ticker-input"
              name="ticker"
              type="text"
              role="combobox"
              aria-invalid={inputTooLong}
              aria-describedby={
                inputTooLong ? inputLengthErrorId : undefined
              }
              aria-expanded={showSuggestionsPanel}
              aria-controls={showSuggestionsPanel ? listId : undefined}
              aria-autocomplete="list"
              aria-activedescendant={
                showSuggestionsPanel && activeIndex >= 0
                  ? `${listId}-option-${activeIndex}`
                  : undefined
              }
              value={ticker}
              onChange={(e) => {
                setTicker(e.target.value);
                setMenuOpen(true);
                setActiveIndex(-1);
              }}
              onKeyDown={handleInputKeyDown}
              onFocus={() => {
                clearBlurTimer();
                setMenuOpen(true);
              }}
              onBlur={() => {
                blurCloseTimerRef.current = setTimeout(() => {
                  setMenuOpen(false);
                  setActiveIndex(-1);
                  blurCloseTimerRef.current = null;
                }, 150);
              }}
              placeholder="Ticker or company (e.g., AAPL or Apple)"
              autoComplete="off"
              spellCheck={false}
              disabled={isPending}
              className={`min-h-11 w-full rounded-lg border bg-white px-4 py-2.5 pr-10 text-base text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-60 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus-visible:ring-offset-zinc-950 ${
                inputTooLong
                  ? "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-200 dark:border-red-500 dark:focus-visible:border-red-400 dark:focus-visible:ring-red-950/60"
                  : "border-zinc-200 focus-visible:border-zinc-400 focus-visible:ring-zinc-400 dark:border-zinc-700 dark:focus-visible:border-zinc-500 dark:focus-visible:ring-zinc-500"
              }`}
            />
            {showSuggestSpinner && (
              <span
                className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300"
                aria-hidden
              />
            )}
            <SuggestionsList
              listId={listId}
              suggestions={suggestions}
              activeIndex={activeIndex}
              loading={suggestLoading}
              visible={showSuggestionsPanel}
              onSelect={selectSuggestion}
              onItemHover={handleItemHover}
            />
          </div>
          <button
            type="submit"
            disabled={isPending || inputTooLong}
            aria-busy={isPending}
            aria-label={
              isPending
                ? "Searching for stock, please wait"
                : "Submit search for ticker or company"
            }
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-green-700 focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-green-600 dark:hover:bg-green-500 dark:focus-visible:outline-green-400"
          >
            {isPending && (
              <span
                className="size-4 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white"
                aria-hidden
              />
            )}
            {isPending ? "Searching…" : "Search"}
          </button>
        </div>
        {inputTooLong ? (
          <p
            id={inputLengthErrorId}
            className="text-sm font-medium text-red-600 dark:text-red-400"
            role="status"
            aria-live="polite"
          >
            Use at most {SEARCH_QUERY_MAX_LENGTH} characters in the search field.
          </p>
        ) : null}
      </form>

      {errorMessage ? (
        <SearchErrorAlert message={errorMessage} />
      ) : null}

      {detail ? (
        <StockDetailWindow
          key={detail.data.ticker}
          data={detail.data}
          phase={detail.phase}
          onEntered={onDetailEntered}
          onLeaveComplete={onDetailLeaveComplete}
        />
      ) : null}
    </div>
  );
}

export const TickerSearch = memo(TickerSearchInner);
