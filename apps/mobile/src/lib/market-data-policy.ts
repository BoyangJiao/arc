/**
 * Market data fetch policy — controls when adapters (Alpha Vantage) are called.
 *
 * cache-first (default in __DEV__):
 *   - Reads: memory → device storage → Supabase; any hit is valid until pull-to-refresh.
 *   - Network: pull-to-refresh, or validateUsSymbol when no cached quote for a new ticker.
 *
 * live:
 *   - 15 min price / 4 h FX freshness; cache miss falls through to adapters (production-style).
 */

import { DEFAULT_FX_FRESHNESS_MS, DEFAULT_PRICE_FRESHNESS_MS } from "@arc/data-sources";

export type MarketDataPolicy = "cache-first" | "live";

const parsePolicy = (): MarketDataPolicy | null => {
  const raw = process.env.EXPO_PUBLIC_MARKET_DATA_POLICY?.trim().toLowerCase();
  if (raw === "cache-first" || raw === "live") return raw;
  return null;
};

export const marketDataPolicy: MarketDataPolicy =
  parsePolicy() ?? (__DEV__ ? "cache-first" : "live");

export const isCacheFirstMarketData = (): boolean => marketDataPolicy === "cache-first";

/** Any cached row is acceptable until the user forces a refresh. */
export const CACHE_FIRST_READ_FRESHNESS_MS = Number.POSITIVE_INFINITY;

export const readPriceFreshnessMs = (forceNetwork: boolean): number => {
  if (forceNetwork) return 0;
  return isCacheFirstMarketData() ? CACHE_FIRST_READ_FRESHNESS_MS : DEFAULT_PRICE_FRESHNESS_MS;
};

export const readFxFreshnessMs = (forceNetwork: boolean): number => {
  if (forceNetwork) return 0;
  return isCacheFirstMarketData() ? CACHE_FIRST_READ_FRESHNESS_MS : DEFAULT_FX_FRESHNESS_MS;
};

export const valuationQueryStaleTimeMs = (): number =>
  isCacheFirstMarketData() ? Number.POSITIVE_INFINITY : DEFAULT_PRICE_FRESHNESS_MS;
