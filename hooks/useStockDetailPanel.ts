"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  SearchTickerData,
  SearchTickerResult,
} from "@/app/actions/search-ticker";
import type { DetailState } from "@/components/ticker-search/types";

/**
 * Manages success detail panel transitions, deferred errors, and replace-mode ref.
 */
export function useStockDetailPanel() {
  const [detail, setDetail] = useState<DetailState>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pendingErrorRef = useRef<string | null>(null);
  const replaceNextInputRef = useRef(false);

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

  const clearErrorMessage = useCallback(() => {
    setErrorMessage(null);
  }, []);

  const finalizeSearchResult = useCallback(
    (res: SearchTickerResult) => {
      replaceNextInputRef.current = true;
      if (res.success) {
        commitSuccess(res.data);
        toast.success(`Successfully added ${res.data.ticker}`);
      } else {
        flushError(res.error);
      }
    },
    [commitSuccess, flushError],
  );

  return {
    detail,
    errorMessage,
    replaceNextInputRef,
    flushError,
    clearErrorMessage,
    onDetailEntered,
    onDetailLeaveComplete,
    finalizeSearchResult,
  };
}
