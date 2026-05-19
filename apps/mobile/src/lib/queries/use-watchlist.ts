/**
 * useWatchlist — list / add / remove watchlist_items (Stage 2 J8).
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import type { Asset, Currency, Market, WatchlistRow } from "@arc/core";
import { composeAssetId, parseAssetId } from "@arc/core";

import { useAuth } from "../auth";
import { supabase } from "../supabase";

import { prefetchWatchlistQuote } from "../prefetch-watchlist-quote";

import { useWatchlistQuotes, type UseWatchlistQuotesOptions } from "./use-watchlist-quotes";

interface DbAssetJoin {
  id: string;
  market: Market;
  symbol: string;
  name: string;
  currency: Currency;
}

interface DbWatchlistRowRaw {
  id: string;
  added_at: string;
  asset: DbAssetJoin | DbAssetJoin[];
}

const fromDbAsset = (row: DbAssetJoin): Asset => ({
  id: row.id,
  market: row.market,
  symbol: row.symbol,
  name: row.name,
  currency: row.currency,
});

const resolveJoinedAsset = (asset: DbAssetJoin | DbAssetJoin[]): DbAssetJoin => {
  const row = Array.isArray(asset) ? asset[0] : asset;
  if (!row) {
    throw new Error("watchlist_items row missing joined asset");
  }
  return row;
};

const fromDbRow = (row: DbWatchlistRowRaw): WatchlistRow => ({
  id: row.id,
  addedAt: row.added_at,
  asset: fromDbAsset(resolveJoinedAsset(row.asset)),
  quote: null,
});

export const watchlistQueryKey = (userId: string | undefined) => ["watchlist", userId] as const;

export const useWatchlistBase = (): UseQueryResult<WatchlistRow[], Error> => {
  const { user } = useAuth();

  return useQuery({
    queryKey: watchlistQueryKey(user?.id),
    enabled: !!user,
    queryFn: async (): Promise<WatchlistRow[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("watchlist_items")
        .select("id, added_at, asset:assets(id, market, symbol, name, currency)")
        .eq("user_id", user.id)
        .order("added_at", { ascending: false });

      if (error) throw error;
      return (data ?? []).map((row) => fromDbRow(row as DbWatchlistRowRaw));
    },
  });
};

export interface UseWatchlistResult {
  rows: WatchlistRow[];
  isPending: boolean;
  isFetching: boolean;
  error: Error | null;
  refreshQuotes: () => void;
  remove: UseMutationResult<void, Error, string>["mutate"];
  isRemoving: boolean;
  /** Populated when ≥1 per-row quote query is in error (e.g. after pull-to-refresh). */
  quoteRefreshFailureSummary: {
    failedCount: number;
    rateLimitCount: number;
    otherCount: number;
  };
}

export const useWatchlist = (quoteOpts: UseWatchlistQuotesOptions = {}): UseWatchlistResult => {
  const listQuery = useWatchlistBase();
  const quotes = useWatchlistQuotes(listQuery.data ?? [], quoteOpts);

  const removeMutation = useRemoveWatchlistItem();

  const rows = (listQuery.data ?? []).map((row) => ({
    ...row,
    quote: quotes.quoteByAssetId.get(row.asset.id) ?? null,
  }));

  return {
    rows,
    isPending: listQuery.isPending || quotes.isPending,
    isFetching: listQuery.isFetching || quotes.isFetching,
    error: listQuery.error,
    refreshQuotes: quotes.refresh,
    remove: removeMutation.mutate,
    isRemoving: removeMutation.isPending,
    quoteRefreshFailureSummary: quotes.quoteRefreshFailureSummary,
  };
};

export interface AddWatchlistInput {
  symbol: string;
  name: string;
  market?: Market;
  currency?: Currency;
}

const ensureAsset = async (asset: Asset): Promise<void> => {
  // ignoreDuplicates: assets RLS allows INSERT only (0001); upsert UPDATE would fail
  // when the row already exists (e.g. seed data US:NVDA).
  const { error } = await supabase.from("assets").upsert(
    {
      id: asset.id,
      market: asset.market,
      symbol: asset.symbol,
      name: asset.name,
      currency: asset.currency,
    },
    { onConflict: "id", ignoreDuplicates: true }
  );
  if (error) {
    throw new Error(`Could not register asset ${asset.id}: ${error.message}`);
  }
};

export interface UseAddWatchlistItemOptions {
  /** Runs after DB write + cache invalidation (e.g. close search modal). */
  onSuccess?: () => void;
}

export const useAddWatchlistItem = (options: UseAddWatchlistItemOptions = {}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddWatchlistInput): Promise<string> => {
      if (!user) throw new Error("Not signed in");

      const market = input.market ?? "US";
      const symbol = input.symbol.trim().toUpperCase();
      const asset: Asset = {
        id: composeAssetId(market, symbol),
        market,
        symbol,
        name: input.name.trim() || symbol,
        currency: input.currency ?? "USD",
      };

      await ensureAsset(asset);

      const { error } = await supabase.from("watchlist_items").insert({
        user_id: user.id,
        asset_id: asset.id,
      });

      if (error) {
        if (error.code === "23505") {
          throw new Error("WATCHLIST_DUPLICATE");
        }
        throw error;
      }

      return asset.id;
    },
    onSuccess: async (assetId) => {
      try {
        const { market, symbol } = parseAssetId(assetId);
        await prefetchWatchlistQuote(market, symbol);
      } catch (err) {
        if (__DEV__) {
          console.warn(
            "[watchlist] prefetch quote after add failed:",
            err instanceof Error ? err.message : err
          );
        }
      }
      await queryClient.invalidateQueries({ queryKey: watchlistQueryKey(user?.id) });
      await queryClient.invalidateQueries({ queryKey: ["watchlist-quote", assetId] });
      options.onSuccess?.();
    },
  });
};

export const useRemoveWatchlistItem = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (watchlistItemId: string): Promise<void> => {
      if (!user) throw new Error("Not signed in");

      const { error } = await supabase
        .from("watchlist_items")
        .delete()
        .eq("id", watchlistItemId)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: watchlistQueryKey(user?.id) });
    },
  });
};
