import YahooFinance from "yahoo-finance2";

export const YAHOO_REQUEST_TIMEOUT_MS = 15_000;

export class YahooRequestTimeoutError extends Error {
  constructor() {
    super("Request timed out");
    this.name = "YahooRequestTimeoutError";
  }
}

export function withYahooTimeout<T>(
  promise: Promise<T>,
  ms: number = YAHOO_REQUEST_TIMEOUT_MS,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new YahooRequestTimeoutError()), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
});
