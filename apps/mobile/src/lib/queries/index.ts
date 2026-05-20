/**
 * TanStack Query hooks barrel — business code imports from here.
 *
 * Pattern: one file per "data noun" (price, fx-rate, portfolio, transactions, ...).
 */

export { usePrice, type UsePriceOptions } from "./use-price";
export { useFxRate, type UseFxRateOptions } from "./use-fx-rate";
export {
  usePortfolios,
  usePortfolio,
  useEnsureDefaultPortfolio,
  useCreatePortfolio,
  useArchivePortfolio,
  useUnarchivePortfolio,
  useRenamePortfolio,
  useHardDeletePortfolio,
  usePortfolioTransactionCount,
  type UsePortfoliosOptions,
} from "./use-portfolios";
export { useActivePortfolio, type UseActivePortfolioResult } from "./use-active-portfolio";
export { useTransferBetweenPortfolios, TransferValidationError } from "./use-transfer";
export {
  useTransactions,
  useCreateTransaction,
  useDeleteAssetTransactions,
  type CreateTransactionInput,
} from "./use-transactions";
export { usePortfolioHoldings } from "./use-portfolio-holdings";
export { useAssetCatalog, type AssetCatalogRow } from "./use-asset-catalog";
export { usePortfolioValuation } from "./use-portfolio-valuation";
export { useDailySnapshot } from "./use-daily-snapshot";
export { useDailyDelta, type DailyDeltaResult } from "./use-daily-delta";
export {
  useWatchlist,
  useWatchlistBase,
  useAddWatchlistItem,
  useRemoveWatchlistItem,
  type AddWatchlistInput,
} from "./use-watchlist";
export { useWatchlistQuotes, type UseWatchlistQuotesOptions } from "./use-watchlist-quotes";
export { useSymbolSearch, type UseSymbolSearchResult } from "./use-symbol-search";
export {
  useTargetAllocations,
  useUpsertTargetAllocations,
  useDeleteAllTargetAllocations,
  targetAllocationsQueryKey,
} from "./use-target-allocations";
export { useRebalance } from "./use-rebalance";
export {
  useCashBalances,
  useSaveCashBalances,
  CASH_ASSET_IDS,
  type CashBalanceRow,
  type CashAssetId,
} from "./use-cash-balances";
