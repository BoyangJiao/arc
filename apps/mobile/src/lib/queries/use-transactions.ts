/**
 * useTransactions — fetch + create transactions for a given portfolio.
 *
 * Stage 1: Only BUY type supported. Writes to Supabase `transactions` table.
 * Shares / price / fee stored as text (Decimal serialized) in the DB.
 */

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import Decimal from "decimal.js";
import type { Currency, Transaction, TransactionType } from "@arc/core";

import { useAuth } from "../../lib/auth";
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
}

export const useCreateTransaction = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTransactionInput) => {
      if (!user) throw new Error("Not signed in");

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
    },
  });
};
