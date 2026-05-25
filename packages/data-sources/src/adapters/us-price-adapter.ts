/**
 * US price adapter — Finnhub live quotes + Alpha Vantage daily history.
 *
 * Finnhub free tier includes `/quote` but NOT `/stock/candle` (403).
 * AV `TIME_SERIES_DAILY` supplies EOD history for all chart time ranges (same D resolution, window from rangeToWindow).
 */

import type { PriceAdapter } from "../interfaces";
import { createAlphaVantageAdapter } from "./alphavantage";
import { createFinnhubAdapter } from "./finnhub";

export interface UsPriceAdapterConfig {
  finnhubApiKey: string;
  /** Required for asset-detail historical charts on free tier. */
  alphaVantageApiKey?: string;
}

export const createUsPriceAdapter = (config: UsPriceAdapterConfig): PriceAdapter => {
  const finnhub = createFinnhubAdapter({ apiKey: config.finnhubApiKey });
  const alphaVantage = config.alphaVantageApiKey
    ? createAlphaVantageAdapter({ apiKey: config.alphaVantageApiKey })
    : null;

  return {
    market: "US",
    source: finnhub.source,
    fetchLatest: (symbol) => finnhub.fetchLatest(symbol),
    searchSymbols: finnhub.searchSymbols?.bind(finnhub),
    fetchHistorical: alphaVantage?.fetchHistorical
      ? (symbol, from, to) => alphaVantage.fetchHistorical!(symbol, from, to)
      : undefined,
  };
};
