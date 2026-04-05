"use client";

import { memo, useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  checkOhlcStatus,
  ingestDailyOhlc,
} from "@/app/actions/ingest-ohlc";

type OhlcDownloadSectionProps = {
  symbol: string;
  companyName: string;
};

export const OhlcDownloadSection = memo(function OhlcDownloadSection({
  symbol,
  companyName,
}: OhlcDownloadSectionProps) {
  const hintId = useId();
  const actionId = useId();
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [alreadySynced, setAlreadySynced] = useState(false);
  const [blockingError, setBlockingError] = useState<string | null>(null);
  const [infoHint, setInfoHint] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    void checkOhlcStatus(symbol).then((r) => {
      if (cancelled) return;
      setLoadingStatus(false);
      if (!r.ok) {
        setBlockingError(r.error);
        return;
      }
      if (r.status === "synced") {
        setAlreadySynced(true);
        setInfoHint(
          r.barCount != null
            ? `Database already has ${r.barCount.toLocaleString()} daily rows for this symbol.`
            : "Daily OHLC is already stored. Download is not necessary.",
        );
        return;
      }
      if (r.status === "partial") {
        setInfoHint(
          "A previous sync did not finish. Use Download to load or refresh OHLC data.",
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [symbol]);

  function handleDownload() {
    setActionMessage("");
    startTransition(async () => {
      const r = await ingestDailyOhlc(symbol, companyName);
      if (!r.ok) {
        setActionMessage(r.error);
        return;
      }
      if (r.skipped) {
        setAlreadySynced(true);
        setInfoHint(null);
        setActionMessage(r.message);
        return;
      }
      setAlreadySynced(true);
      setInfoHint(null);
      setActionMessage(`Saved ${r.rowsInserted.toLocaleString()} daily rows.`);
      toast.success("OHLC data saved to your database");
    });
  }

  const disabled =
    loadingStatus || alreadySynced || isPending || Boolean(blockingError);

  return (
    <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
      <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Historical data
      </h3>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Download daily open/high/low/close/volume from{" "}
        <span className="font-medium text-zinc-800 dark:text-zinc-200">
          Yahoo Finance
        </span>{" "}
        into Supabase (full available history for this symbol).
      </p>
      {blockingError ? (
        <p
          className="mt-2 text-sm font-medium text-red-600 dark:text-red-400"
          role="alert"
        >
          {blockingError}
        </p>
      ) : null}
      {infoHint && !actionMessage ? (
        <p
          id={hintId}
          className="mt-2 text-sm text-zinc-600 dark:text-zinc-400"
          role="status"
          aria-live="polite"
        >
          {infoHint}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleDownload}
          disabled={disabled}
          aria-busy={isPending}
          aria-describedby={
            actionMessage
              ? actionId
              : infoHint && !blockingError
                ? hintId
                : undefined
          }
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm transition hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus-visible:outline-zinc-500"
        >
          {isPending ? "Downloading…" : "Download daily OHLC"}
        </button>
        {loadingStatus ? (
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            Checking database…
          </span>
        ) : null}
      </div>
      {actionMessage ? (
        <p
          id={actionId}
          className="mt-2 text-sm font-medium text-zinc-800 dark:text-zinc-200"
          role="status"
          aria-live="polite"
        >
          {actionMessage}
        </p>
      ) : null}
    </div>
  );
});
