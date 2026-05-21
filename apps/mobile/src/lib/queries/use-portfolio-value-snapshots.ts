/**
 * Portfolio value snapshots time series — area chart data source.
 */

import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Decimal from "decimal.js";
import type { Currency } from "@arc/core";
import type { TimeRange } from "@arc/ui";

import { useAuth } from "../auth";
import { supabase } from "../supabase";
import { rangeToWindow } from "../time-range";

export interface PortfolioSnapshotPoint {
  readonly asOf: string;
  readonly totalValue: Decimal;
  readonly reportingCurrency: Currency;
}

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
        .select("as_of, total_value, reporting_currency")
        .eq("portfolio_id", portfolioId)
        .gte("as_of", window.from.toISOString())
        .lte("as_of", window.to.toISOString())
        .order("as_of", { ascending: true });

      if (error) throw error;

      return (data ?? []).map((row) => ({
        asOf: row.as_of as string,
        totalValue: new Decimal(String(row.total_value)),
        reportingCurrency: row.reporting_currency as Currency,
      }));
    },
  });
};

export const snapshotsToChartPoints = (
  points: readonly PortfolioSnapshotPoint[]
): ReadonlyArray<{ x: number; y: number; label: string; asOf: string }> =>
  points.map((p, index) => ({
    x: index,
    y: p.totalValue.toNumber(),
    label: p.asOf.slice(0, 10),
    asOf: p.asOf,
  }));

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
