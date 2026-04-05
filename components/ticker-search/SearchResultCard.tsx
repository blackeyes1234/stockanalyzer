import { memo } from "react";
import type { SearchTickerData } from "@/app/actions/search-ticker";

export const SearchResultCard = memo(function SearchResultCard({
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
