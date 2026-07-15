/**
 * Resets the Clean DEV env (cross-stage spec §S3-AC-RE.3).
 *
 * Hard preconditions:
 *   1. A user must be signed in.
 *   2. `detectEnvMode(user.email)` must equal "clean" — otherwise the script
 *      refuses. This is the only barrier between a misclick and wiping the
 *      6-month Real Env dataset (spec §决策 3 traded extra friction for trust;
 *      see Risks table).
 *
 * What this function does (per spec §S3-AC-RE.3):
 *   - Deletes the Clean user's rows from every user-scoped table.
 *     ORDER MATTERS — FKs require dependents to be deleted before parents:
 *       transactions / target_allocations / portfolio_value_snapshots
 *       → portfolios → user_preferences (independent) + watchlist_items
 *     Deletes are RLS-mediated (`.eq("user_id", user.id)` is belt + suspenders
 *     on top of `WHERE user_id = auth.uid()` policies — see migrations 0001-0013).
 *   - Wipes user-scoped AsyncStorage keys (active portfolio id, last-used
 *     market chips). Supabase auth tokens (`sb-*-auth-token`) are deliberately
 *     left intact so the user remains signed in to Clean afterwards.
 *   - `queryClient.clear()` drops all cached data so re-mounts re-fetch.
 *
 * What this function does NOT do:
 *   - Delete the Supabase auth user (account stays so user can sign back in).
 *   - Touch Real Env rows (RLS forbids cross-user reads anyway — this is just
 *     additional protection at the application layer).
 *   - Run any seed scenario afterwards (user lands on /welcome and walks the
 *     standard onboarding flow — that's the whole point of Reset).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import { clearQueryCache } from "../cache/clear-query-cache";
import { supabase } from "../supabase";
import { detectEnvMode } from "./env-mode";

export class ResetCleanEnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResetCleanEnvError";
  }
}

/**
 * AsyncStorage keys to clear on reset. Source of truth = grep
 * `AsyncStorage.(set|get|remove)Item` + the persist-store `name` fields:
 *
 *   - `arc.activePortfolioId`      — zustand persist in store/active-portfolio.ts
 *   - `arc.lastUsedMarket.{pfId}`  — per-portfolio market chip default (Block C)
 *
 * Deliberately NOT cleared:
 *   - `arc:dev-tools-fab:v1`       — FAB position is UI prefs, not user data
 *   - `arc.colorMode`              — light/dark app theme (device UI pref)
 *   - `sb-*-auth-token` etc.       — Supabase session; clearing would force re-login
 */
const STATIC_KEYS_TO_CLEAR = ["arc.activePortfolioId"] as const;
const LAST_USED_MARKET_PREFIX = "arc.lastUsedMarket.";

interface ResetSummary {
  deletedFromTables: ReadonlyArray<string>;
  clearedAsyncStorageKeys: ReadonlyArray<string>;
}

export const resetCleanEnv = async (_queryClient: unknown): Promise<ResetSummary> => {
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr) {
    throw new ResetCleanEnvError(`Auth check failed: ${authErr.message}`);
  }
  if (!user) {
    throw new ResetCleanEnvError("Not signed in — sign in as Clean before resetting.");
  }

  const mode = detectEnvMode(user.email);
  if (mode !== "clean") {
    throw new ResetCleanEnvError(
      `Refusing to reset — signed in as ${user.email ?? "<no email>"} (mode=${mode}), not Clean env.`
    );
  }

  const userId = user.id;
  const tablesDeleted: string[] = [];

  // 1. Fetch user's portfolio IDs so we can delete portfolio-scoped tables
  //    (transactions / target_allocations / portfolio_value_snapshots have
  //    portfolio_id FK, not user_id directly).
  const { data: portfolioRows, error: pfErr } = await supabase
    .from("portfolios")
    .select("id")
    .eq("user_id", userId);
  if (pfErr) {
    throw new ResetCleanEnvError(`Failed to fetch portfolios: ${pfErr.message}`);
  }
  const portfolioIds = (portfolioRows ?? []).map((r) => r.id as string);

  // 2. Delete portfolio-scoped dependents (FK cascade order; portfolio_id column only).
  const portfolioScopedTables = [
    "transactions",
    "target_allocations",
    "portfolio_value_snapshots",
  ] as const;

  for (const table of portfolioScopedTables) {
    if (portfolioIds.length === 0) {
      // No portfolios → nothing to delete in dependent tables.
      tablesDeleted.push(table);
      continue;
    }
    const { error } = await supabase.from(table).delete().in("portfolio_id", portfolioIds);
    if (error) {
      throw new ResetCleanEnvError(`Failed to wipe ${table}: ${error.message}`);
    }
    tablesDeleted.push(table);
  }

  // 3. Delete user-scoped tables (have user_id column directly).
  const userScopedTables = ["watchlist_items", "portfolios", "user_preferences"] as const;

  for (const table of userScopedTables) {
    const { error } = await supabase.from(table).delete().eq("user_id", userId);
    if (error) {
      throw new ResetCleanEnvError(`Failed to wipe ${table}: ${error.message}`);
    }
    tablesDeleted.push(table);
  }

  // 2. AsyncStorage — static keys + per-portfolio market chip keys.
  const allKeys = await AsyncStorage.getAllKeys();
  const dynamicMarketKeys = allKeys.filter((k) => k.startsWith(LAST_USED_MARKET_PREFIX));
  const keysToRemove = [...STATIC_KEYS_TO_CLEAR, ...dynamicMarketKeys];
  if (keysToRemove.length > 0) {
    await AsyncStorage.multiRemove(keysToRemove);
  }

  // 3. Drop all cached queries (in-memory + MMKV on-disk) so the next mount
  //    sees fresh (empty) state. AC.OF.9: prevents Clean env user from seeing
  //    a previous session's cached holdings after reset.
  await clearQueryCache();

  return {
    deletedFromTables: tablesDeleted,
    clearedAsyncStorageKeys: keysToRemove,
  };
};
