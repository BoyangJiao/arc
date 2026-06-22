/**
 * usePnlAnalysis — period P&L bundle for the Insights 盈亏分析 page.
 *
 * Spec: .specify/feature-specs/stage-3/pnl-analysis-insights.md (Commit 3).
 *
 * Composes the same data sources as usePortfolioTwr (snapshots →
 * computeFullValuationAtDate bootstrap fallback) and feeds them, plus a
 * pre-resolved historical-FX map, to `returns.computePeriodPnl`. FX is
 * resolved up-front into a sync `fxAt` because the core algorithm is pure /
 * synchronous (CLAUDE.md §3.1, Law 5: trade-date FX, never current rate).
 *
 * Scope = the time-range-DEPENDENT card data (period value change, return
 * curve, realized P&L, MWR, ranking). The time-range-INDEPENDENT 累计盈亏
 * card is derived separately from usePortfolioValuation (see pnl-presenter.ts),
 * so it never refetches on range change (AC.2.2).
 */

import { useMemo } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { returns, type Currency, type Transaction } from "@arc/core";
import type { TimeRange } from "@arc/ui";

import { computeFullValuationAtDate } from "../compute-valuation-at-date";
import { buildHistoricalFxResolver } from "../historical-fx-resolver";
import { indexByUtcDay, toUtcDayKey } from "../twr-day-lookup";
import { resolvePortfolioTwrWindow } from "../twr-window";

import { usePortfolio } from "./use-portfolios";
import {
  usePortfolioValueSnapshots,
  type PortfolioSnapshotPoint,
} from "./use-portfolio-value-snapshots";
import { useTransactions } from "./use-transactions";

const ZERO = new Decimal(0);

export interface UsePnlAnalysisInput {
  readonly portfolioId: string | undefined;
  readonly range: TimeRange;
}

export interface PnlAnalysisData {
  readonly from: Date;
  readonly to: Date;
  readonly reportingCurrency: Currency;
  readonly result: ReturnType<typeof returns.computePeriodPnl>;
}

/** Resolve total + per-asset reporting value for each needed UTC day. */
const resolveDayValues = async (input: {
  readonly portfolioId: string;
  readonly dayKeys: readonly string[];
  readonly snapshots: readonly PortfolioSnapshotPoint[];
  readonly transactions: readonly Transaction[];
  readonly reportingCurrency: Currency;
}): Promise<{
  valueByDay: Map<string, Decimal>;
  perAssetByDay: Map<string, ReadonlyMap<string, Decimal>>;
}> => {
  const snapshotByDay = indexByUtcDay(input.snapshots);
  const valueByDay = new Map<string, Decimal>();
  const perAssetByDay = new Map<string, ReadonlyMap<string, Decimal>>();

  for (const dayKey of input.dayKeys) {
    const snapshot = snapshotByDay.get(dayKey);
    if (snapshot) {
      valueByDay.set(dayKey, snapshot.totalValue);
      perAssetByDay.set(dayKey, snapshot.perAssetReporting);
      continue;
    }
    const full = await computeFullValuationAtDate({
      portfolioId: input.portfolioId,
      dayKey,
      transactions: input.transactions,
      reportingCurrency: input.reportingCurrency,
    });
    valueByDay.set(dayKey, full.totalValue);
    perAssetByDay.set(dayKey, full.perAssetReporting);
  }

  return { valueByDay, perAssetByDay };
};

export const usePnlAnalysis = (
  input: UsePnlAnalysisInput
): UseQueryResult<PnlAnalysisData, Error> => {
  const { portfolioId, range } = input;

  const portfolioQuery = usePortfolio(portfolioId);
  const transactionsQuery = useTransactions(portfolioId);
  const snapshotsQuery = usePortfolioValueSnapshots(portfolioId, range);

  const window = useMemo(
    () => resolvePortfolioTwrWindow(range, transactionsQuery.data ?? []),
    [range, transactionsQuery.data]
  );

  return useQuery({
    queryKey: ["pnl-analysis", portfolioId, range],
    enabled:
      !!portfolioId &&
      portfolioQuery.isSuccess &&
      !!portfolioQuery.data &&
      transactionsQuery.isSuccess &&
      snapshotsQuery.isSuccess,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PnlAnalysisData> => {
      const portfolio = portfolioQuery.data!;
      const transactions = transactionsQuery.data ?? [];
      const snapshots = snapshotsQuery.data ?? [];
      const reportingCurrency = portfolio.reportingCurrency;
      const { from, to } = window;
      const fromMs = from.getTime();
      const toMs = to.getTime();

      // Chart x-axis = snapshot days inside the window (deduped UTC days).
      const sampleDates = snapshots
        .map((p) => new Date(p.asOf))
        .filter((d) => d.getTime() >= fromMs && d.getTime() <= toMs);

      const neededDayKeys = Array.from(
        new Set([toUtcDayKey(from), toUtcDayKey(to), ...sampleDates.map((d) => toUtcDayKey(d))])
      );

      const [{ valueByDay, perAssetByDay }, fxAt] = await Promise.all([
        resolveDayValues({
          portfolioId: portfolioId!,
          dayKeys: neededDayKeys,
          snapshots,
          transactions,
          reportingCurrency,
        }),
        buildHistoricalFxResolver({ transactions, reportingCurrency }),
      ]);

      const valueAt = (date: Date): Decimal => valueByDay.get(toUtcDayKey(date)) ?? ZERO;
      const perAssetValueAt = (date: Date, assetId: string): Decimal =>
        perAssetByDay.get(toUtcDayKey(date))?.get(assetId) ?? ZERO;

      const result = returns.computePeriodPnl({
        from,
        to,
        reportingCurrency,
        valueAt,
        perAssetValueAt,
        transactions,
        fxAt,
        sampleDates,
      });

      return { from, to, reportingCurrency, result };
    },
  });
};
