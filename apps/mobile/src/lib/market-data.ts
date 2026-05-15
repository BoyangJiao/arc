/**
 * Market data wiring — instantiates Arc adapter registry + Supabase caches.
 *
 * Singletons (constructed once on app start, reused for the whole session).
 *
 * Stage 1 wiring:
 *   - US prices: Alpha Vantage (free 25/day)
 *   - FX rates: Frankfurter (free, no key)
 *   - Cache: Supabase price_snapshots / fx_rates (DI-injected)
 *
 * Stage 3 will register additional adapters (Tushare for CN/HK, CoinGecko for
 * crypto, etc.) via the same registry — business hooks unchanged.
 */

import {
  createAlphaVantageAdapter,
  createFrankfurterAdapter,
  createRegistry,
  createSupabaseFxCache,
  createSupabasePriceCache,
  type AdapterRegistry,
  type FxCache,
  type PriceCache,
} from "@arc/data-sources";

import { supabase } from "./supabase";

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

export const priceCache: PriceCache = createSupabasePriceCache(supabase);
export const fxCache: FxCache = createSupabaseFxCache(supabase);
