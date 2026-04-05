import { createYahooChartOhlcProvider } from "./yahoo-chart";
import type { OhlcProvider } from "./types";

export type { DailyBar, OhlcProvider } from "./types";
export { mapChartQuotesToDailyBars } from "./yahoo-chart";

export function getOhlcProvider(): OhlcProvider {
  return createYahooChartOhlcProvider();
}
