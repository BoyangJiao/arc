/**
 * Market data wiring — instantiates Arc adapter registry + layered caches.
 *
 * Singletons (constructed once on app start, reused for the whole session).
 *
 * Cache layers (read order): memory → AsyncStorage → Supabase.
 * Fetch policy: see market-data-policy.ts (`cache-first` in __DEV__ by default).
 *
 * Stage 3 will register additional adapters (Tushare for CN/HK, CoinGecko for
 * crypto, etc.) via the same registry — business hooks unchanged.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createAlphaVantageAdapter,
  createFrankfurterAdapter,
  createMemoryFxCache,
  createMemoryPriceCache,
  createRegistry,
  createSupabaseFxCache,
  createSupabasePriceCache,
  type AdapterRegistry,
  type FxCache,
  type PriceCache,
} from "@arc/data-sources";

import { marketDataPolicy } from "./market-data-policy";
import { createPersistentFxCache, createPersistentPriceCache } from "./persistent-market-cache";
import { supabase } from "./supabase";

export { marketDataPolicy, isCacheFirstMarketData } from "./market-data-policy";

const ALPHAVANTAGE_KEY = process.env.EXPO_PUBLIC_ALPHAVANTAGE_API_KEY;

if (!ALPHAVANTAGE_KEY) {
  // Defer the throw to first use; lets dev tools / Supabase-only screens render.
  // The price hook will surface the missing key as a user-visible error.
  console.warn("[market-data] EXPO_PUBLIC_ALPHAVANTAGE_API_KEY missing — price queries will fail");
}

const fxAdapter = createFrankfurterAdapter();

const priceAdaptersForRegistry = ALPHAVANTAGE_KEY
  ? { US: createAlphaVantageAdapter({ apiKey: ALPHAVANTAGE_KEY }) }
  : {};

export const registry: AdapterRegistry = createRegistry({
  priceAdapters: priceAdaptersForRegistry,
  fxAdapter,
});

const supabasePriceCache = createSupabasePriceCache(supabase);
const supabaseFxCache = createSupabaseFxCache(supabase);

export const priceCache: PriceCache = createMemoryPriceCache(
  createPersistentPriceCache(AsyncStorage, supabasePriceCache)
);
export const fxCache: FxCache = createMemoryFxCache(
  createPersistentFxCache(AsyncStorage, supabaseFxCache)
);

if (__DEV__) {
  console.info(`[market-data] policy=${marketDataPolicy} (pull-to-refresh to fetch live quotes)`);
}
