/**
 * query-persister — TanStack Query persist-client adapter backed by encrypted MMKV.
 *
 * Spec: offline-cache-stage-3.md §决策 1, 2, 3, 5
 *
 * Responsibilities:
 *   1. Build a sync MMKV storage adapter for @tanstack/query-sync-storage-persister.
 *   2. Apply Decimal-safe serialize/deserialize (reuse decimal-safe-json.ts — do not
 *      duplicate; this is the key correctness constraint from spec §决策 2).
 *   3. Expose `buildPersister()` — async because MMKV init requires awaiting the
 *      secure-store encryption key (spec §决策 6).
 *   4. Export `QUERY_CACHE_BUSTER` so _layout.tsx can wire it into
 *      PersistQueryClientProvider.
 *
 * Web fallback:
 *   getEncryptedMmkv() returns null on web → buildPersister() returns null → caller
 *   stays with plain QueryClientProvider (no persistence on web, which is fine).
 *
 * gcTime note (spec §决策 5):
 *   Whitelist queries must have gcTime ≥ maxAge (24h). This is set on query-client.ts.
 *   This file only concerns itself with what to persist, not when to GC.
 */

import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import type { Persister, PersistedClient } from "@tanstack/react-query-persist-client";
import type { Query } from "@tanstack/react-query";

import { serialize, deserialize } from "./decimal-safe-json";
import { getEncryptedMmkv } from "./mmkv-encrypted";

/**
 * Increment this string whenever the persisted cache shape changes (e.g. a new
 * Decimal field is added to a query result, or a query key structure changes).
 * Old caches with a different buster are discarded on rehydrate.
 */
export const QUERY_CACHE_BUSTER = "arc-cache-v1";

/** 24 hours in milliseconds — aligns with gcTime on whitelisted queries. */
export const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Query key prefixes that should be persisted to disk.
 * Source of truth: spec §决策 3 whitelist table.
 *
 * Excluded (not in this set):
 *   - "symbol-search"           → transient search input
 *   - "historical"              → per-asset × time-window, large, details-page only
 *   - "watchlist-quote"         → already in persistent-market-cache (AsyncStorage)
 *   - "fx"                      → already in persistent-market-cache
 *   - "price"                   → already in persistent-market-cache
 *   - "portfolioTransactionCount" → lightweight, quick to refetch
 */
export const PERSIST_QUERY_KEY_PREFIXES: ReadonlyArray<string> = [
  "portfolios",
  "portfolio",
  "transactions",
  "portfolioValuation",
  "portfolio-chart-bootstrap",
  "portfolio-value-snapshots",
  "pnl-analysis",
  "twr-portfolio",
  "targetAllocations",
  "dailySnapshot",
  "watchlist",
];

export const shouldPersistQuery = (query: Query): boolean => {
  const key = query.queryKey[0];
  if (typeof key !== "string") return false;
  return PERSIST_QUERY_KEY_PREFIXES.includes(key);
};

/**
 * Builds a Persister backed by encrypted MMKV (or null on web/failure).
 * Must be awaited before mounting PersistQueryClientProvider.
 */
export const buildPersister = async (): Promise<Persister | null> => {
  const mmkv = await getEncryptedMmkv();
  if (!mmkv) return null;

  return createSyncStoragePersister({
    storage: {
      getItem: (key) => mmkv.getString(key) ?? null,
      setItem: (key, value) => mmkv.set(key, value),
      removeItem: (key) => {
        mmkv.remove(key);
      },
    },
    serialize,
    deserialize: (text) => deserialize(text) as PersistedClient,
  });
};
