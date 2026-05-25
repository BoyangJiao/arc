/**
 * Dev Tools scenario registry — grouped by feature under test.
 *
 * Scenario ids must stay in sync with `supabase/functions/_shared/seed-core.ts`.
 * Metro cannot import from supabase/functions; duplicate the registry here.
 *
 * Env gating (cross-stage spec
 * `.specify/feature-specs/cross-stage/real-env-dev-tools.md` §S3-AC-RE.4):
 *   `requiredEnv` controls whether a feature group is rendered in the FAB.
 *   - `"clean"` (default): only shown when signed in as Clean +alias.
 *     All existing seed scenarios fall here — they wipe / overwrite
 *     user-scoped data and would corrupt the Real Env dataset.
 *   - `"any"`: rendered regardless of env (no current usage; reserved for
 *     read-only smoke scenarios like a future "live quote diagnostic").
 */

import type { Href } from "expo-router";

import type { DevEnvMode } from "./env-mode";

export type DevFeatureEnvRequirement = "clean" | "any";

export const DEV_SEED_FEATURES = [
  {
    id: "dailySnapshot",
    labelKey: "dailySnapshot",
    goHref: "/(tabs)" as Href,
    requiredEnv: "clean" as DevFeatureEnvRequirement,
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
    requiredEnv: "clean" as DevFeatureEnvRequirement,
    scenarios: [
      { id: "watchlist:empty", labelKey: "wlEmpty" },
      { id: "watchlist:3-items", labelKey: "wl3Items" },
      { id: "watchlist:stale-quotes", labelKey: "wlStale" },
    ],
  },
  {
    id: "rebalance",
    labelKey: "rebalance",
    goHref: "/(tabs)/insights" as Href,
    requiredEnv: "clean" as DevFeatureEnvRequirement,
    scenarios: [
      { id: "rebalance:empty-target", labelKey: "rbEmpty" },
      { id: "rebalance:aligned", labelKey: "rbAligned" },
      { id: "rebalance:mild-drift", labelKey: "rbMild" },
      { id: "rebalance:heavy-drift", labelKey: "rbHeavy" },
    ],
  },
  {
    id: "welcome",
    labelKey: "welcome",
    goHref: "/welcome" as Href,
    requiredEnv: "clean" as DevFeatureEnvRequirement,
    scenarios: [
      { id: "welcome:fresh", labelKey: "welFresh", goHref: "/welcome" as Href },
      { id: "welcome:seen", labelKey: "welSeen", goHref: "/(tabs)" as Href },
    ],
  },
  {
    id: "crossMarket",
    labelKey: "crossMarket",
    goHref: "/(tabs)" as Href,
    requiredEnv: "clean" as DevFeatureEnvRequirement,
    scenarios: [
      { id: "default:cn-only", labelKey: "cnOnly" },
      { id: "default:hk-only", labelKey: "hkOnly" },
      { id: "default:fund-only", labelKey: "fundOnly" },
      { id: "default:cross-market", labelKey: "crossMarketMix" },
      { id: "default:crypto-only", labelKey: "cryptoOnly" },
    ],
  },
  {
    id: "portfolios",
    labelKey: "portfolios",
    goHref: "/(tabs)" as Href,
    requiredEnv: "clean" as DevFeatureEnvRequirement,
    scenarios: [
      { id: "portfolios:single", labelKey: "pfSingle" },
      { id: "portfolios:multi-3", labelKey: "pfMulti3" },
      { id: "portfolios:transfer-history", labelKey: "pfTransfer" },
      { id: "portfolios:multi-market-full", labelKey: "pfMultiMarketFull" },
      { id: "portfolios:30-days-history", labelKey: "pf30DaysHistory" },
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

export const REBALANCE_SCENARIO_IDS = [
  "rebalance:empty-target",
  "rebalance:aligned",
  "rebalance:mild-drift",
  "rebalance:heavy-drift",
] as const satisfies readonly DevSeedScenarioId[];

export type RebalanceScenarioId = (typeof REBALANCE_SCENARIO_IDS)[number];

export const isRebalanceScenario = (id: DevSeedScenarioId): id is RebalanceScenarioId =>
  (REBALANCE_SCENARIO_IDS as readonly string[]).includes(id);

export const WELCOME_SCENARIO_IDS = [
  "welcome:fresh",
  "welcome:seen",
] as const satisfies readonly DevSeedScenarioId[];

export type WelcomeScenarioId = (typeof WELCOME_SCENARIO_IDS)[number];

export const isWelcomeScenario = (id: DevSeedScenarioId): id is WelcomeScenarioId =>
  (WELCOME_SCENARIO_IDS as readonly string[]).includes(id);

export const PORTFOLIO_SCENARIO_IDS = [
  "portfolios:single",
  "portfolios:multi-3",
  "portfolios:transfer-history",
  "portfolios:multi-market-full",
  "portfolios:30-days-history",
] as const satisfies readonly DevSeedScenarioId[];

export const BLOCK_C_PORTFOLIO_SCENARIO_IDS = [
  "portfolios:multi-market-full",
  "portfolios:30-days-history",
] as const satisfies readonly DevSeedScenarioId[];

export type BlockCPortfolioScenarioId = (typeof BLOCK_C_PORTFOLIO_SCENARIO_IDS)[number];

export const isBlockCPortfolioScenario = (id: DevSeedScenarioId): id is BlockCPortfolioScenarioId =>
  (BLOCK_C_PORTFOLIO_SCENARIO_IDS as readonly string[]).includes(id);

export type PortfolioScenarioId = (typeof PORTFOLIO_SCENARIO_IDS)[number];

export const isPortfolioScenario = (id: DevSeedScenarioId): id is PortfolioScenarioId =>
  (PORTFOLIO_SCENARIO_IDS as readonly string[]).includes(id);

export const findFeatureForScenario = (scenarioId: DevSeedScenarioId): DevSeedFeatureGroup =>
  DEV_SEED_FEATURES.find((f) => f.scenarios.some((s) => s.id === scenarioId)) ??
  DEV_SEED_FEATURES[0];

export const goHrefForScenario = (scenarioId: DevSeedScenarioId): Href => {
  for (const feature of DEV_SEED_FEATURES) {
    const scenario = feature.scenarios.find((s) => s.id === scenarioId);
    if (scenario) {
      return "goHref" in scenario && scenario.goHref ? scenario.goHref : feature.goHref;
    }
  }
  return DEV_SEED_FEATURES[0].goHref;
};

/**
 * Returns the feature groups visible in the current DEV env (spec §S3-AC-RE.4).
 *
 * - `envMode === "clean"`  → all features (every group is `requiredEnv: "clean"` today)
 * - `envMode === "real"`   → only features marked `requiredEnv: "any"` (none today,
 *                            so the picker effectively disappears in Real env)
 * - `envMode === "unknown"`→ same as Real — refuse to seed anything until the
 *                            user signs in to a recognised +alias account
 */
export const visibleFeaturesForEnv = (envMode: DevEnvMode): ReadonlyArray<DevSeedFeatureGroup> => {
  if (envMode === "clean") return DEV_SEED_FEATURES;
  return DEV_SEED_FEATURES.filter((feature) => feature.requiredEnv === "any");
};
