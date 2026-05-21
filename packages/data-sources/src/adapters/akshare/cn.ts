import type { PriceAdapter } from "../../interfaces";
import type { AkshareClient } from "./client";

const SOURCE = "akshare-cn";

export interface AkshareCnAdapterConfig {
  client: AkshareClient;
}

export const createAkshareCnAdapter = (config: AkshareCnAdapterConfig): PriceAdapter => {
  const { client } = config;
  return {
    market: "CN",
    source: SOURCE,
    fetchLatest: (symbol) => client.fetchLatest("CN", symbol),
    fetchHistorical: (symbol, from, to) => client.fetchHistorical("CN", symbol, from, to),
    searchSymbols: (query) => client.searchSymbols("CN", query),
  };
};
