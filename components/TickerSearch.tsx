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
  type TransitionEvent as ReactTransitionEvent,
} from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import {
  searchTicker,
  suggestTickers,
  type SearchTickerData,
  type SearchTickerResult,
  type TickerSuggestion,
} from "@/app/actions/search-ticker";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

const SUGGEST_DEBOUNCE_MS = 300;
const DETAIL_FADE_MS = 320;
/** Raw input length; search is blocked until the user shortens the field. */
const INPUT_MAX_LENGTH = 100;

type SearchErrorAlertProps = { message: string };

const SearchErrorAlert = memo(function SearchErrorAlert({
  message,
}: SearchErrorAlertProps) {
  return (
    <p
      className="text-sm font-medium text-red-600 motion-safe:animate-[stock-detail-fade-in_320ms_ease-out] dark:text-red-400"
      role="alert"
    >
      {message}
    </p>
  );
});

const SearchResultCard = memo(function SearchResultCard({
  data,
}: {
  data: SearchTickerData;
}) {
  return (
    <div
      className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80"
      aria-live="polite"
    >
      <dl className="space-y-4">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Ticker symbol
          </dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
            {data.ticker}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Company name
          </dt>
          <dd className="mt-1 text-base leading-relaxed text-zinc-800 dark:text-zinc-200">
            {data.companyName}
          </dd>
        </div>
      </dl>
    </div>
  );
});

type DetailPhase = "enter" | "visible" | "leave";

type StockDetailWindowProps = {
  data: SearchTickerData;
  phase: DetailPhase;
  onEntered: () => void;
  onLeaveComplete: () => void;
};

const StockDetailWindow = memo(function StockDetailWindow({
  data,
  phase,
  onEntered,
  onLeaveComplete,
}: StockDetailWindowProps) {
  const leaveSettledRef = useRef(false);

  const opacityClass =
    phase === "visible" ? "opacity-100" : "opacity-0";

  useEffect(() => {
    if (phase !== "enter") return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        onEntered();
      });
    });
    return () => cancelAnimationFrame(id);
  }, [phase, onEntered]);

  useEffect(() => {
    if (phase !== "leave") return;
    leaveSettledRef.current = false;
    const t = window.setTimeout(() => {
      if (leaveSettledRef.current) return;
      leaveSettledRef.current = true;
      onLeaveComplete();
    }, DETAIL_FADE_MS + 120);
    return () => window.clearTimeout(t);
  }, [phase, onLeaveComplete]);

  function handleTransitionEnd(e: ReactTransitionEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    if (e.propertyName !== "opacity") return;
    if (phase !== "leave") return;
    if (leaveSettledRef.current) return;
    leaveSettledRef.current = true;
    onLeaveComplete();
  }

  return (
    <div
      className={`rounded-xl transition-opacity ease-out motion-reduce:transition-none ${opacityClass}`}
      style={{
        transitionDuration: `${DETAIL_FADE_MS}ms`,
      }}
      onTransitionEnd={handleTransitionEnd}
    >
      <SearchResultCard data={data} />
    </div>
  );
});

type SuggestionsListProps = {
  listId: string;
  suggestions: TickerSuggestion[];
  activeIndex: number;
  loading: boolean;
  visible: boolean;
  onSelect: (s: TickerSuggestion) => void;
  onItemHover: (index: number) => void;
};

