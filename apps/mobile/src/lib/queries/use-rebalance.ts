/**
 * useRebalance — portfolio valuation + targets → computeRebalance.
 */

import { useMemo } from "react";
import { rebalance, type TargetAllocation } from "@arc/core";

const { computeRebalance } = rebalance;
type DeviationItem = rebalance.DeviationItem;

import { usePortfolioHoldings } from "./use-portfolio-holdings";
import { usePortfolioValuation } from "./use-portfolio-valuation";
import { useTargetAllocations } from "./use-target-allocations";

export const useRebalance = (portfolioId: string | undefined, reportingCurrency: string) => {
  const holdingsQuery = usePortfolioHoldings(portfolioId);
  const valuationQuery = usePortfolioValuation(
    portfolioId,
    reportingCurrency as "CNY" | "USD" | "HKD" | "JPY" | "BTC" | "ETH"
  );
  const targetsQuery = useTargetAllocations(portfolioId);

  const deviations: DeviationItem[] = useMemo(() => {
    if (!valuationQuery.data || !targetsQuery.data) return [];
    return [
      ...computeRebalance(holdingsQuery.holdings, valuationQuery.data.perAsset, targetsQuery.data),
    ];
  }, [holdingsQuery.holdings, valuationQuery.data, targetsQuery.data]);

  const isLoading = holdingsQuery.isPending || valuationQuery.isPending || targetsQuery.isPending;
  const isFetching =
    holdingsQuery.isFetching || valuationQuery.isFetching || targetsQuery.isFetching;
  const error = holdingsQuery.error ?? valuationQuery.error ?? targetsQuery.error ?? null;

  return {
    deviations,
    targets: targetsQuery.data ?? ([] as TargetAllocation[]),
    valuation: valuationQuery.data,
    holdings: holdingsQuery.holdings,
    isLoading,
    isFetching,
    error,
    refreshValuation: valuationQuery.refreshValuation,
  };
};
