/**
 * Dev Tools scenario registry — grouped by feature under test.
 *
 * Scenario ids must stay in sync with `supabase/functions/_shared/seed-core.ts`.
 * Metro cannot import from supabase/functions; duplicate the registry here.
 */

import type { Href } from "expo-router";

export const DEV_SEED_FEATURES = [
  {
    id: "dailySnapshot",
    labelKey: "dailySnapshot",
    goHref: "/(tabs)" as Href,
    scenarios: [
      { id: "default", labelKey: "default" },
      { id: "daily-snapshot:big-gain", labelKey: "bigGain" },
      { id: "daily-snapshot:big-loss", labelKey: "bigLoss" },
      { id: "daily-snapshot:mixed-movers", labelKey: "mixedMovers" },
      { id: "daily-snapshot:first-day", labelKey: "firstDay" },
      { id: "daily-snapshot:empty", labelKey: "empty" },
    ],
  },
  {
    id: "watchlist",
    labelKey: "watchlist",
    goHref: "/(tabs)/markets" as Href,
    scenarios: [
      { id: "watchlist:empty", labelKey: "wlEmpty" },
      { id: "watchlist:3-items", labelKey: "wl3Items" },
      { id: "watchlist:stale-quotes", labelKey: "wlStale" },
    ],
  },
] as const;

export type DevSeedFeatureId = (typeof DEV_SEED_FEATURES)[number]["id"];

export type DevSeedScenarioEntry = (typeof DEV_SEED_FEATURES)[number]["scenarios"][number];

export type DevSeedScenarioId = DevSeedScenarioEntry["id"];

export type DevSeedScenarioLabelKey = DevSeedScenarioEntry["labelKey"];

export type DevSeedFeatureGroup = (typeof DEV_SEED_FEATURES)[number];

/** Flat list — used by invoke + legacy references. */
export const DEV_SEED_SCENARIOS: ReadonlyArray<{
  id: DevSeedScenarioId;
  labelKey: DevSeedScenarioLabelKey;
  featureId: DevSeedFeatureId;
}> = DEV_SEED_FEATURES.flatMap((feature) =>
  feature.scenarios.map((scenario) => ({
    id: scenario.id,
    labelKey: scenario.labelKey,
    featureId: feature.id,
  }))
);

export const WATCHLIST_SCENARIO_IDS = [
  "watchlist:empty",
  "watchlist:3-items",
  "watchlist:stale-quotes",
] as const satisfies readonly DevSeedScenarioId[];

export type WatchlistScenarioId = (typeof WATCHLIST_SCENARIO_IDS)[number];

export const isWatchlistScenario = (id: DevSeedScenarioId): id is WatchlistScenarioId =>
  (WATCHLIST_SCENARIO_IDS as readonly string[]).includes(id);

export const findFeatureForScenario = (scenarioId: DevSeedScenarioId): DevSeedFeatureGroup =>
  DEV_SEED_FEATURES.find((f) => f.scenarios.some((s) => s.id === scenarioId)) ??
  DEV_SEED_FEATURES[0];
