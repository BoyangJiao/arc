/**
 * Portfolio NAV chart — DB snapshots with transaction-based bootstrap fallback.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Currency, PortfolioValuation } from "@arc/core";
import type { TimeRange } from "@arc/ui";

import {
  buildBootstrapChartPoints,
  liveValuationToChartPoint,
  needsChartBootstrap,
} from "../portfolio-chart-bootstrap";

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
}) => {
  const { portfolioId, range, reportingCurrency, liveValuation } = input;
  const snapshotsQuery = usePortfolioValueSnapshots(portfolioId, range);
  const { transactions } = usePortfolioHoldings(portfolioId);

  const txFingerprint = useMemo(
    () => (transactions ? `${transactions.length}:${transactions.at(-1)?.id ?? ""}` : "0"),
    [transactions]
  );

  const shouldBootstrap =
    snapshotsQuery.isSuccess &&
    !!portfolioId &&
    !!transactions &&
    transactions.length > 0 &&
    needsChartBootstrap(snapshotsQuery.data ?? [], range, transactions);

  const bootstrapQuery = useQuery({
    queryKey: ["portfolio-chart-bootstrap", portfolioId, range, reportingCurrency, txFingerprint],
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
        liveValuation,
      });
    },
  });

  const data = useMemo((): readonly PortfolioSnapshotPoint[] => {
    const db = snapshotsQuery.data ?? [];
    let series: readonly PortfolioSnapshotPoint[];
    if (!shouldBootstrap) {
      series = db;
    } else {
      const boot = bootstrapQuery.data;
      series = boot && boot.length >= 2 ? boot : db.length > 0 ? db : (boot ?? []);
    }

    if (
      shouldBootstrap &&
      liveValuation &&
      liveValuation.perAsset.length > 0 &&
      series.length >= 1
    ) {
      const updated = [...series];
      updated[updated.length - 1] = liveValuationToChartPoint(
        liveValuation,
        new Date().toISOString()
      );
      return updated;
    }

    return series;
  }, [shouldBootstrap, snapshotsQuery.data, bootstrapQuery.data, liveValuation]);

  return {
    data,
    isFetching: snapshotsQuery.isFetching || (shouldBootstrap && bootstrapQuery.isFetching),
    isError: snapshotsQuery.isError || bootstrapQuery.isError,
  };
};
