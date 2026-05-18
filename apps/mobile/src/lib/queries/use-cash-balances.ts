/**
 * useCashBalances — read/write CASH:* holdings via BUY/SELL at price 1.0 (Stage 2 hack).
 *
 * Stage 3 will introduce dedicated CASH_IN / CASH_OUT transaction types.
 */

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { composeAssetId, parseAssetId, type Currency } from "@arc/core";

import { useAuth } from "../auth";
import { supabase } from "../supabase";
import { usePortfolioHoldings } from "./use-portfolio-holdings";

export const CASH_ASSET_IDS = ["CASH:USD", "CASH:CNY", "CASH:HKD", "CASH:JPY"] as const;

export type CashAssetId = (typeof CASH_ASSET_IDS)[number];

export interface CashBalanceRow {
  readonly assetId: CashAssetId;
  readonly currency: Currency;
  readonly balance: Decimal;
}

export const useCashBalances = (portfolioId: string | undefined) => {
  const { holdings, ...query } = usePortfolioHoldings(portfolioId);

  const rows: CashBalanceRow[] = useMemo(() => {
    const byId = new Map(holdings.map((h) => [h.assetId, h.shares]));
    return CASH_ASSET_IDS.map((assetId) => {
      const { symbol } = parseAssetId(assetId);
      return {
        assetId,
        currency: symbol as Currency,
        balance: byId.get(assetId) ?? new Decimal(0),
      };
    });
  }, [holdings]);

  return { rows, ...query };
};

export const useSaveCashBalances = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      portfolioId: string;
      desired: ReadonlyArray<{ assetId: CashAssetId; amount: Decimal }>;
    }): Promise<void> => {
      if (!user) throw new Error("Not signed in");

      const { portfolioId, desired } = input;
      const now = new Date().toISOString();

      for (const row of desired) {
        const { symbol } = parseAssetId(row.assetId);
        const currency = symbol as Currency;

        await supabase.from("assets").upsert(
          {
            id: row.assetId,
            market: "CASH",
            symbol,
            name: symbol,
            currency,
          },
          { onConflict: "id", ignoreDuplicates: true }
        );

        const { data: existingTx, error: txReadErr } = await supabase
          .from("transactions")
          .select("shares, type")
          .eq("portfolio_id", portfolioId)
          .eq("asset_id", row.assetId);

        if (txReadErr) throw txReadErr;

        let current = new Decimal(0);
        for (const tx of existingTx ?? []) {
          const shares = new Decimal((tx as { shares: string }).shares);
          const type = (tx as { type: string }).type;
          if (type === "BUY") current = current.plus(shares);
          else if (type === "SELL") current = current.minus(shares);
        }

        const diff = row.amount.minus(current);
        if (diff.isZero()) continue;

        const type = diff.isPositive() ? "BUY" : "SELL";
        const shares = diff.abs().toString();

        const { error: insErr } = await supabase.from("transactions").insert({
          portfolio_id: portfolioId,
          asset_id: row.assetId,
          type,
          shares,
          price_per_share: "1",
          currency,
          fee: "0",
          trade_date: now,
          notes: "cash-balances",
        });

        if (insErr) throw insErr;
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["transactions", variables.portfolioId] });
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      queryClient.invalidateQueries({ queryKey: ["portfolioValuation"] });
      queryClient.invalidateQueries({ queryKey: ["rebalance"] });
      queryClient.invalidateQueries({ queryKey: ["targetAllocations", variables.portfolioId] });
    },
  });
};

export const cashAssetIdForCurrency = (currency: Currency): CashAssetId =>
  composeAssetId("CASH", currency) as CashAssetId;
