export type AlignedBar = {
  date: string;
  /** QQQ close — signal series */
  signalClose: number;
  /** Execution symbol open */
  execOpen: number;
  /** Execution symbol close */
  execClose: number;
};

export type CompletedTrade = {
  entryDate: string;
  exitDate: string;
  entryOpen: number;
  exitOpen: number;
  /** Simple return: exitOpen / entryOpen - 1 */
  simpleReturn: number;
  win: boolean;
};

export type QqqRsiSmaBacktestParams = {
  rsiPeriod: number;
  smaPeriod: number;
  oversold: number;
  overbought: number;
};

export const DEFAULT_QQQ_RSI_SMA_PARAMS: QqqRsiSmaBacktestParams = {
  rsiPeriod: 14,
  smaPeriod: 200,
  oversold: 30,
  overbought: 70,
};

export type QqqRsiSmaBacktestResult = {
  completedTrades: CompletedTrade[];
  wins: number;
  /** null when there are no completed trades */
  winRate: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  /** Gross profit / gross loss (losses as positive); null if no losing trades' gross loss */
  profitFactor: number | null;
};
