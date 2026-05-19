/**
 * Market data fetch policy — dev vs production freshness.
 *
 * Dev and prod both use Finnhub + Frankfurter (no fixture toggle; ADR 008
 * fixture path retired 2026-05-19 — free tier 60/min is enough for daily dev).
 *
 *   prod: "live" — 15min price / 4h FX freshness; cache miss → adapter.
 *   dev:  "cache-first" — memory → AsyncStorage → Supabase; network on
 *         pull-to-refresh or cache miss / new ticker.
 */

import { DEFAULT_FX_FRESHNESS_MS, DEFAULT_PRICE_FRESHNESS_MS } from "@arc/data-sources";

export type EffectivePolicy = "cache-first" | "live";

export const getEffectivePolicy = (): EffectivePolicy => (__DEV__ ? "cache-first" : "live");

export const isCacheFirstMarketData = (): boolean => getEffectivePolicy() === "cache-first";
export const isLiveMarketData = (): boolean => getEffectivePolicy() === "live";

/** Any cached row is acceptable until the user forces a refresh. */
export const CACHE_FIRST_READ_FRESHNESS_MS = Number.POSITIVE_INFINITY;

export const readPriceFreshnessMs = (forceNetwork: boolean): number => {
  if (forceNetwork) return 0;
  return isLiveMarketData() ? DEFAULT_PRICE_FRESHNESS_MS : CACHE_FIRST_READ_FRESHNESS_MS;
};

export const readFxFreshnessMs = (forceNetwork: boolean): number => {
  if (forceNetwork) return 0;
  return isLiveMarketData() ? DEFAULT_FX_FRESHNESS_MS : CACHE_FIRST_READ_FRESHNESS_MS;
};

export const valuationQueryStaleTimeMs = (): number =>
  isLiveMarketData() ? DEFAULT_PRICE_FRESHNESS_MS : Number.POSITIVE_INFINITY;
