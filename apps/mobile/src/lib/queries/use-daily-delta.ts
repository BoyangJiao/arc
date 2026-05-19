/**
 * useDailyDelta — composes today's PortfolioValuation + yesterday's
 * baseline snapshot into a `DailyDelta` ready for <DailySnapshotCard>.
 *
 * Stage 2 J7. Pure composition over two existing hooks + the @arc/core
 * pure function `computeDailyDelta`. No new I/O.
 *
 * Loading semantics:
 *   - Both inner queries are loading        → returns null (caller shows
 *                                              nothing or a skeleton)
 *   - Valuation loading, snapshot resolved  → returns null (the card
 *                                              shouldn't flicker between
 *                                              states)
 *   - Both resolved                         → returns the computed DailyDelta
 *   - Either errors                         → returns null + isError = true
 *
 * Caller (Portfolio Tab) is expected to render the card only when
 * `data` is non-null.
 */

import { useMemo } from "react";
import { computeDailyDelta, type Currency, type DailyDelta } from "@arc/core";

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
  reportingCurrency: Currency
): DailyDeltaResult => {
  const valuation = usePortfolioValuation(portfolioId, reportingCurrency);
  const snapshot = useDailySnapshot(portfolioId);

  const isPending = valuation.isPending || snapshot.isPending;
  const isError = valuation.isError || snapshot.isError;
  const error = valuation.error ?? snapshot.error ?? null;

  const data = useMemo<DailyDelta | null>(() => {
    if (isPending || isError) return null;
    if (!valuation.data) return null;
    return computeDailyDelta(valuation.data, snapshot.data ?? null);
  }, [isPending, isError, valuation.data, snapshot.data]);

  return { data, isPending, isError, error };
};
