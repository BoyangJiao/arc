/**
 * Cached fetch facade — read-first wrappers around adapter calls.
 *
 * Business code (mobile hooks / data layer) should use these, not raw adapters.
 *
 * Behaviour:
 *   1. Try cache (Supabase price_snapshots / fx_rates) within freshnessMs window
 *   2. Cache hit → return immediately (no adapter call)
 *   3. Cache miss → call adapter → write back to cache → return
 *   4. Adapter error → re-throw (caller decides retry / fallback)
 *
 * Cache write failures (RLS rejection in Stage 1) are swallowed inside the
 * cache layer; the fresh quote is still returned.
 *
 * Default freshness windows (Stage 1):
 *   - Stock prices: 15 minutes (US equities don't move that fast intraday for tracker UX)
 *   - FX rates: 4 hours (ECB only updates daily anyway)
 *
 * Override per call when needed (e.g. user pull-to-refresh → freshnessMs=0).
 */

import type { Currency, FxRate, PriceQuote } from "@arc/core";

import type { FxAdapter, FxCache, PriceAdapter, PriceCache } from "./interfaces";

export const DEFAULT_PRICE_FRESHNESS_MS = 15 * 60 * 1000;
export const DEFAULT_FX_FRESHNESS_MS = 4 * 60 * 60 * 1000;

/** Coalesce concurrent fetches for the same key (validate + valuation racing). */
const dedupeInFlight = <T>(key: string, run: () => Promise<T>): Promise<T> => {
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = run().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise as Promise<unknown>);
  return promise;
};

const inFlight = new Map<string, Promise<unknown>>();

export interface FetchPriceParams {
  adapter: PriceAdapter;
  symbol: string;
  cache?: PriceCache;
  /** Set 0 to bypass cache (force fresh) */
  freshnessMs?: number;
}

export const fetchPriceWithCache = async (params: FetchPriceParams): Promise<PriceQuote> => {
  const { adapter, symbol, cache, freshnessMs = DEFAULT_PRICE_FRESHNESS_MS } = params;

  const assetId = `${adapter.market}:${symbol.toUpperCase()}`;
  const dedupeKey = `price:${assetId}:${freshnessMs > 0 ? "cached" : "fresh"}`;

  return dedupeInFlight(dedupeKey, async () => {
    if (cache && freshnessMs > 0) {
      const hit = await cache.get(assetId, freshnessMs);
      if (hit) return hit;
    }

    const quote = await adapter.fetchLatest(symbol);
    if (cache) {
      void cache.set(quote); // fire-and-forget; warnings logged inside
    }
    return quote;
  });
};

export interface FetchFxParams {
  adapter: FxAdapter;
  from: Currency;
  to: Currency;
  cache?: FxCache;
  freshnessMs?: number;
}

export const fetchFxWithCache = async (params: FetchFxParams): Promise<FxRate> => {
  const { adapter, from, to, cache, freshnessMs = DEFAULT_FX_FRESHNESS_MS } = params;

  const dedupeKey = `fx:${from}->${to}:${freshnessMs > 0 ? "cached" : "fresh"}`;

  return dedupeInFlight(dedupeKey, async () => {
    if (cache && freshnessMs > 0) {
      const hit = await cache.get(from, to, freshnessMs);
      if (hit) return hit;
    }

    const rate = await adapter.fetchRate(from, to);
    if (cache) {
      void cache.set(rate);
    }
    return rate;
  });
};
