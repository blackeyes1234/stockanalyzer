import type { AlignedBar } from "./types";

export type MinimalBar = {
  date: string;
  open: number;
  close: number;
};

/**
 * Inner join by ISO date string (YYYY-MM-DD). Both inputs must be sorted ascending by date.
 */
export function mergeSignalAndExecutionBars(
  signalBars: MinimalBar[],
  executionBars: MinimalBar[],
): AlignedBar[] {
  const byExec = new Map<string, MinimalBar>();
  for (const b of executionBars) {
    byExec.set(b.date, b);
  }

  const out: AlignedBar[] = [];
  for (const s of signalBars) {
    const e = byExec.get(s.date);
    if (!e) continue;
    out.push({
      date: s.date,
      signalClose: s.close,
      execOpen: e.open,
      execClose: e.close,
    });
  }
  return out;
}
