/**
 * Global amount visibility — backed by `user_preferences.redacted` (persists across cold start).
 */

import { useCallback } from "react";

import { useUserPreferences } from "./user-preferences";

export function useAmountRedacted() {
  const { prefs, update, loading } = useUserPreferences();
  const amountsHidden = prefs?.redacted ?? false;

  const toggleAmountVisibility = useCallback(() => {
    void update({ redacted: !amountsHidden });
  }, [amountsHidden, update]);

  return {
    amountsHidden,
    toggleAmountVisibility,
    loading,
  };
}
