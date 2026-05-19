/**
 * Market data fetch policy — dev vs production freshness.
 *
 * Dev and prod both use Finnhub + Frankfurter (fixture path retired 2026-05-19;
 * Finnhub free tier 60/min is enough for daily dev). See ADR 010.
 *
 *   prod: "live" — 15 min price / 4 h FX freshness; cache miss → adapter.
 *   dev:  "cache-first" — memory → AsyncStorage → Supabase; cached rows are
 *         reused indefinitely so dev stays offline-friendly. Network is only
 *         triggered by pull-to-refresh, an insights-session first-fetch, or a
 *         cache *miss* (new ticker).
 *
 * Quote-source trust is enforced separately by `isStaleQuoteSource` (see
 * ./stale-quote.ts): rows from retired sources (seed-dev / fixture /
 * alphavantage) or without changePercent are filtered before this freshness
 * check, so a fake $77 HOOD snapshot cannot block a real Finnhub refresh.
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
