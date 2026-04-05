export type DailyBar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjClose: number | null;
};

export type OhlcProvider = {
  fetchDailyHistory(yahooStyleTicker: string): Promise<DailyBar[]>;
};
