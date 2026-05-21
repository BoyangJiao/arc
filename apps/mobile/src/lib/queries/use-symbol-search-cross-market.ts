/**
 * Cross-market symbol search — routes to registry PriceAdapter.searchSymbols.
 */

import { useQuery } from "@tanstack/react-query";
import type { Market } from "@arc/core";
import { QuotaError, RateLimitError } from "@arc/data-sources";

import { getRegistry } from "../market-data";
import { useDebouncedValue } from "../use-debounced-value";

export const useSymbolSearchCrossMarket = (market: Market, query: string) => {
  const debounced = useDebouncedValue(query.trim(), 350);

  return useQuery({
    queryKey: ["symbol-search", market, debounced],
    enabled: debounced.length >= 2,
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const adapter = getRegistry().resolvePriceAdapter(market);
      if (!adapter.searchSymbols) return [];
      try {
        return await adapter.searchSymbols(debounced);
      } catch (err) {
        if (err instanceof RateLimitError || err instanceof QuotaError) {
          return [];
        }
        throw err;
      }
    },
  });
};
