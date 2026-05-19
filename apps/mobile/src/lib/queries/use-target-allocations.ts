/**
 * useTargetAllocations — CRUD for target_allocations (Stage 2 J9).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Decimal from "decimal.js";
import type { TargetAllocation } from "@arc/core";

import { useAuth } from "../auth";
import { supabase } from "../supabase";

interface DbTargetRow {
  id: string;
  portfolio_id: string;
  asset_id: string;
  target_percent: string;
  updated_at: string;
}

const fromDb = (row: DbTargetRow): TargetAllocation => ({
  assetId: row.asset_id,
  targetPercent: new Decimal(row.target_percent),
});

export const targetAllocationsQueryKey = (portfolioId: string | undefined) =>
  ["targetAllocations", portfolioId] as const;

export const useTargetAllocations = (portfolioId: string | undefined) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: targetAllocationsQueryKey(portfolioId),
    enabled: !!user && !!portfolioId,
    queryFn: async (): Promise<TargetAllocation[]> => {
      if (!portfolioId) return [];

      const { data, error } = await supabase
        .from("target_allocations")
        .select("id, portfolio_id, asset_id, target_percent, updated_at")
        .eq("portfolio_id", portfolioId);

      if (error) throw error;
      return (data ?? []).map((row) => fromDb(row as DbTargetRow));
    },
  });
};

export const useUpsertTargetAllocations = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      portfolioId: string;
      targets: ReadonlyArray<TargetAllocation>;
    }): Promise<void> => {
      const { portfolioId, targets } = input;

      const { error: delErr } = await supabase
        .from("target_allocations")
        .delete()
        .eq("portfolio_id", portfolioId);
      if (delErr) throw delErr;

      if (targets.length === 0) return;

      const rows = targets.map((t) => ({
        portfolio_id: portfolioId,
        asset_id: t.assetId,
        target_percent: t.targetPercent.toString(),
      }));

      const { error: insErr } = await supabase.from("target_allocations").insert(rows);
      if (insErr) throw insErr;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: targetAllocationsQueryKey(variables.portfolioId),
      });
      queryClient.invalidateQueries({ queryKey: ["rebalance"] });
    },
  });
};

export const useDeleteAllTargetAllocations = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (portfolioId: string): Promise<void> => {
      const { error } = await supabase
        .from("target_allocations")
        .delete()
        .eq("portfolio_id", portfolioId);
      if (error) throw error;
    },
    onSuccess: (_data, portfolioId) => {
      queryClient.invalidateQueries({ queryKey: targetAllocationsQueryKey(portfolioId) });
      queryClient.invalidateQueries({ queryKey: ["rebalance"] });
    },
  });
};
