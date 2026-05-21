import type { PriceAdapter } from "../../interfaces";
import type { AkshareClient } from "./client";

const SOURCE = "akshare-hk";

export interface AkshareHkAdapterConfig {
  client: AkshareClient;
}

export const createAkshareHkAdapter = (config: AkshareHkAdapterConfig): PriceAdapter => {
  const { client } = config;
  return {
    market: "HK",
    source: SOURCE,
    fetchLatest: (symbol) => client.fetchLatest("HK", symbol),
    fetchHistorical: (symbol, from, to) => client.fetchHistorical("HK", symbol, from, to),
    searchSymbols: (query) => client.searchSymbols("HK", query),
  };
};
