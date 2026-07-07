/**
 * useAssetTwr — asset-level time-weighted return for a portfolio holding.
 */

import { useMemo } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { parseAssetId, returns } from "@arc/core";
import type { TimeRange } from "@arc/ui";

import { getRegistry } from "../market-data";
import { buildPriceAt } from "../twr-day-lookup";
import { extendWindowForTwrPrices, resolveAssetTwrWindow } from "../twr-window";

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

  const window = useMemo(() => {
    if (!assetId || !transactionsQuery.data) {
      return resolveAssetTwrWindow(range, [], assetId ?? "");
    }
    return resolveAssetTwrWindow(range, transactionsQuery.data, assetId);
  }, [range, assetId, transactionsQuery.data]);

  const priceFetchWindow = useMemo(() => extendWindowForTwrPrices(window), [window]);

  return useQuery({
    queryKey: [
      "twr-asset",
      portfolioId,
      assetId,
      range,
      window.from.toISOString(),
      window.to.toISOString(),
    ],
    enabled: !!portfolioId && !!assetId && transactionsQuery.isSuccess,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<TwrResult> => {
      const transactions = transactionsQuery.data!;
      const adapter = getRegistry().resolvePriceAdapterByAssetId(assetId!);
      if (!adapter.fetchHistorical) {
        throw new Error(`no historical price adapter for ${assetId}`);
      }
      const { symbol } = parseAssetId(assetId!);
      const quotes = await adapter.fetchHistorical(
        symbol,
        priceFetchWindow.from,
        priceFetchWindow.to
      );
      if (quotes.length === 0) {
        throw new Error(`no historical prices for ${assetId}`);
      }

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
