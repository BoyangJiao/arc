/**
 * useTransactions — fetch + create transactions for a given portfolio.
 *
 * Stage 1: Only BUY type supported. Writes to Supabase `transactions` table.
 * Shares / price / fee stored as text (Decimal serialized) in the DB.
 *
 * useAllTransactions — fetch ALL transactions across every portfolio owned by
 * the current user (used by CSV export for full backup semantics).
 */

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import Decimal from "decimal.js";
import {
  parseAssetId,
  type Asset,
  type Currency,
  type Market,
  type Transaction,
  type TransactionType,
} from "@arc/core";

import { validateUsSymbol } from "../validate-us-symbol";
import { useAuth } from "../../lib/auth";
import { priceCache } from "../market-data";
import { supabase } from "../../lib/supabase";

interface DBTransactionRow {
  id: string;
  portfolio_id: string;
  asset_id: string;
  type: TransactionType;
  shares: string;
  price_per_share: string;
  currency: Currency;
  fee: string;
  trade_date: string;
  notes: string | null;
}

const fromDB = (row: DBTransactionRow): Transaction => ({
  id: row.id,
  portfolioId: row.portfolio_id,
  assetId: row.asset_id,
  type: row.type,
  shares: new Decimal(row.shares),
  pricePerShare: new Decimal(row.price_per_share),
  currency: row.currency,
  fee: new Decimal(row.fee),
  tradeDate: row.trade_date,
  notes: row.notes ?? undefined,
});

export const useTransactions = (
  portfolioId: string | undefined
): UseQueryResult<Transaction[], Error> => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["transactions", portfolioId],
    enabled: !!user && !!portfolioId,
    queryFn: async (): Promise<Transaction[]> => {
      if (!portfolioId) return [];

      const { data, error } = await supabase
        .from("transactions")
        .select(
          "id, portfolio_id, asset_id, type, shares, price_per_share, currency, fee, trade_date, notes"
        )
        .eq("portfolio_id", portfolioId)
        .order("trade_date", { ascending: true });

      if (error) throw error;
      return (data ?? []).map(fromDB);
    },
  });
};

export interface CreateTransactionAssetMeta {
  readonly market: Market;
  readonly symbol: string;
  readonly name: string;
  readonly currency: Currency;
}

export interface CreateTransactionInput {
  portfolioId: string;
  assetId: string;
  type: TransactionType;
  shares: string; // Decimal string
  pricePerShare: string; // Decimal string
  currency: Currency;
  fee: string; // Decimal string
  tradeDate: string; // ISO date
  notes?: string;
  /** When set, upserts assets row before insert (cross-market tx entry). */
  assetMeta?: CreateTransactionAssetMeta;
}

/**
 * Ensure `assets` row exists before inserting a transaction (FK).
 * Stage 1 US-only: name defaults to symbol until Stage 2 search enriches metadata.
 */
const ensureAssetRow = async (asset: Asset): Promise<void> => {
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

export const useCreateTransaction = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTransactionInput) => {
      if (!user) throw new Error("Not signed in");

      const { market, symbol } = parseAssetId(input.assetId);

      if (market === "US") {
        const validation = await validateUsSymbol(symbol);
        if (!validation.ok) {
          if (validation.code === "not_found") {
            throw new Error(`SYMBOL_NOT_FOUND:${symbol}`);
          }
          if (validation.code === "rate_limited") {
            throw new Error("SYMBOL_RATE_LIMITED");
          }
          throw new Error(validation.message);
        }
        await priceCache.set(validation.quote);
      }

      const meta = input.assetMeta ?? {
        market,
        symbol,
        name: symbol,
        currency: input.currency,
      };
      await ensureAssetRow({
        id: input.assetId,
        market: meta.market,
        symbol: meta.symbol,
        name: meta.name,
        currency: meta.currency,
      });

      const { error } = await supabase.from("transactions").insert({
        portfolio_id: input.portfolioId,
        asset_id: input.assetId,
        type: input.type,
        shares: input.shares,
        price_per_share: input.pricePerShare,
        currency: input.currency,
        fee: input.fee,
        trade_date: input.tradeDate,
        notes: input.notes || null,
      });

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["transactions", variables.portfolioId] });
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      // portfolioValuation refetches when txFingerprint changes — no extra AV burst.
    },
  });
};

/** Delete a single transaction by id. Invalidates portfolio valuation. */
export const useDeleteTransaction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; portfolioId: string }) => {
      const { error } = await supabase.from("transactions").delete().eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["transactions", variables.portfolioId] });
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
    },
  });
};

/**
 * Per-asset transaction list — client-side filter of the portfolio's cached transactions.
 * Returns newest-first; reuses the parent portfolio query (no extra network call).
 */
export const useAssetTransactions = (
  portfolioId: string | undefined,
  assetId: string | undefined
): { data: readonly Transaction[]; isPending: boolean } => {
  const query = useTransactions(portfolioId);
  const data = useMemo(
    () =>
      assetId
        ? (query.data ?? [])
            .filter((t) => t.assetId === assetId)
            .slice()
            .sort((a, b) => b.tradeDate.localeCompare(a.tradeDate))
        : [],
    [query.data, assetId]
  );
  return { data, isPending: query.isPending };
};

/**
 * Fetch ALL transactions across every portfolio owned by the current user.
 * Used exclusively by CSV export — single query via RLS (portfolios join).
 * Returns trades ordered by trade_date ascending (oldest first).
 */
export const useAllTransactions = (): UseQueryResult<Transaction[], Error> => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["transactions", "all", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Transaction[]> => {
      if (!user) return [];

      // RLS ensures only user's own portfolios rows are returned.
      // We join via portfolios to implicitly scope to this user's data.
      const { data, error } = await supabase
        .from("transactions")
        .select(
          "id, portfolio_id, asset_id, type, shares, price_per_share, currency, fee, trade_date, notes, portfolios!inner(user_id)"
        )
        .eq("portfolios.user_id", user.id)
        .order("trade_date", { ascending: true });

      if (error) throw error;
      return (data ?? []).map(fromDB);
    },
  });
};

/** Remove all transactions for one asset in a portfolio (holding goes to zero). */
export const useDeleteAssetTransactions = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { portfolioId: string; assetId: string }) => {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("portfolio_id", input.portfolioId)
        .eq("asset_id", input.assetId);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["transactions", variables.portfolioId] });
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
    },
  });
};
