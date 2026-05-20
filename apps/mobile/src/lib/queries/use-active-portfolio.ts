/**
 * useActivePortfolio — resolves persisted id against live portfolios with fallbacks.
 */

import { useEffect, useMemo } from "react";
import { resolveActivePortfolio } from "@arc/core";
import type { Portfolio } from "@arc/core";
import type { UseQueryResult } from "@tanstack/react-query";

import { useActivePortfolioStore } from "../store/active-portfolio";
import { usePortfolios } from "./use-portfolios";

export type UseActivePortfolioResult = {
  readonly portfolio: Portfolio | null;
  readonly activePortfolioId: string | null;
  readonly setActivePortfolioId: (id: string | null) => void;
} & Pick<UseQueryResult<Portfolio[], Error>, "isLoading" | "isError" | "error" | "refetch">;

export const useActivePortfolio = (): UseActivePortfolioResult => {
  const storedId = useActivePortfolioStore((s) => s.activePortfolioId);
  const setActivePortfolioId = useActivePortfolioStore((s) => s.setActivePortfolioId);
  const portfoliosQuery = usePortfolios();
  const portfolios = portfoliosQuery.data ?? [];

  const resolved = useMemo(
    () => resolveActivePortfolio(storedId, portfolios),
    [storedId, portfolios]
  );

  useEffect(() => {
    if (resolved.shouldSyncStore) {
      setActivePortfolioId(resolved.effectiveId);
    }
  }, [resolved.shouldSyncStore, resolved.effectiveId, setActivePortfolioId]);

  return {
    portfolio: resolved.portfolio,
    activePortfolioId: resolved.effectiveId,
    setActivePortfolioId,
    isLoading: portfoliosQuery.isLoading,
    isError: portfoliosQuery.isError,
    error: portfoliosQuery.error,
    refetch: portfoliosQuery.refetch,
  };
};
