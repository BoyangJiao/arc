/**
 * usePortfolios — fetch user's portfolios from Supabase.
 *
 * Stage 1: Each user has at most 1 portfolio ("My Portfolio").
 * The on_auth_user_created trigger auto-creates it at signup.
 * If no portfolio exists (e.g. dev bypass), returns empty array.
 */

import { useQuery, useMutation, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { DEFAULT_PORTFOLIO_CANONICAL_NAME, type Currency, type Portfolio } from "@arc/core";

import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";

interface DBPortfolioRow {
  id: string;
  user_id: string;
  name: string;
  reporting_currency: Currency;
  created_at: string;
  archived_at: string | null;
}

const fromDB = (row: DBPortfolioRow): Portfolio => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  reportingCurrency: row.reporting_currency,
  createdAt: row.created_at,
  archivedAt: row.archived_at,
});

export const usePortfolios = (): UseQueryResult<Portfolio[], Error> => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["portfolios", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Portfolio[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("portfolios")
        .select("id, user_id, name, reporting_currency, created_at, archived_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data ?? []).map(fromDB);
    },
  });
};

export const usePortfolio = (id: string | undefined): UseQueryResult<Portfolio | null, Error> => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["portfolio", id],
    enabled: !!user && !!id,
    queryFn: async (): Promise<Portfolio | null> => {
      if (!user || !id) return null;

      const { data, error } = await supabase
        .from("portfolios")
        .select("id, user_id, name, reporting_currency, created_at, archived_at")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data ? fromDB(data) : null;
    },
  });
};

/**
 * Ensure at least one default portfolio exists for the current user.
 * Returns the portfolio ID (creates if needed).
 */
export const useEnsureDefaultPortfolio = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string = DEFAULT_PORTFOLIO_CANONICAL_NAME): Promise<string> => {
      if (!user) throw new Error("Not signed in");

      // Check if one already exists
      const { data: existing } = await supabase
        .from("portfolios")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (existing) return existing.id;

      // Create default portfolio
      const { data, error } = await supabase
        .from("portfolios")
        .insert({
          user_id: user.id,
          name,
          reporting_currency: "CNY",
        })
        .select("id")
        .single();

      if (error) throw error;
      return data.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
    },
  });
};
