/**
 * US price adapter — Finnhub live quotes + daily history.
 *
 * Finnhub free tier includes `/quote` but NOT `/stock/candle` (403), so history
 * comes from a separate source. When a `historical` adapter is supplied (e.g.
 * Tushare `us_daily`) it owns history; otherwise Alpha Vantage `TIME_SERIES_DAILY`
 * is the fallback. Latest is always Finnhub (live; Tushare US is EOD-only).
 */

import type { PriceAdapter } from "../interfaces";
import { createAlphaVantageAdapter } from "./alphavantage";
import { createFinnhubAdapter } from "./finnhub";

export interface UsPriceAdapterConfig {
  finnhubApiKey: string;
  /** Free-tier fallback for asset-detail historical charts. */
  alphaVantageApiKey?: string;
  /** Preferred historical source (e.g. Tushare us_daily). Wins over Alpha Vantage. */
  historical?: PriceAdapter;
}

export const createUsPriceAdapter = (config: UsPriceAdapterConfig): PriceAdapter => {
  const finnhub = createFinnhubAdapter({ apiKey: config.finnhubApiKey });
  const alphaVantage = config.alphaVantageApiKey
    ? createAlphaVantageAdapter({ apiKey: config.alphaVantageApiKey })
    : null;

  // Tushare (if configured) owns history — no Alpha Vantage fallback, so a
  // Tushare failure surfaces instead of being silently masked (test honesty).
  const historicalAdapter = config.historical ?? alphaVantage;

  return {
    market: "US",
    source: finnhub.source,
    fetchLatest: (symbol) => finnhub.fetchLatest(symbol),
    searchSymbols: finnhub.searchSymbols?.bind(finnhub),
    fetchHistorical: historicalAdapter?.fetchHistorical
      ? (symbol, from, to) => historicalAdapter.fetchHistorical!(symbol, from, to)
      : undefined,
  };
};
