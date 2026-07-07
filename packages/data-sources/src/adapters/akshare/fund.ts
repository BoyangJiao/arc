import type { PriceAdapter } from "../../interfaces";
import type { AkshareClient } from "./client";

const SOURCE = "akshare-fund";

export interface AkshareFundAdapterConfig {
  client: AkshareClient;
}

export const createAkshareFundAdapter = (config: AkshareFundAdapterConfig): PriceAdapter => {
  const { client } = config;
  return {
    market: "FUND",
    source: SOURCE,
    fetchLatest: (symbol) => client.fetchLatest("FUND", symbol),
    fetchHistorical: (symbol, from, to) => client.fetchHistorical("FUND", symbol, from, to),
    searchSymbols: (query) => client.searchSymbols("FUND", query),
  };
};
