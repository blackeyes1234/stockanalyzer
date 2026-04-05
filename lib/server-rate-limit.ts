import { headers } from "next/headers";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 80;
const MAX_KEYS = 2_000;

const buckets = new Map<string, number[]>();

function pruneBuckets() {
  if (buckets.size <= MAX_KEYS) return;
  const cutoff = Date.now() - WINDOW_MS;
  for (const [key, times] of buckets) {
    const next = times.filter((t) => t > cutoff);
    if (next.length === 0) buckets.delete(key);
    else buckets.set(key, next);
  }
}

async function clientKey(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    h.get("cf-connecting-ip") ||
    "unknown";
  return ip;
}

/**
 * Simple per-IP sliding window (best-effort; resets per server instance on serverless).
 */
export async function checkSearchRateLimit(
  action:
    | "searchTicker"
    | "suggestTickers"
    | "ingestOhlc"
    | "checkOhlcStatus"
    | "getChartDailyBars",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ip = await clientKey();
  const key = `${ip}:${action}`;
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  let times = buckets.get(key) ?? [];
  times = times.filter((t) => t > windowStart);

  if (times.length >= MAX_PER_WINDOW) {
    return {
      ok: false,
      error: "Too many requests. Please wait a moment and try again.",
    };
  }

  times.push(now);
  buckets.set(key, times);
  pruneBuckets();

  return { ok: true };
}
