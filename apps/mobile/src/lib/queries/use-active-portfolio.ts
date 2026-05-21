/**
 * useActivePortfolio — resolves persisted id against live portfolios with fallbacks.
 */

import { useEffect, useMemo, useState } from "react";
import { resolveActivePortfolio } from "@arc/core";
import type { Portfolio } from "@arc/core";
import type { UseQueryResult } from "@tanstack/react-query";

import { useActivePortfolioStore } from "../store/active-portfolio";
import { usePortfolios } from "./use-portfolios";

export type UseActivePortfolioResult = {
  readonly portfolio: Portfolio | null;
  readonly activePortfolioId: string | null;
  readonly setActivePortfolioId: (id: string | null) => void;
  /** false until Zustand persist has rehydrated from AsyncStorage (avoids B.2 overwrite). */
  readonly hasHydrated: boolean;
} & Pick<UseQueryResult<Portfolio[], Error>, "isLoading" | "isError" | "error" | "refetch">;

export const useActivePortfolio = (): UseActivePortfolioResult => {
  const storedId = useActivePortfolioStore((s) => s.activePortfolioId);
  const setActivePortfolioId = useActivePortfolioStore((s) => s.setActivePortfolioId);
  const portfoliosQuery = usePortfolios();
  const portfolios = portfoliosQuery.data ?? [];
  const portfoliosReady = !portfoliosQuery.isLoading && !portfoliosQuery.isPending;

  const [hasHydrated, setHasHydrated] = useState(() =>
    useActivePortfolioStore.persist.hasHydrated()
  );

  useEffect(() => {
    if (hasHydrated) return;
    const unsub = useActivePortfolioStore.persist.onFinishHydration(() => setHasHydrated(true));
    if (useActivePortfolioStore.persist.hasHydrated()) {
      setHasHydrated(true);
    }
    return unsub;
  }, [hasHydrated]);

  const resolved = useMemo(() => {
    if (!hasHydrated || !portfoliosReady) {
      if (storedId) {
        const match = portfolios.find((p) => p.id === storedId && p.archivedAt === null) ?? null;
        return {
          portfolio: match,
          effectiveId: storedId,
          shouldSyncStore: false,
        };
      }
      return {
        portfolio: null as Portfolio | null,
        effectiveId: null as string | null,
        shouldSyncStore: false,
      };
    }
    return resolveActivePortfolio(storedId, portfolios);
  }, [hasHydrated, portfoliosReady, storedId, portfolios]);

  useEffect(() => {
    if (!hasHydrated || !portfoliosReady) return;
    if (resolved.shouldSyncStore) {
      setActivePortfolioId(resolved.effectiveId);
    }
  }, [
    hasHydrated,
    portfoliosReady,
    resolved.shouldSyncStore,
    resolved.effectiveId,
    setActivePortfolioId,
  ]);

  return {
    portfolio: resolved.portfolio,
    activePortfolioId: resolved.effectiveId,
    setActivePortfolioId,
    hasHydrated,
    isLoading: !hasHydrated || portfoliosQuery.isLoading,
    isError: portfoliosQuery.isError,
    error: portfoliosQuery.error,
    refetch: portfoliosQuery.refetch,
  };
};
