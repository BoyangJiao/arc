/**
 * Market data wiring — Finnhub (US) + Frankfurter (FX) + layered caches.
 *
 * Dev: cache-first (Finnhub on pull-to-refresh / cache miss).
 * Prod: live freshness windows.
 *
 * Cache layers: memory → AsyncStorage → Supabase price_snapshots / fx_rates
 *
 * Consumers must call `getRegistry()` per fetch so policy stays consistent.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createFrankfurterAdapter,
  createMemoryFxCache,
  createMemoryPriceCache,
  createDefaultRegistry,
  createDefaultPriceAdapters,
  createSupabaseFxCache,
  createSupabasePriceCache,
  type AdapterRegistry,
  type FxCache,
  type PriceCache,
} from "@arc/data-sources";

import { getEffectivePolicy } from "./market-data-policy";
import { createPersistentFxCache, createPersistentPriceCache } from "./persistent-market-cache";
import { supabase } from "./supabase";

export {
  getEffectivePolicy,
  isCacheFirstMarketData,
  isLiveMarketData,
  CACHE_FIRST_READ_FRESHNESS_MS,
  readPriceFreshnessMs,
  readFxFreshnessMs,
  valuationQueryStaleTimeMs,
} from "./market-data-policy";

const FINNHUB_KEY = process.env.EXPO_PUBLIC_FINNHUB_API_KEY ?? "";
const TUSHARE_TOKEN = process.env.EXPO_PUBLIC_TUSHARE_TOKEN ?? "";
const AKSHARE_WRAPPER_URL = process.env.EXPO_PUBLIC_AKSHARE_WRAPPER_URL ?? "";
const AKSHARE_WRAPPER_TOKEN = process.env.EXPO_PUBLIC_AKSHARE_WRAPPER_TOKEN ?? "";
const ENABLE_AKSHARE_CN_FALLBACK = process.env.EXPO_PUBLIC_ENABLE_AKSHARE_CN_FALLBACK !== "false";

if (!FINNHUB_KEY && !__DEV__) {
  console.warn("[market-data] EXPO_PUBLIC_FINNHUB_API_KEY missing — price queries will fail");
}

const liveFxAdapter = createFrankfurterAdapter();
const livePriceAdapters = FINNHUB_KEY
  ? createDefaultPriceAdapters({
      finnhubApiKey: FINNHUB_KEY,
      ...(TUSHARE_TOKEN ? { tushareToken: TUSHARE_TOKEN } : {}),
      ...(AKSHARE_WRAPPER_URL && AKSHARE_WRAPPER_TOKEN
        ? {
            akshareWrapperUrl: AKSHARE_WRAPPER_URL,
            akshareWrapperToken: AKSHARE_WRAPPER_TOKEN,
            enableAkshareCnFallback: ENABLE_AKSHARE_CN_FALLBACK,
          }
        : {}),
    })
  : {};

const registry: AdapterRegistry = createDefaultRegistry({
  priceAdapters: livePriceAdapters,
  fxAdapter: liveFxAdapter,
});

export const getRegistry = (): AdapterRegistry => registry;

const supabasePriceCache = createSupabasePriceCache(supabase);
const supabaseFxCache = createSupabaseFxCache(supabase);

export const priceCache: PriceCache = createMemoryPriceCache(
  createPersistentPriceCache(AsyncStorage, supabasePriceCache)
);
export const fxCache: FxCache = createMemoryFxCache(
  createPersistentFxCache(AsyncStorage, supabaseFxCache)
);

if (__DEV__) {
  console.info(
    `[market-data] policy=${getEffectivePolicy()} (Finnhub + Frankfurter` +
      `${TUSHARE_TOKEN ? " + Tushare CN" : ""}` +
      `${AKSHARE_WRAPPER_URL ? " + AKShare wrapper" : ""})`
  );
}
