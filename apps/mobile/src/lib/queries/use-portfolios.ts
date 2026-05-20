/**
 * usePortfolios — fetch user's portfolios from Supabase.
 *
 * Stage 3 Block B: multi-portfolio CRUD + soft archive.
 */

import { useQuery, useMutation, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { DEFAULT_PORTFOLIO_CANONICAL_NAME, type Currency, type Portfolio } from "@arc/core";

import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";

export type UsePortfoliosOptions = {
  /** Include archived portfolios (default: active only). */
  readonly includeArchived?: boolean;
};

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

export const portfoliosQueryKey = (userId: string | undefined) => ["portfolios", userId] as const;

const filterPortfolios = (
  rows: ReadonlyArray<Portfolio>,
  options?: UsePortfoliosOptions
): Portfolio[] => {
  if (options?.includeArchived) return [...rows];
  return rows.filter((p) => p.archivedAt === null);
};

export const usePortfolios = (
  options?: UsePortfoliosOptions
): UseQueryResult<Portfolio[], Error> => {
  const { user } = useAuth();

  return useQuery({
    queryKey: [...portfoliosQueryKey(user?.id), options?.includeArchived ?? false],
    enabled: !!user,
    queryFn: async (): Promise<Portfolio[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("portfolios")
        .select("id, user_id, name, reporting_currency, created_at, archived_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return filterPortfolios((data ?? []).map(fromDB), options);
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

const invalidatePortfolios = (queryClient: ReturnType<typeof useQueryClient>, userId: string) => {
  queryClient.invalidateQueries({ queryKey: ["portfolios", userId] });
};

export const useCreatePortfolio = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; reportingCurrency: Currency }): Promise<string> => {
      if (!user) throw new Error("Not signed in");

      const { data, error } = await supabase
        .from("portfolios")
        .insert({
          user_id: user.id,
          name: input.name.trim(),
          reporting_currency: input.reportingCurrency,
        })
        .select("id")
        .single();

      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      if (user) invalidatePortfolios(queryClient, user.id);
    },
  });
};

export const useArchivePortfolio = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (portfolioId: string): Promise<void> => {
      if (!user) throw new Error("Not signed in");

      const { error } = await supabase
        .from("portfolios")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", portfolioId)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      if (user) invalidatePortfolios(queryClient, user.id);
    },
  });
};

export const useUnarchivePortfolio = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (portfolioId: string): Promise<void> => {
      if (!user) throw new Error("Not signed in");

      const { error } = await supabase
        .from("portfolios")
        .update({ archived_at: null })
        .eq("id", portfolioId)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      if (user) invalidatePortfolios(queryClient, user.id);
    },
  });
};

export const useRenamePortfolio = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; name: string }): Promise<void> => {
      if (!user) throw new Error("Not signed in");

      const { error } = await supabase
        .from("portfolios")
        .update({ name: input.name.trim() })
        .eq("id", input.id)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      if (user) {
        invalidatePortfolios(queryClient, user.id);
        queryClient.invalidateQueries({ queryKey: ["portfolio", variables.id] });
      }
    },
  });
};

export const useHardDeletePortfolio = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; confirmName: string }): Promise<void> => {
      if (!user) throw new Error("Not signed in");

      const { data: row, error: fetchErr } = await supabase
        .from("portfolios")
        .select("id, name, archived_at")
        .eq("id", input.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (fetchErr) throw fetchErr;
      if (!row) throw new Error("Portfolio not found");
      if (!row.archived_at) {
        throw new Error("Portfolio must be archived before permanent delete");
      }
      if (row.name !== input.confirmName.trim()) {
        throw new Error("Confirmation name does not match");
      }

      const { error: delErr } = await supabase
        .from("portfolios")
        .delete()
        .eq("id", input.id)
        .eq("user_id", user.id);

      if (delErr) throw delErr;
    },
    onSuccess: () => {
      if (user) invalidatePortfolios(queryClient, user.id);
    },
  });
};

export const usePortfolioTransactionCount = (portfolioId: string | undefined) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["portfolioTransactionCount", portfolioId],
    enabled: !!user && !!portfolioId,
    queryFn: async (): Promise<number> => {
      if (!portfolioId) return 0;

      const { count, error } = await supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("portfolio_id", portfolioId);

      if (error) throw error;
      return count ?? 0;
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

      const { data: existing } = await supabase
        .from("portfolios")
        .select("id")
        .eq("user_id", user.id)
        .is("archived_at", null)
        .limit(1)
        .maybeSingle();

      if (existing) return existing.id;

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
      if (user) invalidatePortfolios(queryClient, user.id);
    },
  });
};