const SuggestionsList = memo(function SuggestionsList({
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

function TickerSearchInner() {
  const [ticker, setTicker] = useState("");
  const debouncedTicker = useDebouncedValue(ticker, SUGGEST_DEBOUNCE_MS);
  const debouncedQuery = debouncedTicker.trim();

  type DetailState = { data: SearchTickerData; phase: DetailPhase } | null;

  const [detail, setDetail] = useState<DetailState>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pendingErrorRef = useRef<string | null>(null);
  const [suggestions, setSuggestions] = useState<TickerSuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isPending, startTransition] = useTransition();

  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const inputLengthErrorId = useId();
  const blurCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** After a search finishes, next character replaces the field for a new search. */
  const replaceNextInputRef = useRef(false);

  const tickerTrim = ticker.trim();
  const inputTooLong = ticker.length > INPUT_MAX_LENGTH;
  const isDebouncingSuggest =
    tickerTrim.length >= 2 &&
    tickerTrim.length <= 64 &&
    tickerTrim !== debouncedQuery;

  const clearBlurTimer = useCallback(() => {
    if (blurCloseTimerRef.current !== null) {
      clearTimeout(blurCloseTimerRef.current);
      blurCloseTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const q = debouncedQuery;
    if (q.length < 2 || q.length > 64) {
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

  const applyReplaceKeystroke = useCallback((char: string) => {
    flushSync(() => {
      replaceNextInputRef.current = false;
      setTicker(char);
      setMenuOpen(true);
      setActiveIndex(-1);
    });
  }, []);

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

      e.preventDefault();
      inputRef.current?.focus();
      setTicker((prev) => prev + e.key);
      setMenuOpen(true);
      setActiveIndex(-1);
    }

    window.addEventListener("keydown", onGlobalKeyDown, true);
    return () => window.removeEventListener("keydown", onGlobalKeyDown, true);
  }, [applyReplaceKeystroke]);

  const flushError = useCallback((message: string) => {
    setDetail((current) => {
      if (current?.phase === "visible" || current?.phase === "enter") {
        pendingErrorRef.current = message;
        return { data: current.data, phase: "leave" };
      }
      if (current?.phase === "leave") {
        pendingErrorRef.current = message;
        return current;
      }
      queueMicrotask(() => {
        setErrorMessage(message);
      });
      return current;
    });
  }, []);

  const commitSuccess = useCallback((data: SearchTickerData) => {
    pendingErrorRef.current = null;
    setErrorMessage(null);
    setDetail({ data, phase: "enter" });
  }, []);

  const onDetailEntered = useCallback(() => {
    setDetail((d) =>
      d?.phase === "enter" ? { ...d, phase: "visible" } : d,
    );
  }, []);

  const onDetailLeaveComplete = useCallback(() => {
    const msg = pendingErrorRef.current;
    pendingErrorRef.current = null;
    setDetail(null);
    if (msg) setErrorMessage(msg);
  }, []);

  const finalizeSearchResult = useCallback(
    (res: SearchTickerResult) => {
      replaceNextInputRef.current = true;
      if (res.success) {
        commitSuccess(res.data);
        toast.success(`Successfully added ${res.data.ticker}`);
      } else {
        flushError(res.error);
        toast.error(res.error);
      }
    },
    [commitSuccess, flushError],
  );

  const runSearch = useCallback(
    (value: string) => {
      if (value.length > INPUT_MAX_LENGTH) {
        inputRef.current?.focus();
        return;
      }
      const v = value.trim();
      if (!v) {
        inputRef.current?.focus();
        const msg = "Enter a ticker or company name.";
        flushError(msg);
        toast.error(msg);
        return;
      }
      startTransition(async () => {
        setErrorMessage(null);
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
    [finalizeSearchResult, flushError],
  );

  const selectSuggestion = useCallback(
    (s: TickerSuggestion) => {
      clearBlurTimer();
      setTicker(s.symbol);
      setMenuOpen(false);
      setActiveIndex(-1);
      setSuggestions([]);
      startTransition(async () => {
        setErrorMessage(null);
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
    [clearBlurTimer, finalizeSearchResult],
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
    tickerTrim.length >= 2 &&
    tickerTrim.length <= 64 &&
    (isDebouncingSuggest || suggestLoading);

  const showSuggestionsPanel =
    menuOpen &&
    tickerTrim.length >= 2 &&
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
              aria-expanded={menuOpen}
              aria-controls={showSuggestionsPanel ? listId : undefined}
              aria-autocomplete="list"
              aria-activedescendant={
                menuOpen && activeIndex >= 0
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
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:outline-zinc-900"
          >
            {isPending && (
              <span
                className="size-4 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white dark:border-zinc-900/30 dark:border-t-zinc-900"
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
            role="alert"
          >
            Use at most {INPUT_MAX_LENGTH} characters in the search field.
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
