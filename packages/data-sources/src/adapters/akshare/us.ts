/**
 * AKShare US adapter — DEV-ONLY US history fallback (ADR 011).
 *
 * Used while Tushare `us_daily` is not entitled on the current tier. akshare is a
 * non-official data wrapper (compliance gray area), so this MUST be removed from
 * the production build — Tushare us_daily takes over once purchased. History only;
 * live US quotes stay on Finnhub. No symbol search.
 */

import type { PriceAdapter } from "../../interfaces";
import type { AkshareClient } from "./client";

const SOURCE = "akshare-us";

export interface AkshareUsAdapterConfig {
  client: AkshareClient;
}

export const createAkshareUsAdapter = (config: AkshareUsAdapterConfig): PriceAdapter => {
  const { client } = config;
  return {
    market: "US",
    source: SOURCE,
    fetchLatest: (symbol) => client.fetchLatest("US", symbol),
    fetchHistorical: (symbol, from, to) => client.fetchHistorical("US", symbol, from, to),
  };
};
