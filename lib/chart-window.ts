/** Rolling calendar window: bars from this date (inclusive) through latest stored bar. */
export const CHART_LOOKBACK_YEARS = 5;

export function chartWindowStartDateIso(): string {
  const now = new Date();
  const start = new Date(
    Date.UTC(
      now.getUTCFullYear() - CHART_LOOKBACK_YEARS,
      now.getUTCMonth(),
      now.getUTCDate(),
    ),
  );
  return start.toISOString().slice(0, 10);
}
