/**
 * usePortfolioTwr — portfolio-level time-weighted return.
 */

import { useMemo } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { returns, type Currency, type Transaction } from "@arc/core";
import type { TimeRange } from "@arc/ui";

import { computeValuationAtDate } from "../compute-valuation-at-date";
import { buildValueAt, collectBoundaryDayKeys, indexByUtcDay } from "../twr-day-lookup";
import { resolvePortfolioTwrWindow } from "../twr-window";

import { usePortfolio } from "./use-portfolios";
import {
  usePortfolioValueSnapshots,
  type PortfolioSnapshotPoint,
} from "./use-portfolio-value-snapshots";
import { useTransactions } from "./use-transactions";

export interface UsePortfolioTwrInput {
  readonly portfolioId: string | undefined;
  readonly range: TimeRange;
}

const indexSnapshotsByDay = (
  points: readonly PortfolioSnapshotPoint[]
): ReadonlyMap<string, PortfolioSnapshotPoint> => indexByUtcDay(points);

const resolvePortfolioValuesByDay = async (input: {
  readonly portfolioId: string;
  readonly dayKeys: readonly string[];
  readonly snapshots: readonly PortfolioSnapshotPoint[];
  readonly transactions: readonly Transaction[];
  readonly reportingCurrency: Currency;
}): Promise<Map<string, Decimal>> => {
  const snapshotByDay = indexSnapshotsByDay(input.snapshots);
  const valueByDay = new Map<string, Decimal>();

  for (const dayKey of input.dayKeys) {
    const snapshot = snapshotByDay.get(dayKey);
    if (snapshot) {
      valueByDay.set(dayKey, snapshot.totalValue);
      continue;
    }

    valueByDay.set(
      dayKey,
      await computeValuationAtDate({
        portfolioId: input.portfolioId,
        dayKey,
        transactions: input.transactions,
        reportingCurrency: input.reportingCurrency,
      })
    );
  }

  return valueByDay;
};

type TwrResult = ReturnType<typeof returns.computePortfolioTwr>;

export const usePortfolioTwr = (input: UsePortfolioTwrInput): UseQueryResult<TwrResult, Error> => {
  const { portfolioId, range } = input;

  const portfolioQuery = usePortfolio(portfolioId);
  const transactionsQuery = useTransactions(portfolioId);
  const snapshotsQuery = usePortfolioValueSnapshots(portfolioId, range);

  const window = useMemo(() => {
    if (!transactionsQuery.data) return resolvePortfolioTwrWindow(range, []);
    return resolvePortfolioTwrWindow(range, transactionsQuery.data);
  }, [range, transactionsQuery.data]);

  return useQuery({
    queryKey: ["twr-portfolio", portfolioId, range],
    enabled:
      !!portfolioId &&
      portfolioQuery.isSuccess &&
      !!portfolioQuery.data &&
      transactionsQuery.isSuccess &&
      snapshotsQuery.isSuccess,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<TwrResult> => {
      const portfolio = portfolioQuery.data!;
      const transactions = transactionsQuery.data ?? [];
      const reportingCurrency = portfolio.reportingCurrency;

      const cashFlowEvents = returns.detectCashFlowEvents(transactions, window.from, window.to);
      const dayKeys = collectBoundaryDayKeys(
        window.from,
        window.to,
        cashFlowEvents.map((event) => event.date.getTime())
      );

      const valueByDay = await resolvePortfolioValuesByDay({
        portfolioId: portfolioId!,
        dayKeys,
        snapshots: snapshotsQuery.data ?? [],
        transactions,
        reportingCurrency,
      });

      const valueAt = buildValueAt(valueByDay);

      return returns.computePortfolioTwr({
        portfolioId: portfolioId!,
        reportingCurrency,
        from: window.from,
        to: window.to,
        transactions,
        valueAt,
      });
    },
  });
};
