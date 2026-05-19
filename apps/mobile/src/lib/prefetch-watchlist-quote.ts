/**
 * Prefetch a live watchlist quote into layered cache (Finnhub + Frankfurter path).
 */

import { composeAssetId, parseAssetId, type Market } from "@arc/core";
import { fetchWatchlistQuoteWithCache } from "@arc/data-sources";

import { getRegistry, priceCache } from "./market-data";

export const prefetchWatchlistQuote = async (market: Market, symbol: string): Promise<void> => {
  const assetId = composeAssetId(market, symbol.trim().toUpperCase());
  const { symbol: parsed } = parseAssetId(assetId);
  const adapter = getRegistry().resolvePriceAdapterByAssetId(assetId);

  await fetchWatchlistQuoteWithCache({
    adapter,
    symbol: parsed,
    cache: priceCache,
    freshnessMs: 0,
  });
};
