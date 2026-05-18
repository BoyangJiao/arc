/**
 * useWatchlistQuotes — per-row quotes with 5-minute cache TTL (J8).
 */

import { useCallback, useMemo } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { parseAssetId, type WatchlistRow } from "@arc/core";
import {
  fetchAlphaVantageQuoteWithChange,
  fetchWatchlistQuoteWithCache,
  WATCHLIST_QUOTE_FRESHNESS_MS,
  type WatchlistQuoteFields,
} from "@arc/data-sources";

import fixtureData from "../dev-fixtures/quotes.json";
import type { FixtureData } from "@arc/data-sources";
import { getRegistry, priceCache } from "../market-data";
import {
  CACHE_FIRST_READ_FRESHNESS_MS,
  isCacheFirstMarketData,
  isFixtureMarketData,
} from "../market-data-policy";

const ALPHAVANTAGE_KEY = process.env.EXPO_PUBLIC_ALPHAVANTAGE_API_KEY;

const fixtureChangePercent = (assetId: string): Decimal | null => {
  const q = (fixtureData as FixtureData).quotes[assetId];
  if (!q?.changePercent) return null;
  try {
    return new Decimal(q.changePercent);
  } catch {
    return null;
  }
};

const toQuote = (assetId: string, fields: WatchlistQuoteFields): WatchlistRow["quote"] => {
  let changePercent = fields.changePercent;
  if (isFixtureMarketData()) {
    changePercent = fixtureChangePercent(assetId) ?? changePercent;
  }

  return {
    price: fields.price,
    currency: fields.currency,
    changePercent,
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

  const fetchWithChange =
    !isFixtureMarketData() && ALPHAVANTAGE_KEY
      ? (symbol: string) => fetchAlphaVantageQuoteWithChange({ apiKey: ALPHAVANTAGE_KEY }, symbol)
      : undefined;

  const results = useQueries({
    queries: assetIds.map((assetId) => ({
      queryKey: ["watchlist-quote", assetId, forceNetwork ? 0 : freshnessMs],
      enabled: assetIds.length > 0,
      staleTime: forceNetwork ? 0 : freshnessMs,
      queryFn: async (): Promise<WatchlistRow["quote"]> => {
        const adapter = getRegistry().resolvePriceAdapterByAssetId(assetId);
        const { symbol } = parseAssetId(assetId);

        if (!forceNetwork && isCacheFirstMarketData() && !isFixtureMarketData()) {
          const cached = await priceCache.get(assetId, CACHE_FIRST_READ_FRESHNESS_MS);
          if (cached) {
            return toQuote(assetId, {
              price: cached.price,
              currency: cached.currency,
              changePercent: null,
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
          fetchWithChange,
        });

        return toQuote(assetId, fields);
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

  const refresh = useCallback(() => {
    assetIds.forEach((assetId) => {
      void queryClient.invalidateQueries({
        queryKey: ["watchlist-quote", assetId],
      });
    });
  }, [assetIds, queryClient]);

  const isPending = results.some((r) => r.isPending);
  const isFetching = results.some((r) => r.isFetching);
  const error = results.find((r) => r.error)?.error ?? null;

  return { quoteByAssetId, isPending, isFetching, error, refresh };
};
