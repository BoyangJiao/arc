/**
 * Market data fetch policy — controls when adapters (Alpha Vantage / Frankfurter)
 * are called vs. when fixture data is used.
 *
 * Per ADR 008, dev exposes a single binary toggle in Settings:
 *   "Fetch real market data" ON / OFF
 *
 * Internally that maps to three effective behaviors:
 *
 *   prod (any build, ignores toggle):
 *     - "live": standard freshness (15min price / 4h FX). Cache miss → adapter.
 *
 *   dev + toggle ON:
 *     - "cache-first": memory → AsyncStorage → Supabase; any cached row is
 *       fresh until pull-to-refresh. Network on pull-to-refresh OR new ticker.
 *     - Use this when you want to verify the real API integration.
 *
 *   dev + toggle OFF (default):
 *     - "fixture": registry routes to FixtureAdapter instead of Alpha Vantage /
 *       Frankfurter. Zero network. Reads apps/mobile/src/lib/dev-fixtures/
 *       quotes.json. Adapter contract still runs end-to-end.
 *     - Use this for ~90% of dev work (UI iteration, flow validation).
 *
 * Persistence: AsyncStorage via Zustand persist middleware. Toggle state
 * survives cold start. Production builds force `useRealMarketData = true`
 * regardless of stored value — the Settings toggle is dev-only visible.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { DEFAULT_FX_FRESHNESS_MS, DEFAULT_PRICE_FRESHNESS_MS } from "@arc/data-sources";

// ──────────────────────────────────────────────────────────────────────────
// Store

interface MarketDataPolicyStore {
  /** Dev-only toggle. No effect in production. */
  useRealMarketData: boolean;
  setUseRealMarketData: (v: boolean) => void;
}

const STORE_KEY = "arc:market-data-policy:v1";

export const useMarketDataPolicyStore = create<MarketDataPolicyStore>()(
  persist(
    (set) => ({
      useRealMarketData: false, // dev default: OFF (fixture mode)
      setUseRealMarketData: (v) => set({ useRealMarketData: v }),
    }),
    {
      name: STORE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// ──────────────────────────────────────────────────────────────────────────
// Effective policy

export type EffectivePolicy = "fixture" | "cache-first" | "live";

/**
 * Derive the effective fetch behavior from current state + build env.
 * Read non-reactively (safe in plain TS modules like market-data.ts).
 */
export const getEffectivePolicy = (): EffectivePolicy => {
  if (!__DEV__) return "live";
  return useMarketDataPolicyStore.getState().useRealMarketData ? "cache-first" : "fixture";
};

export const isFixtureMarketData = (): boolean => getEffectivePolicy() === "fixture";
export const isCacheFirstMarketData = (): boolean => getEffectivePolicy() === "cache-first";
export const isLiveMarketData = (): boolean => getEffectivePolicy() === "live";

// ──────────────────────────────────────────────────────────────────────────
// Freshness windows — used by callers of fetchPriceWithCache / fetchFxWithCache.
// In fixture and cache-first modes any cached row is fresh; in live mode the
// standard 15min / 4h windows apply.

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
