/**
 * Portfolio value snapshots time series — area chart data source.
 */

import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Decimal from "decimal.js";
import type { Currency } from "@arc/core";
import type { TimeRange } from "@arc/ui";

import type { Market } from "@arc/core";

import { sumPerAssetReportingMap } from "../portfolio-market-filter";
import { useAuth } from "../auth";
import { supabase } from "../supabase";
import { rangeToWindow } from "../time-range";

export interface PortfolioSnapshotPoint {
  readonly asOf: string;
  readonly totalValue: Decimal;
  readonly reportingCurrency: Currency;
  /** valueReporting per assetId — used for period P&L on holdings rows. */
  readonly perAssetReporting: ReadonlyMap<string, Decimal>;
}

const revivePerAssetReporting = (
  rows: ReadonlyArray<{
    assetId: string;
    valueReporting: string;
  }> | null
): ReadonlyMap<string, Decimal> => {
  const map = new Map<string, Decimal>();
  for (const row of rows ?? []) {
    map.set(row.assetId, new Decimal(String(row.valueReporting)));
  }
  return map;
};

export const usePortfolioValueSnapshots = (portfolioId: string | undefined, range: TimeRange) => {
  const { user } = useAuth();
  const window = useMemo(() => rangeToWindow(range), [range]);

  return useQuery({
    queryKey: [
      "portfolio-value-snapshots",
      portfolioId,
      window.from.toISOString(),
      window.to.toISOString(),
    ],
    enabled: !!user && !!portfolioId,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<readonly PortfolioSnapshotPoint[]> => {
      if (!portfolioId) return [];

      const { data, error } = await supabase
        .from("portfolio_value_snapshots")
        .select("as_of, total_value, reporting_currency, per_asset")
        .eq("portfolio_id", portfolioId)
        .gte("as_of", window.from.toISOString())
        .lte("as_of", window.to.toISOString())
        .order("as_of", { ascending: true });

      if (error) throw error;

      return (data ?? []).map((row) => ({
        asOf: row.as_of as string,
        totalValue: new Decimal(String(row.total_value)),
        reportingCurrency: row.reporting_currency as Currency,
        perAssetReporting: revivePerAssetReporting(
          row.per_asset as ReadonlyArray<{ assetId: string; valueReporting: string }> | null
        ),
      }));
    },
  });
};

/** Earliest snapshot in the selected chart range — period baseline for holdings P&L. */
export const periodBaselineByAsset = (
  points: readonly PortfolioSnapshotPoint[]
): ReadonlyMap<string, Decimal> | null => {
  const first = points[0];
  if (!first) return null;
  return first.perAssetReporting;
};

export const snapshotsToChartPoints = (
  points: readonly PortfolioSnapshotPoint[],
  marketFilter?: ReadonlySet<Market>
): ReadonlyArray<{ x: number; y: number; label: string; asOf: string }> =>
  points.map((p, index) => {
    const y =
      marketFilter && marketFilter.size > 0
        ? sumPerAssetReportingMap(p.perAssetReporting, marketFilter).toNumber()
        : p.totalValue.toNumber();
    return {
      x: index,
      y,
      label: p.asOf.slice(0, 10),
      asOf: p.asOf,
    };
  });

export const snapshotPeakTrough = (
  points: readonly PortfolioSnapshotPoint[]
): { peak: Decimal | null; trough: Decimal | null } => {
  if (points.length === 0) return { peak: null, trough: null };
  let peak = points[0]!.totalValue;
  let trough = points[0]!.totalValue;
  for (const p of points) {
    if (p.totalValue.gt(peak)) peak = p.totalValue;
    if (p.totalValue.lt(trough)) trough = p.totalValue;
  }
  return { peak, trough };
};
