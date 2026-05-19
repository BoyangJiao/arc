/**
 * usePrice — fetch latest price for an asset (cached + reactive).
 *
 * Routes through @arc/data-sources facade so:
 *   1. price_snapshots cache hit → instant
 *   2. cache miss → adapter call → cache write-back
 *   3. adapter error → typed AdapterError surfaces to .error
 *
 * Stage 1 J2 dependency. Used in Portfolio detail to display per-row market price.
 *
 * @example
 *   const { data, isPending, error } = usePrice("US:AAPL");
 *   if (isPending) return <Skeleton />;
 *   if (error) return <Text>{error.message}</Text>;
 *   return <Text>{data.price.toFixed(2)} {data.currency}</Text>;
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { parseAssetId } from "@arc/core";
import type { PriceQuote } from "@arc/core";
import { fetchPriceWithCache } from "@arc/data-sources";

import { getRegistry, priceCache } from "../market-data";
import {
  CACHE_FIRST_READ_FRESHNESS_MS,
  isCacheFirstMarketData,
  readPriceFreshnessMs,
} from "../market-data-policy";

export interface UsePriceOptions {
  /** Override cache freshness window (ms). 0 = bypass cache. */
  freshnessMs?: number;
  /** Disable the query (use when assetId is not yet known). */
  enabled?: boolean;
}

export const usePrice = (
  assetId: string | null | undefined,
  opts: UsePriceOptions = {}
): UseQueryResult<PriceQuote, Error> => {
  const forceNetwork = opts.freshnessMs === 0;
  const freshnessMs = opts.freshnessMs ?? readPriceFreshnessMs(false);

  return useQuery({
    queryKey: ["price", assetId, forceNetwork ? 0 : freshnessMs],
    enabled: !!assetId && opts.enabled !== false,
    staleTime: forceNetwork
      ? 0
      : freshnessMs > 0 && Number.isFinite(freshnessMs)
        ? freshnessMs
        : Infinity,
    queryFn: async () => {
      if (!assetId) {
        throw new Error("assetId is required");
      }
      const adapter = getRegistry().resolvePriceAdapterByAssetId(assetId);
      const { symbol } = parseAssetId(assetId);

      // cache-first (dev): prefer cached row; miss → pull-to-refresh fetches Finnhub.
      if (!forceNetwork && isCacheFirstMarketData()) {
        const cached = await priceCache.get(assetId, CACHE_FIRST_READ_FRESHNESS_MS);
        if (cached) return cached;
        throw new Error(`No cached quote for ${assetId}. Pull to refresh on the portfolio screen.`);
      }

      return fetchPriceWithCache({
        adapter,
        symbol,
        cache: priceCache,
        freshnessMs: forceNetwork ? 0 : freshnessMs,
      });
    },
  });
};
