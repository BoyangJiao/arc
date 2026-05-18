/**
 * Market data wiring — instantiates Arc adapter registries + layered caches.
 *
 * Two registries, picked per call by current policy:
 *   - dev + Settings toggle OFF (default) → fixture registry (zero network)
 *   - dev + Settings toggle ON              → live registry (Alpha Vantage + Frankfurter)
 *   - prod                                   → live registry (always)
 *
 * Toggling the Settings switch flips which registry the NEXT fetch uses; no
 * Metro restart required. Queries already cached stay until pull-to-refresh.
 *
 * Cache layers (shared across both registries):
 *   memory → AsyncStorage → Supabase price_snapshots / fx_rates
 *
 * Adapter consumers must call `getRegistry()` (function) — NOT a module-level
 * `registry` const — so policy switches take effect at fetch time. Cache
 * layer remains plain singletons (cache content is policy-agnostic).
 *
 * Stage 2/3 adds adapters for CN/HK/CRYPTO/FUND via the same registry —
 * business hooks unchanged. Fixture data extends by editing
 * apps/mobile/src/lib/dev-fixtures/quotes.json.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createAlphaVantageAdapter,
  createFixtureRegistry,
  createFrankfurterAdapter,
  createMemoryFxCache,
  createMemoryPriceCache,
  createDefaultRegistry,
  createSupabaseFxCache,
  createSupabasePriceCache,
  type AdapterRegistry,
  type FixtureData,
  type FxCache,
  type PriceCache,
} from "@arc/data-sources";

import fixtureData from "./dev-fixtures/quotes.json";
import { getEffectivePolicy, isFixtureMarketData } from "./market-data-policy";
import { createPersistentFxCache, createPersistentPriceCache } from "./persistent-market-cache";
import { supabase } from "./supabase";

export {
  getEffectivePolicy,
  isCacheFirstMarketData,
  isFixtureMarketData,
  isLiveMarketData,
  useMarketDataPolicyStore,
} from "./market-data-policy";

// ──────────────────────────────────────────────────────────────────────────
// Live (real network) registry

const ALPHAVANTAGE_KEY = process.env.EXPO_PUBLIC_ALPHAVANTAGE_API_KEY;

if (!ALPHAVANTAGE_KEY && !__DEV__) {
  // In dev, fixture mode is the default — missing AV key is fine.
  // In prod, it's a real misconfig; warn loudly.
  console.warn("[market-data] EXPO_PUBLIC_ALPHAVANTAGE_API_KEY missing — price queries will fail");
}

const liveFxAdapter = createFrankfurterAdapter();
const livePriceAdapters = ALPHAVANTAGE_KEY
  ? { US: createAlphaVantageAdapter({ apiKey: ALPHAVANTAGE_KEY }) }
  : {};

const liveRegistry: AdapterRegistry = createDefaultRegistry({
  priceAdapters: livePriceAdapters,
  fxAdapter: liveFxAdapter,
});

// ──────────────────────────────────────────────────────────────────────────
// Fixture (zero-network) registry

const fixtureRegistry: AdapterRegistry = createFixtureRegistry(fixtureData as FixtureData);

// ──────────────────────────────────────────────────────────────────────────
// Policy-aware accessor — read this per call.

export const getRegistry = (): AdapterRegistry =>
  isFixtureMarketData() ? fixtureRegistry : liveRegistry;

// ──────────────────────────────────────────────────────────────────────────
// Caches (shared across both registries)

const supabasePriceCache = createSupabasePriceCache(supabase);
const supabaseFxCache = createSupabaseFxCache(supabase);

export const priceCache: PriceCache = createMemoryPriceCache(
  createPersistentPriceCache(AsyncStorage, supabasePriceCache)
);
export const fxCache: FxCache = createMemoryFxCache(
  createPersistentFxCache(AsyncStorage, supabaseFxCache)
);

// ──────────────────────────────────────────────────────────────────────────
// Boot diagnostic

if (__DEV__) {
  console.info(
    `[market-data] policy=${getEffectivePolicy()} ` +
      `(toggle in Me → Settings to switch fixture ↔ real)`
  );
}
