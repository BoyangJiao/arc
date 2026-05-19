/**
 * useSymbolSearch — debounced US symbol search (static first, AV fallback).
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { searchSymbolsWithFallback, type SymbolSearchResult } from "@arc/data-sources";
import { RateLimitError } from "@arc/data-sources";

import { useDebouncedValue } from "../use-debounced-value";
import { getRegistry } from "../market-data";

export type SymbolSearchStatus = "idle" | "loading" | "ok" | "rate_limited" | "error";

export interface UseSymbolSearchResult {
  results: ReadonlyArray<SymbolSearchResult>;
  status: SymbolSearchStatus;
  errorMessage: string | null;
}

export const useSymbolSearch = (query: string): UseSymbolSearchResult & { isFetching: boolean } => {
  const debounced = useDebouncedValue(query.trim(), 350);

  const searchQuery: UseQueryResult<SymbolSearchResult[], Error> = useQuery({
    queryKey: ["symbol-search", debounced],
    enabled: debounced.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const adapter = getRegistry().resolvePriceAdapter("US");
      return [...(await searchSymbolsWithFallback({ query: debounced, adapter }))];
    },
  });

  let status: SymbolSearchStatus = "idle";
  if (debounced.length === 0) {
    status = "idle";
  } else if (searchQuery.isPending || searchQuery.isFetching) {
    status = "loading";
  } else if (searchQuery.error) {
    status = searchQuery.error instanceof RateLimitError ? "rate_limited" : "error";
  } else {
    status = "ok";
  }

  return {
    results: searchQuery.data ?? [],
    status,
    errorMessage: searchQuery.error?.message ?? null,
    isFetching: searchQuery.isFetching,
  };
};
