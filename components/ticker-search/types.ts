import type { SearchTickerData } from "@/app/actions/search-ticker";

export type DetailPhase = "enter" | "visible" | "leave";

export type DetailState =
  | { data: SearchTickerData; phase: DetailPhase }
  | null;
