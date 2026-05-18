/**
 * TanStack Query hooks barrel — business code imports from here.
 *
 * Pattern: one file per "data noun" (price, fx-rate, portfolio, transactions, ...).
 */

export { usePrice, type UsePriceOptions } from "./use-price";
export { useFxRate, type UseFxRateOptions } from "./use-fx-rate";
export { usePortfolios, usePortfolio, useEnsureDefaultPortfolio } from "./use-portfolios";
export {
  useTransactions,
  useCreateTransaction,
  useDeleteAssetTransactions,
  type CreateTransactionInput,
} from "./use-transactions";
export { usePortfolioHoldings } from "./use-portfolio-holdings";
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
