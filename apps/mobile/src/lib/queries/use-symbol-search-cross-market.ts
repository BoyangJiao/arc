/**
 * Cross-market symbol search — routes to registry PriceAdapter.searchSymbols.
 */

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import type { Market } from "@arc/core";

import { searchSymbolsForMarket } from "../market-data";
import { useDebouncedValue } from "../use-debounced-value";

export const useSymbolSearchCrossMarket = (market: Market, query: string) => {
  const debounced = useDebouncedValue(query.trim(), 350);

  return useQuery({
    queryKey: ["symbol-search", market, debounced],
    enabled: debounced.length >= 2,
    staleTime: 5 * 60 * 1000,
    retry: false,
    placeholderData: keepPreviousData,
    queryFn: () => searchSymbolsForMarket(market, debounced),
  });
};
