/**
 * useTransferBetweenPortfolios — cross-portfolio CASH transfer mutation.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Decimal from "decimal.js";
import {
  buildTransferTransactions,
  parseAssetId,
  validateTransfer,
  type Currency,
  type TransferError,
  type TransferIntent,
} from "@arc/core";

import { useAuth } from "../auth";
import { supabase } from "../supabase";

export class TransferValidationError extends Error {
  readonly errors: ReadonlyArray<TransferError>;

  constructor(errors: ReadonlyArray<TransferError>) {
    super(errors.map((e) => e.code).join(", "));
    this.name = "TransferValidationError";
    this.errors = errors;
  }
}

const computeCashBalance = (rows: ReadonlyArray<{ shares: string; type: string }>): Decimal => {
  let current = new Decimal(0);
  for (const tx of rows) {
    const shares = new Decimal(tx.shares);
    if (tx.type === "BUY") current = current.plus(shares);
    else if (tx.type === "SELL") current = current.minus(shares);
  }
  return current;
};

const fetchSourceCashBalance = async (portfolioId: string, assetId: string): Promise<Decimal> => {
  const { data, error } = await supabase
    .from("transactions")
    .select("shares, type")
    .eq("portfolio_id", portfolioId)
    .eq("asset_id", assetId);

  if (error) throw error;
  return computeCashBalance(data ?? []);
};

const ensureCashAsset = async (assetId: string): Promise<void> => {
  const { symbol } = parseAssetId(assetId);
  const currency = symbol as Currency;

  const { error } = await supabase.from("assets").upsert(
    {
      id: assetId,
      market: "CASH",
      symbol,
      name: symbol,
      currency,
    },
    { onConflict: "id", ignoreDuplicates: true }
  );

  if (error) throw error;
};

const toInsertRow = (tx: ReturnType<typeof buildTransferTransactions>["source"]) => ({
  portfolio_id: tx.portfolioId,
  asset_id: tx.assetId,
  type: tx.type,
  shares: tx.shares.toString(),
  price_per_share: tx.pricePerShare.toString(),
  currency: tx.currency,
  fee: tx.fee.toString(),
  trade_date: tx.tradeDate,
  notes: tx.notes ?? null,
});

export const useTransferBetweenPortfolios = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (intent: TransferIntent): Promise<void> => {
      if (!user) throw new Error("Not signed in");

      const latestBalance = await fetchSourceCashBalance(intent.sourcePortfolioId, intent.assetId);

      const errors = validateTransfer(intent, latestBalance);
      if (errors.length > 0) {
        throw new TransferValidationError(errors);
      }

      const createdAtIso = new Date().toISOString();
      const { source, dest } = buildTransferTransactions(intent, createdAtIso);

      await ensureCashAsset(intent.assetId);

      const { error: insErr } = await supabase
        .from("transactions")
        .insert([toInsertRow(source), toInsertRow(dest)]);

      if (insErr) throw insErr;
    },
    onSuccess: (_data, intent) => {
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      queryClient.invalidateQueries({
        queryKey: ["transactions", intent.sourcePortfolioId],
      });
      queryClient.invalidateQueries({
        queryKey: ["transactions", intent.destPortfolioId],
      });
      queryClient.invalidateQueries({ queryKey: ["portfolioValuation"] });
      queryClient.invalidateQueries({ queryKey: ["rebalance"] });
    },
  });
};
