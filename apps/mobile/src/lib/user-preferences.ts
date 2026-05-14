/**
 * useUserPreferences() — read/write user_preferences row for the signed-in user.
 *
 * Stage 1 J3-J5 dependency. Reads:
 *   - reportingCurrency (J3)
 *   - locale (J4)
 *   - financeColorMode (J5) — feeds <BusinessTokensProvider mode={...}>
 *   - redacted (Stage 3 J16)
 *
 * Auto-creation: the on_auth_user_created trigger inserts a default row at
 * signup. So as long as the user is signed in, the row exists.
 *
 * Returns `null` while loading or when signed out — consumers must handle that.
 *
 * NOTE: This is a minimal Stage 1 implementation. Stage 1 step 4 will swap to
 * TanStack Query for cache invalidation + optimistic updates. For now, plain
 * useEffect is enough to power J5's mode switch.
 */

import { useCallback, useEffect, useState } from "react";

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

export interface UseUserPreferencesResult {
  prefs: UserPreferences | null;
  loading: boolean;
  error: Error | null;
  /** Patch one or more fields; auto-rewrites column names to snake_case. */
  update: (patch: Partial<UserPreferences>) => Promise<{ error: Error | null }>;
}

export function useUserPreferences(): UseUserPreferencesResult {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setPrefs(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    supabase
      .from("user_preferences")
      .select("reporting_currency, locale, finance_color_mode, redacted, has_seen_welcome")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) {
          setError(fetchError);
        } else if (data) {
          setPrefs(fromDB(data as DBRow));
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const update = useCallback<UseUserPreferencesResult["update"]>(
    async (patch) => {
      if (!user) return { error: new Error("Not signed in") };

      const dbPatch: Partial<DBRow> = {};
      if (patch.reportingCurrency !== undefined)
        dbPatch.reporting_currency = patch.reportingCurrency;
      if (patch.locale !== undefined) dbPatch.locale = patch.locale;
      if (patch.financeColorMode !== undefined) dbPatch.finance_color_mode = patch.financeColorMode;
      if (patch.redacted !== undefined) dbPatch.redacted = patch.redacted;
      if (patch.hasSeenWelcome !== undefined) dbPatch.has_seen_welcome = patch.hasSeenWelcome;

      const { error: updateError } = await supabase
        .from("user_preferences")
        .update(dbPatch)
        .eq("user_id", user.id);

      if (!updateError) {
        setPrefs((prev) => (prev ? { ...prev, ...patch } : prev));
      }
      return { error: updateError ?? null };
    },
    [user]
  );

  return { prefs, loading, error, update };
}
