/**
 * useUserPreferences() — read/write user_preferences row for the signed-in user.
 *
 * Stage 1 J3-J5 dependency. Reads:
 *   - reportingCurrency (J3)
 *   - locale (J4)
 *   - financeColorMode (J5) — feeds <BusinessTokensProvider mode={...}>
 *   - redacted (Stage 3 J16)
 *
 * Fix 7 (audit P1-2): TanStack Query backed. The previous implementation used
 * useState+useEffect inside each consumer, which meant:
 *   - Every consumer ran an independent fetch on mount
 *   - update() only mutated the *local* consumer's state, never refreshed
 *     other consumers in real time (so settings → reporting-currency change
 *     left Portfolio Tab on the stale value until next mount)
 *   - No way to invalidate / refetch on demand
 * The TanStack-Query rewrite preserves the external `{ prefs, loading, error, update }`
 * shape so the 4 consumer files don't need changes — only this file does.
 *
 * Auto-creation: the on_auth_user_created trigger inserts a default row at
 * signup. So as long as the user is signed in, the row exists.
 *
 * Returns `prefs = null` while loading or when signed out — consumers must handle that.
 */

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";

import { useAuth } from "./auth";
import { supabase } from "./supabase";

import type { Currency, FinanceColorMode, Locale } from "@arc/core";

export interface UserPreferences {
  reportingCurrency: Currency;
  locale: Locale;
  financeColorMode: FinanceColorMode;
  redacted: boolean;
  hasSeenWelcome: boolean;
}

interface DBRow {
  reporting_currency: Currency;
  locale: Locale;
  finance_color_mode: FinanceColorMode;
  redacted: boolean;
  has_seen_welcome: boolean;
}

const fromDB = (row: DBRow): UserPreferences => ({
  reportingCurrency: row.reporting_currency,
  locale: row.locale,
  financeColorMode: row.finance_color_mode,
  redacted: row.redacted,
  hasSeenWelcome: row.has_seen_welcome,
});

const toDBPatch = (patch: Partial<UserPreferences>): Partial<DBRow> => {
  const out: Partial<DBRow> = {};
  if (patch.reportingCurrency !== undefined) out.reporting_currency = patch.reportingCurrency;
  if (patch.locale !== undefined) out.locale = patch.locale;
  if (patch.financeColorMode !== undefined) out.finance_color_mode = patch.financeColorMode;
  if (patch.redacted !== undefined) out.redacted = patch.redacted;
  if (patch.hasSeenWelcome !== undefined) out.has_seen_welcome = patch.hasSeenWelcome;
  return out;
};

const prefsQueryKey = (userId: string | undefined) => ["userPreferences", userId] as const;

export interface UseUserPreferencesResult {
  prefs: UserPreferences | null;
  loading: boolean;
  error: Error | null;
  /** Patch one or more fields; auto-rewrites column names to snake_case. */
  update: (patch: Partial<UserPreferences>) => Promise<{ error: Error | null }>;
}

// Use the underlying query in a way that downstream consumers can read.
const useUserPreferencesQuery = (): UseQueryResult<UserPreferences | null, Error> => {
  const { user } = useAuth();

  return useQuery({
    queryKey: prefsQueryKey(user?.id),
    enabled: !!user,
    // Prefs are tiny + rarely change after sign-in. Keep them fresh for the
    // whole session unless explicitly invalidated by a mutation.
    staleTime: Infinity,
    queryFn: async (): Promise<UserPreferences | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("user_preferences")
        .select("reporting_currency, locale, finance_color_mode, redacted, has_seen_welcome")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data ? fromDB(data as DBRow) : null;
    },
  });
};

export function useUserPreferences(): UseUserPreferencesResult {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = prefsQueryKey(user?.id);

  const { data: prefs, isLoading: loading, error } = useUserPreferencesQuery();

  const mutation = useMutation({
    mutationFn: async (patch: Partial<UserPreferences>) => {
      if (!user) throw new Error("Not signed in");
      const { error: updateError } = await supabase
        .from("user_preferences")
        .update(toDBPatch(patch))
        .eq("user_id", user.id);
      if (updateError) throw updateError;
      return patch;
    },
    // Optimistic update — every consumer of this query sees the new value
    // immediately, before the network round-trips.
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<UserPreferences | null>(queryKey);
      queryClient.setQueryData<UserPreferences | null>(queryKey, (current) =>
        current ? { ...current, ...patch } : current
      );
      return { previous };
    },
    onError: (_err, _patch, ctx) => {
      // Roll back the optimistic update on failure.
      if (ctx?.previous !== undefined) {
        queryClient.setQueryData(queryKey, ctx.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const update = useCallback<UseUserPreferencesResult["update"]>(
    async (patch) => {
      try {
        await mutation.mutateAsync(patch);
        return { error: null };
      } catch (err) {
        return { error: err instanceof Error ? err : new Error(String(err)) };
      }
    },
    [mutation]
  );

  return {
    prefs: prefs ?? null,
    loading,
    error: (error as Error | null) ?? null,
    update,
  };
}

/**
 * Mark welcome screen as seen — optimistic flip without rollback on error (J6 AC-4.6).
 * Navigation should not await this mutation; DB sync retries in background.
 */
export function useMarkWelcomeSeen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = prefsQueryKey(user?.id);

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("user_preferences")
        .update({ has_seen_welcome: true })
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<UserPreferences | null>(queryKey);
      queryClient.setQueryData<UserPreferences | null>(queryKey, (current) =>
        current ? { ...current, hasSeenWelcome: true } : current
      );
      return { previous };
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
    retry: 2,
  });
}
