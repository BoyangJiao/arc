/**
 * useAssetTwr — asset-level time-weighted return for a portfolio holding.
 */

import { useMemo } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { returns } from "@arc/core";
import type { TimeRange } from "@arc/ui";

import { buildPriceAt } from "../twr-day-lookup";
import { resolveAssetTwrWindow } from "../twr-window";

import { useHistoricalQuotes } from "./use-historical-quotes";
import { useTransactions } from "./use-transactions";

type TwrResult = ReturnType<typeof returns.computeAssetTwr>;

export interface UseAssetTwrInput {
  readonly portfolioId: string | undefined;
  readonly assetId: string | undefined;
  readonly range: TimeRange;
}

export const useAssetTwr = (input: UseAssetTwrInput): UseQueryResult<TwrResult, Error> => {
  const { portfolioId, assetId, range } = input;

  const transactionsQuery = useTransactions(portfolioId);
  const historicalQuery = useHistoricalQuotes(assetId, range);

  const window = useMemo(() => {
    if (!assetId || !transactionsQuery.data) {
      return resolveAssetTwrWindow(range, [], assetId ?? "");
    }
    return resolveAssetTwrWindow(range, transactionsQuery.data, assetId);
  }, [range, assetId, transactionsQuery.data]);

  return useQuery({
    queryKey: ["twr-asset", portfolioId, assetId, range],
    enabled:
      !!portfolioId &&
      !!assetId &&
      transactionsQuery.isSuccess &&
      historicalQuery.isSuccess &&
      (historicalQuery.data?.length ?? 0) > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: (): TwrResult => {
      const transactions = transactionsQuery.data!;
      const quotes = historicalQuery.data!;

      const priceAt = buildPriceAt(quotes, assetId!);

      return returns.computeAssetTwr({
        assetId: assetId!,
        portfolioId: portfolioId!,
        from: window.from,
        to: window.to,
        transactions,
        priceAt,
      });
    },
  });
};
