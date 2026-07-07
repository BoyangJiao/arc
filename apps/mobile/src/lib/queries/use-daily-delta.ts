/**
 * useDailyDelta — composes today's PortfolioValuation + yesterday's
 * baseline snapshot into a `DailyDelta` ready for <DailySnapshotCard>.
 *
 * Stage 2 J7. Pure composition over two existing hooks + the @arc/core
 * pure function `computeDailyDelta`. No new I/O.
 *
 * Optional `marketFilters` re-aggregates valuation + baseline to match
 * Portfolio Tab market chips (same logic as Hero daily P&L card).
 */

import { useMemo } from "react";
import { computeDailyDelta, type Currency, type DailyDelta, type Market } from "@arc/core";

import {
  filterPortfolioDailySnapshot,
  filterPortfolioValuation,
  isMarketFilterActive,
} from "../portfolio-market-filter";
import { useDailySnapshot } from "./use-daily-snapshot";
import { usePortfolioValuation } from "./use-portfolio-valuation";

export interface DailyDeltaResult {
  /** Computed delta, or null while loading / on error. */
  data: DailyDelta | null;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
}

export const useDailyDelta = (
  portfolioId: string | undefined,
  reportingCurrency: Currency,
  marketFilters?: ReadonlySet<Market>
): DailyDeltaResult => {
  const valuation = usePortfolioValuation(portfolioId, reportingCurrency);
  const snapshot = useDailySnapshot(portfolioId);

  const isPending = valuation.isPending || snapshot.isPending;
  const isError = valuation.isError || snapshot.isError;
  const error = valuation.error ?? snapshot.error ?? null;

  const marketKey = useMemo(() => {
    if (!marketFilters || marketFilters.size === 0) return "all";
    return Array.from(marketFilters).sort().join(",");
  }, [marketFilters]);

  const data = useMemo<DailyDelta | null>(() => {
    if (isPending || isError) return null;
    if (!valuation.data) return null;

    if (!isMarketFilterActive(marketFilters ?? new Set())) {
      return computeDailyDelta(valuation.data, snapshot.data ?? null);
    }

    const filteredValuation = filterPortfolioValuation(valuation.data, marketFilters!);
    const filteredBaseline = snapshot.data
      ? filterPortfolioDailySnapshot(snapshot.data, marketFilters!)
      : null;
    return computeDailyDelta(filteredValuation, filteredBaseline);
  }, [isPending, isError, valuation.data, snapshot.data, marketFilters, marketKey]);

  return { data, isPending, isError, error };
};
