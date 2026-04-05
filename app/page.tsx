import { TickerSearch } from "@/components/TickerSearch";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-16 sm:px-6 sm:py-24">
        <div className="mb-10 text-center sm:text-left">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Stock Analyzer
          </h1>
          <p className="mt-2 text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
            Look up a ticker to validate symbols for your backtesting workflows.
          </p>
        </div>
        <TickerSearch />
      </main>
    </div>
  );
}
