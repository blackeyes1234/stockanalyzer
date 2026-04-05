/**
 * Simple moving average of `closes` at index `i` uses closes[i - period + 1]..closes[i].
 * Returns null where undefined (indices < period - 1).
 */
export function computeSma(
  closes: number[],
  period: number,
): (number | null)[] {
  const out: (number | null)[] = Array(closes.length).fill(null);
  if (period <= 0 || closes.length < period) return out;
  for (let i = period - 1; i < closes.length; i++) {
    let sum = 0;
    for (let k = i - period + 1; k <= i; k++) sum += closes[k];
    out[i] = sum / period;
  }
  return out;
}

/**
 * Wilder-smoothed RSI on closes. First valid value at index `period` (uses first `period` deltas).
 */
export function computeRsiWilder(
  closes: number[],
  period: number,
): (number | null)[] {
  const n = closes.length;
  const out: (number | null)[] = Array(n).fill(null);
  if (period <= 0 || n < period + 1) return out;

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const ch = closes[i]! - closes[i - 1]!;
    avgGain += ch > 0 ? ch : 0;
    avgLoss += ch < 0 ? -ch : 0;
  }
  avgGain /= period;
  avgLoss /= period;

  const rs0 = avgLoss === 0 ? Infinity : avgGain / avgLoss;
  out[period] = 100 - 100 / (1 + rs0);

  for (let i = period + 1; i < n; i++) {
    const ch = closes[i]! - closes[i - 1]!;
    const g = ch > 0 ? ch : 0;
    const l = ch < 0 ? -ch : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    const rs =
      avgLoss === 0 ? (avgGain === 0 ? 0 : Infinity) : avgGain / avgLoss;
    out[i] = 100 - 100 / (1 + rs);
  }
  return out;
}
