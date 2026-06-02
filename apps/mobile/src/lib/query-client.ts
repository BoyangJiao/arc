/**
 * TanStack Query client — singleton + sensible defaults for Arc.
 *
 * Defaults (per ADR / dev-plan):
 *   - staleTime 60s — server data deemed fresh for 1 min before background refetch
 *   - gcTime 5 min — keep cache for 5 min after last subscriber unmounts
 *   - retry 2 — adapter errors get 2 retries with default exponential backoff
 *   - refetchOnWindowFocus true on Web only (RN: focus refetch handled by queries individually)
 *
 * RN-specific: AppState focus integration is wired in the QueryProvider
 * via `focusManager.setEventListener` — see _layout.tsx.
 *
 * Persist-specific (offline-cache-stage-3.md §决策 5):
 *   Queries in the persist whitelist (see query-persister.ts) must have
 *   gcTime ≥ maxAge (24h). Without this, TanStack GC evicts the query before
 *   the persister can write it → cold start still sees empty cache.
 *   Applied via `setQueryDefaults` per prefix below.
 */

import { QueryClient } from "@tanstack/react-query";

import { PERSIST_QUERY_KEY_PREFIXES } from "./cache/query-persister";

/** 24 h — matches CACHE_MAX_AGE_MS in query-persister.ts. */
const PERSIST_GC_TIME_MS = 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 2,
      refetchOnWindowFocus: false, // Use AppState integration on RN; Web overrides if needed
    },
  },
});

/**
 * Lift gcTime to 24 h for persist-whitelist query prefixes (spec §决策 5).
 * Single source of truth = PERSIST_QUERY_KEY_PREFIXES in query-persister.ts,
 * so the gcTime set and the dehydrate whitelist can never drift apart.
 */
for (const prefix of PERSIST_QUERY_KEY_PREFIXES) {
  queryClient.setQueryDefaults([prefix], { gcTime: PERSIST_GC_TIME_MS });
}
