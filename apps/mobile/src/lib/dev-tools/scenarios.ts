/**
 * Dev Tools scenario list — ids must stay in sync with
 * supabase/functions/_shared/seed-core.ts `DEV_SEED_UI_SCENARIOS`.
 *
 * Metro cannot import from supabase/functions; duplicate the registry here.
 */

export const DEV_SEED_SCENARIOS = [
  { id: "default", labelKey: "default" },
  { id: "daily-snapshot:big-gain", labelKey: "bigGain" },
  { id: "daily-snapshot:big-loss", labelKey: "bigLoss" },
  { id: "daily-snapshot:mixed-movers", labelKey: "mixedMovers" },
  { id: "daily-snapshot:first-day", labelKey: "firstDay" },
  { id: "daily-snapshot:empty", labelKey: "empty" },
  { id: "watchlist:empty", labelKey: "wlEmpty" },
  { id: "watchlist:3-items", labelKey: "wl3Items" },
  { id: "watchlist:stale-quotes", labelKey: "wlStale" },
] as const;

export type DevSeedScenarioId = (typeof DEV_SEED_SCENARIOS)[number]["id"];

export type DevSeedScenarioLabelKey = (typeof DEV_SEED_SCENARIOS)[number]["labelKey"];
