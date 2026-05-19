/**
 * useWatchlistQuotes — per-row quotes with 5-minute cache TTL (J8).
 */

import { useCallback, useMemo } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { parseAssetId, type WatchlistRow } from "@arc/core";
import {
  AdapterError,
  fetchWatchlistQuoteWithCache,
  WATCHLIST_QUOTE_FRESHNESS_MS,
  RateLimitError,
  type WatchlistQuoteFields,
} from "@arc/data-sources";

import { getRegistry, priceCache } from "../market-data";
import { throwIfWatchlistRateLimitSimArmed } from "../dev-tools/watchlist-rate-limit-sim";
import { CACHE_FIRST_READ_FRESHNESS_MS, isCacheFirstMarketData } from "../market-data-policy";

const toQuote = (_assetId: string, fields: WatchlistQuoteFields): WatchlistRow["quote"] => {
  return {
    price: fields.price,
    currency: fields.currency,
    changePercent: fields.changePercent,
    asOf: fields.asOf,
    stale: fields.stale,
  };
};

export interface UseWatchlistQuotesOptions {
  /** 0 = bypass cache (pull-to-refresh). */
  freshnessMs?: number;
}

export const useWatchlistQuotes = (
  rows: ReadonlyArray<WatchlistRow>,
  opts: UseWatchlistQuotesOptions = {}
) => {
  const queryClient = useQueryClient();
  const forceNetwork = opts.freshnessMs === 0;
  const freshnessMs = opts.freshnessMs ?? WATCHLIST_QUOTE_FRESHNESS_MS;

  const assetIds = useMemo(() => rows.map((r) => r.asset.id), [rows]);

  const results = useQueries({
    queries: assetIds.map((assetId) => ({
      queryKey: ["watchlist-quote", assetId, forceNetwork ? 0 : freshnessMs],
      enabled: assetIds.length > 0,
      staleTime: forceNetwork ? 0 : freshnessMs,
      retry: false,
      queryFn: async (): Promise<WatchlistRow["quote"] | null> => {
        const adapter = getRegistry().resolvePriceAdapterByAssetId(assetId);
        const { symbol } = parseAssetId(assetId);

        try {
          throwIfWatchlistRateLimitSimArmed();

          if (!forceNetwork && isCacheFirstMarketData()) {
            const cached = await priceCache.get(assetId, CACHE_FIRST_READ_FRESHNESS_MS);
            if (cached) {
              return toQuote(assetId, {
                price: cached.price,
                currency: cached.currency,
                changePercent: cached.changePercent ?? null,
                asOf: cached.asOf,
                stale: Date.now() - Date.parse(cached.asOf) > WATCHLIST_QUOTE_FRESHNESS_MS,
              });
            }
          }

          const fields = await fetchWatchlistQuoteWithCache({
            adapter,
            symbol,
            cache: priceCache,
            freshnessMs: forceNetwork ? 0 : freshnessMs,
          });

          return toQuote(assetId, fields);
        } catch (err) {
          if (err instanceof AdapterError) {
            throw err;
          }
          if (__DEV__) {
            console.warn(
              `[watchlist-quote] skipped quote for ${assetId}:`,
              err instanceof Error ? err.message : err
            );
          }
          return null;
        }
      },
    })),
  });

  const quoteByAssetId = useMemo(() => {
    const map = new Map<string, WatchlistRow["quote"]>();
    assetIds.forEach((id, index) => {
      const data = results[index]?.data;
      if (data) map.set(id, data);
    });
    return map;
  }, [assetIds, results]);

  const quoteRefreshFailureSummary = useMemo(() => {
    let rateLimit = 0;
    let other = 0;
    for (const r of results) {
      if (!r.isError) continue;
      if (r.error instanceof RateLimitError) rateLimit++;
      else other++;
    }
    return {
      failedCount: rateLimit + other,
      rateLimitCount: rateLimit,
      otherCount: other,
    };
  }, [results]);

  const refresh = useCallback(() => {
    assetIds.forEach((assetId) => {
      void queryClient.invalidateQueries({
        queryKey: ["watchlist-quote", assetId],
      });
    });
  }, [assetIds, queryClient]);

  const isPending = results.some((r) => r.isPending);
  const isFetching = results.some((r) => r.isFetching);

  return {
    quoteByAssetId,
    isPending,
    isFetching,
    refresh,
    quoteRefreshFailureSummary,
  };
};
