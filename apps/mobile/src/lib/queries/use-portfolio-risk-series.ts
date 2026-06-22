/**
 * usePortfolioRiskSeries — cash-flow-adjusted series for the 风险 / 回撤 pages.
 *
 * Composes portfolio + transactions + value snapshots, resolves trade-date FX,
 * and returns market-only returns / growth indices (portfolio + per-asset) so
 * volatility and drawdown reflect price movement, not funding events. See
 * portfolio-risk-series.ts for why raw totalValue ratios are wrong.
 */

import { useMemo } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { insights } from "@arc/core";

import type { TimeRange } from "@arc/ui";

import { buildHistoricalFxResolver } from "../historical-fx-resolver";
import { buildPortfolioRiskSeries } from "../portfolio-risk-series";
import { trimSnapshotsLeadingZeroTotals } from "../snapshot-asset-series";

import { usePortfolio } from "./use-portfolios";
import { usePortfolioValueSnapshots } from "./use-portfolio-value-snapshots";
import { useTransactions } from "./use-transactions";

/** One asset's market-only return series + growth-of-1 index. */
export interface AssetRiskCurves {
  readonly returns: Decimal[];
  readonly growthIndex: Decimal[];
}

export interface PortfolioRiskSeriesView {
  /** ISO `asOf` per retained snapshot; index-aligned with `growthIndex`. */
  readonly asOf: string[];
  readonly portfolioReturns: Decimal[];
  /** Growth of 1 from market-only returns; length === asOf.length. */
  readonly growthIndex: Decimal[];
  /** Latest snapshot's per-asset reporting value (drives the ranking universe). */
  readonly latestHoldings: ReadonlyMap<string, Decimal>;
  readonly perAsset: ReadonlyMap<string, AssetRiskCurves>;
}

export interface UsePortfolioRiskSeriesInput {
  readonly portfolioId: string | undefined;
  readonly range: TimeRange;
}

export const usePortfolioRiskSeries = (
  input: UsePortfolioRiskSeriesInput
): UseQueryResult<PortfolioRiskSeriesView, Error> => {
  const { portfolioId, range } = input;

  const portfolioQuery = usePortfolio(portfolioId);
  const transactionsQuery = useTransactions(portfolioId);
  const snapshotsQuery = usePortfolioValueSnapshots(portfolioId, range);

  return useQuery({
    queryKey: ["portfolio-risk-series", portfolioId, range],
    enabled:
      !!portfolioId &&
      portfolioQuery.isSuccess &&
      !!portfolioQuery.data &&
      transactionsQuery.isSuccess &&
      snapshotsQuery.isSuccess,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PortfolioRiskSeriesView> => {
      const reportingCurrency = portfolioQuery.data!.reportingCurrency;
      const transactions = transactionsQuery.data ?? [];
      const trimmed = trimSnapshotsLeadingZeroTotals(snapshotsQuery.data ?? []);

      const fxAt = await buildHistoricalFxResolver({ transactions, reportingCurrency });
      const series = buildPortfolioRiskSeries(trimmed, transactions, fxAt);

      const perAsset = new Map<string, AssetRiskCurves>();
      for (const [id, a] of series.perAsset) {
        perAsset.set(id, {
          returns: insights.flowFreeReturns(a.values, a.flows),
          growthIndex: insights.flowFreeGrowthIndex(a.values, a.flows),
        });
      }

      return {
        asOf: trimmed.map((s) => s.asOf),
        portfolioReturns: insights.flowFreeReturns(series.values, series.flows),
        growthIndex: insights.flowFreeGrowthIndex(series.values, series.flows),
        latestHoldings: trimmed[trimmed.length - 1]?.perAssetReporting ?? new Map(),
        perAsset,
      };
    },
  });
};

/** Empty view for render-before-data. */
export const useEmptyRiskSeriesView = (): PortfolioRiskSeriesView =>
  useMemo(
    () => ({
      asOf: [],
      portfolioReturns: [],
      growthIndex: [],
      latestHoldings: new Map(),
      perAsset: new Map(),
    }),
    []
  );
