/**
 * usePortfolioHoldings — holdings derived from transactions (source of truth).
 *
 * Per data-model invariants: holdings = computeHoldings(transactions).
 * UI must use `holdings.length` for "N 只持仓", not valuation.perAsset.length — the latter
 * only includes rows with a successful price quote (adapter may rate-limit).
 */

import { useMemo } from "react";
import { computeHoldings, type Holding, type Transaction } from "@arc/core";

import { useTransactions } from "./use-transactions";

export const usePortfolioHoldings = (portfolioId: string | undefined) => {
  const query = useTransactions(portfolioId);

  const holdings = useMemo((): readonly Holding[] => {
    if (!query.data || query.data.length === 0) return [];
    return computeHoldings(query.data);
  }, [query.data]);

  return {
    ...query,
    holdings,
    transactions: query.data as Transaction[] | undefined,
  };
};
