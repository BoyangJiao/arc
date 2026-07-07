/**
 * usePortfolioTwr — portfolio-level time-weighted return.
 */

import { useMemo } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { returns, type Transaction } from "@arc/core";
import type { TimeRange } from "@arc/ui";

import { resolvePortfolioValuesByDay } from "../resolve-portfolio-boundary-values";
import { buildValueAt, collectBoundaryDayKeys } from "../twr-day-lookup";
import { resolvePortfolioTwrWindow } from "../twr-window";

import { usePortfolio } from "./use-portfolios";
import { usePortfolioValueSnapshots } from "./use-portfolio-value-snapshots";
import { useTransactions } from "./use-transactions";

export interface UsePortfolioTwrInput {
  readonly portfolioId: string | undefined;
  readonly range: TimeRange;
}

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
