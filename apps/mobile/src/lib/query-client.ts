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
 */

import { QueryClient } from "@tanstack/react-query";

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
