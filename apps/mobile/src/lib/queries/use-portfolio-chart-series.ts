/**
 * Portfolio NAV chart — DB snapshots with transaction-based bootstrap fallback.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Currency, PortfolioValuation } from "@arc/core";
import type { TimeRange } from "@arc/ui";

import type { Market } from "@arc/core";

import {
  filterPortfolioValuation,
  filterTransactionsByMarket,
  isMarketFilterActive,
} from "../portfolio-market-filter";
import { buildBootstrapChartPoints, liveValuationToChartPoint } from "../portfolio-chart-bootstrap";
import {
  expectedBootstrapPointCount,
  needsChartBootstrap,
  resolveMarketFilteredChartSeries,
} from "../portfolio-chart-density";

import { usePortfolioHoldings } from "./use-portfolio-holdings";
import {
  usePortfolioValueSnapshots,
  type PortfolioSnapshotPoint,
} from "./use-portfolio-value-snapshots";

export const usePortfolioChartSeries = (input: {
  readonly portfolioId: string | undefined;
  readonly range: TimeRange;
  readonly reportingCurrency: Currency;
  readonly liveValuation: PortfolioValuation | null | undefined;
  /** When set, force per-asset bootstrap (DB cron rows can't be re-sliced by market). */
  readonly marketFilters?: ReadonlySet<Market>;
}) => {
  const { portfolioId, range, reportingCurrency, liveValuation, marketFilters } = input;
  const snapshotsQuery = usePortfolioValueSnapshots(portfolioId, range);
  const { transactions } = usePortfolioHoldings(portfolioId);

  const txFingerprint = useMemo(
    () => (transactions ? `${transactions.length}:${transactions.at(-1)?.id ?? ""}` : "0"),
    [transactions]
  );

  const dbSnapshots = snapshotsQuery.isPlaceholderData ? [] : (snapshotsQuery.data ?? []);

  const marketFilterActive = isMarketFilterActive(marketFilters ?? new Set());

  const marketKey = useMemo(() => {
    if (!marketFilters || marketFilters.size === 0) return "all";
    return Array.from(marketFilters).sort().join(",");
  }, [marketFilters]);

  const scopedLiveValuation = useMemo(() => {
    if (!liveValuation || !marketFilterActive || !marketFilters) return liveValuation;
    return filterPortfolioValuation(liveValuation, marketFilters);
  }, [liveValuation, marketFilterActive, marketFilters]);

  const marketScopedTx = useMemo(() => {
    if (!transactions) return [];
    if (!marketFilterActive || !marketFilters) return transactions;
    return filterTransactionsByMarket(transactions, marketFilters);
  }, [transactions, marketFilterActive, marketFilters]);

  const minMarketPoints = useMemo(() => {
    if (!marketFilterActive || marketScopedTx.length === 0) return 2;
    return expectedBootstrapPointCount(range, marketScopedTx);
  }, [marketFilterActive, marketScopedTx, range]);

  const shouldBootstrap =
    !!portfolioId &&
    !!transactions &&
    transactions.length > 0 &&
    (marketFilterActive ||
      snapshotsQuery.isPlaceholderData ||
      needsChartBootstrap(dbSnapshots, range, transactions));

  const bootstrapQuery = useQuery({
    queryKey: [
      "portfolio-chart-bootstrap",
      portfolioId,
      range,
      reportingCurrency,
      txFingerprint,
      marketKey,
    ],
    enabled: shouldBootstrap,
    // 30 min — bootstrap recomputes only on tx change (txFingerprint key) or range switch.
    // Pull-to-refresh on the tab should NOT re-fetch historical N adapter windows.
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<readonly PortfolioSnapshotPoint[]> => {
      if (!portfolioId || !transactions) return [];
      return buildBootstrapChartPoints({
        portfolioId,
        range,
        transactions,
        reportingCurrency,
        liveValuation: scopedLiveValuation,
        marketFilters,
      });
    },
  });

  const data = useMemo((): readonly PortfolioSnapshotPoint[] => {
    let series: readonly PortfolioSnapshotPoint[];
    if (!shouldBootstrap) {
      series = dbSnapshots;
    } else {
      const boot = bootstrapQuery.data;
      const bootstrapPending = bootstrapQuery.isFetching || bootstrapQuery.isPending;
      if (marketFilterActive && marketFilters) {
        series = resolveMarketFilteredChartSeries({
          boot,
          dbSnapshots,
          range,
          transactions: marketScopedTx,
          markets: marketFilters,
          bootstrapPending,
        });
      } else {
        const bootReady = boot && boot.length >= 2;
        series = bootReady
          ? boot
          : snapshotsQuery.isPlaceholderData
            ? (boot ?? [])
            : dbSnapshots.length > 0
              ? dbSnapshots
              : (boot ?? []);
      }
    }

    if (
      shouldBootstrap &&
      scopedLiveValuation &&
      scopedLiveValuation.perAsset.length > 0 &&
      series.length >= 1
    ) {
      const updated = [...series];
      updated[updated.length - 1] = liveValuationToChartPoint(
        scopedLiveValuation,
        new Date().toISOString()
      );
      return updated;
    }

    return series;
  }, [
    shouldBootstrap,
    dbSnapshots,
    snapshotsQuery.isPlaceholderData,
    bootstrapQuery.data,
    bootstrapQuery.isFetching,
    bootstrapQuery.isPending,
    scopedLiveValuation,
    range,
    marketFilterActive,
    marketKey,
    marketFilters,
    marketScopedTx,
  ]);

  const bootstrapPending = bootstrapQuery.isFetching || bootstrapQuery.isPending;
  const marketSeriesPending =
    marketFilterActive &&
    shouldBootstrap &&
    bootstrapPending &&
    (bootstrapQuery.data?.length ?? 0) < minMarketPoints;

  return {
    data,
    isFetching:
      snapshotsQuery.isFetching ||
      snapshotsQuery.isPlaceholderData ||
      (shouldBootstrap && bootstrapPending) ||
      marketSeriesPending,
    isError: snapshotsQuery.isError || bootstrapQuery.isError,
  };
};
