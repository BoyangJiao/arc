/**
 * Shared dev seed logic — used by:
 *   - tools/seed-dev-data.ts (CLI, service role + email lookup)
 *   - supabase/functions/dev-seed (Edge Function, authenticated user JWT)
 *
 * Keep Deno- and Node-compatible: no node:fs, only @supabase/supabase-js types.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ──────────────────────────────────────────────────────────────────────────
// Scenario registry

export const SCENARIOS = [
  "default",
  "daily-snapshot:big-gain",
  "daily-snapshot:big-loss",
  "daily-snapshot:mixed-movers",
  "daily-snapshot:first-day",
  "daily-snapshot:empty",
  "watchlist:empty",
  "watchlist:3-items",
  "watchlist:stale-quotes",
] as const;

export type Scenario = (typeof SCENARIOS)[number];

export const isScenario = (v: unknown): v is Scenario =>
  typeof v === "string" && (SCENARIOS as readonly string[]).includes(v);

export interface ScenarioPlan {
  includeTransactions: boolean;
  baseline: null | {
    prices: Record<"AAPL" | "MSFT" | "NVDA", string>;
    expectedDeltaSummary: string;
  };
  /** When set, (re)seeds watchlist_items for the user. */
  watchlist?: {
    assetIds: ReadonlyArray<string>;
    staleQuotes?: boolean;
  };
  description: string;
}

const CURRENT = { AAPL: 189.5, MSFT: 420.3, NVDA: 875.0 } as const;

const baselineFromFactor = (factor: number) => ({
  AAPL: (CURRENT.AAPL * factor).toFixed(2),
  MSFT: (CURRENT.MSFT * factor).toFixed(2),
  NVDA: (CURRENT.NVDA * factor).toFixed(2),
});

export const SCENARIO_PLANS: Record<Scenario, ScenarioPlan> = {
  default: {
    includeTransactions: true,
    baseline: {
      prices: baselineFromFactor(0.98),
      expectedDeltaSummary: "≈ +2% (baseline ~-2% vs current)",
    },
    description: "Happy path: 3 holdings, yesterday's baseline ~2% below today.",
  },
  "daily-snapshot:big-gain": {
    includeTransactions: true,
    baseline: {
      prices: baselineFromFactor(0.9),
      expectedDeltaSummary: "≈ +10% (baseline ~-10% vs current)",
    },
    description: "Big positive day — large gain numbers + 3 green mover chips.",
  },
  "daily-snapshot:big-loss": {
    includeTransactions: true,
    baseline: {
      prices: baselineFromFactor(1.05),
      expectedDeltaSummary: "≈ -5% (baseline ~+5% vs current)",
    },
    description: "Big negative day — verifies negative coloring + sign formatting.",
  },
  "daily-snapshot:mixed-movers": {
    includeTransactions: true,
    baseline: {
      prices: { AAPL: "188.56", MSFT: "433.30", NVDA: "810.19" },
      expectedDeltaSummary:
        "mixed (NVDA +8%, MSFT -3%, AAPL +0.5%) — verifies Top-3 sort + red/green mixed",
    },
    description: "Top-3 mover sort + mixed gain/loss colors (S2-AC-1.4 + 1.5).",
  },
  "daily-snapshot:first-day": {
    includeTransactions: true,
    baseline: null,
    description:
      "Brand-new user simulation: holdings exist but NO yesterday snapshot → placeholder copy.",
  },
  "daily-snapshot:empty": {
    includeTransactions: false,
    baseline: null,
    description: "Empty portfolio: 0 transactions → Daily Snapshot card not rendered.",
  },
  "watchlist:empty": {
    includeTransactions: false,
    baseline: null,
    watchlist: { assetIds: [] },
    description: "Empty watchlist — Markets Tab empty state + search CTA.",
  },
  "watchlist:3-items": {
    includeTransactions: false,
    baseline: null,
    watchlist: { assetIds: ["US:AAPL", "US:MSFT", "US:NVDA"] },
    description: "Watchlist with 3 US symbols + fresh fixture quotes.",
  },
  "watchlist:stale-quotes": {
    includeTransactions: false,
    baseline: null,
    watchlist: {
      assetIds: ["US:AAPL", "US:MSFT", "US:NVDA"],
      staleQuotes: true,
    },
    description: "Watchlist quotes older than 5 min — pull-to-refresh should fetch fresh.",
  },
};

/** UI-facing scenario buttons (subset with stable ids for i18n keys). */
export const DEV_SEED_UI_SCENARIOS: ReadonlyArray<{
  id: Scenario;
  i18nKey:
    | "default"
    | "happy"
    | "bigGain"
    | "bigLoss"
    | "mixedMovers"
    | "firstDay"
    | "empty"
    | "wlEmpty"
    | "wl3Items"
    | "wlStale";
}> = [
  { id: "default", i18nKey: "default" },
  { id: "daily-snapshot:big-gain", i18nKey: "bigGain" },
  { id: "daily-snapshot:big-loss", i18nKey: "bigLoss" },
  { id: "daily-snapshot:mixed-movers", i18nKey: "mixedMovers" },
  { id: "daily-snapshot:first-day", i18nKey: "firstDay" },
  { id: "daily-snapshot:empty", i18nKey: "empty" },
  { id: "watchlist:empty", i18nKey: "wlEmpty" },
  { id: "watchlist:3-items", i18nKey: "wl3Items" },
  { id: "watchlist:stale-quotes", i18nKey: "wlStale" },
] as const;

// ──────────────────────────────────────────────────────────────────────────
// Seed payload

export const SEED_ASSETS = [
  { id: "US:AAPL", market: "US", symbol: "AAPL", name: "Apple Inc.", currency: "USD" },
  {
    id: "US:MSFT",
    market: "US",
    symbol: "MSFT",
    name: "Microsoft Corporation",
    currency: "USD",
  },
  {
    id: "US:NVDA",
    market: "US",
    symbol: "NVDA",
    name: "NVIDIA Corporation",
    currency: "USD",
  },
] as const;

export interface SeedTx {
  asset_id: string;
  type: "BUY";
  shares: string;
  price_per_share: string;
  currency: "USD";
  fee: string;
  trade_date: string;
  notes: string | null;
}

const monthsAgo = (m: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() - m);
  return d.toISOString();
};

export const SEED_TRANSACTIONS: SeedTx[] = [
  {
    asset_id: "US:AAPL",
    type: "BUY",
    shares: "10",
    price_per_share: "189.50",
    currency: "USD",
    fee: "1.00",
    trade_date: monthsAgo(3),
    notes: "Initial position",
  },
  {
    asset_id: "US:MSFT",
    type: "BUY",
    shares: "5",
    price_per_share: "420.30",
    currency: "USD",
    fee: "1.00",
    trade_date: monthsAgo(2),
    notes: null,
  },
  {
    asset_id: "US:NVDA",
    type: "BUY",
    shares: "8",
    price_per_share: "875.00",
    currency: "USD",
    fee: "2.00",
    trade_date: monthsAgo(1),
    notes: "AI play",
  },
];

const SHARES_BY_SYMBOL: Record<"AAPL" | "MSFT" | "NVDA", string> = {
  AAPL: "10",
  MSFT: "5",
  NVDA: "8",
};

export class SeedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeedError";
  }
}

export interface RunSeedOptions {
  userId: string;
  scenario: Scenario;
  mode?: "reset" | "append";
}

export interface RunSeedResult {
  scenario: Scenario;
  portfolioId: string;
  expectedUi: string[];
}

type LogFn = (line: string) => void;

const noopLog: LogFn = () => {};

/**
 * Idempotent dev seed for one user. Requires service-role Supabase client.
 */
export const runSeedForUser = async (
  supabase: SupabaseClient,
  options: RunSeedOptions,
  log: LogFn = noopLog
): Promise<RunSeedResult> => {
  const { userId, scenario, mode = "reset" } = options;
  const plan = SCENARIO_PLANS[scenario];

  log(`scenario: ${scenario} — ${plan.description}`);

  const { error: assetErr } = await supabase
    .from("assets")
    .upsert(SEED_ASSETS as never, { onConflict: "id" });
  if (assetErr) throw new SeedError(`Asset upsert failed: ${assetErr.message}`);
  log(`✓ Assets ensured (${SEED_ASSETS.length})`);

  if (mode === "reset") {
    const { error: delWlErr } = await supabase
      .from("watchlist_items")
      .delete()
      .eq("user_id", userId);
    if (delWlErr) {
      const msg = delWlErr.message ?? "";
      if (/watchlist_items/i.test(msg) && /does not exist|schema cache/i.test(msg)) {
        throw new SeedError(
          "watchlist_items table missing — run packages/db/drizzle/migrations/0004_watchlist_items.sql on dev Supabase"
        );
      }
      throw new SeedError(`Watchlist delete failed: ${msg}`);
    }
    log(`✓ Cleared watchlist_items for this user`);

    const { error: delErr } = await supabase.from("portfolios").delete().eq("user_id", userId);
    if (delErr) throw new SeedError(`Portfolio delete failed: ${delErr.message}`);
    log(`✓ Cleared existing portfolios for this user`);
  }

  const { data: created, error: portErr } = await supabase
    .from("portfolios")
    .insert({
      user_id: userId,
      name: "My Portfolio",
      reporting_currency: "CNY",
    })
    .select("id")
    .single();
  if (portErr || !created) {
    throw new SeedError(`Portfolio insert failed: ${portErr?.message ?? "unknown"}`);
  }
  const portfolioId = created.id as string;
  log(`✓ Created portfolio "My Portfolio" (${portfolioId.slice(0, 8)}…)`);

  if (plan.includeTransactions) {
    const txRows = SEED_TRANSACTIONS.map((tx) => ({
      portfolio_id: portfolioId,
      ...tx,
    }));
    const { error: txErr } = await supabase.from("transactions").insert(txRows);
    if (txErr) throw new SeedError(`Transaction insert failed: ${txErr.message}`);
    log(`✓ Inserted ${txRows.length} transactions`);

    const asOf = new Date().toISOString();
    const priceRows = [
      { asset_id: "US:AAPL", as_of: asOf, price: "189.50", currency: "USD", source: "seed-dev" },
      { asset_id: "US:MSFT", as_of: asOf, price: "420.30", currency: "USD", source: "seed-dev" },
      { asset_id: "US:NVDA", as_of: asOf, price: "875.00", currency: "USD", source: "seed-dev" },
    ];
    const { error: priceErr } = await supabase
      .from("price_snapshots")
      .upsert(priceRows as never, { onConflict: "asset_id,as_of" });
    if (priceErr) throw new SeedError(`price_snapshots upsert failed: ${priceErr.message}`);
    log(`✓ Seeded price_snapshots`);

    const { error: fxErr } = await supabase.from("fx_rates").upsert(
      {
        from_currency: "USD",
        to_currency: "CNY",
        as_of: asOf,
        rate: "7.20",
        source: "seed-dev",
      } as never,
      { onConflict: "from_currency,to_currency,as_of" }
    );
    if (fxErr) throw new SeedError(`fx_rates upsert failed: ${fxErr.message}`);
    log(`✓ Seeded fx_rates`);
  } else {
    log(`↷ Skipped transactions (empty portfolio scenario)`);
  }

  if (plan.baseline) {
    const FX_USD_CNY = 7.2;
    const yesterdayAt23UTC = (() => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - 1);
      d.setUTCHours(23, 0, 0, 0);
      return d.toISOString();
    })();

    const perAssetSnapshot = (
      Object.keys(plan.baseline.prices) as Array<"AAPL" | "MSFT" | "NVDA">
    ).map((sym) => {
      const shares = SHARES_BY_SYMBOL[sym];
      const priceNative = plan.baseline!.prices[sym];
      const valueNative = Number(shares) * Number(priceNative);
      return {
        assetId: `US:${sym}`,
        shares,
        valueNative: valueNative.toFixed(2),
        currency: "USD",
        valueReporting: (valueNative * FX_USD_CNY).toFixed(2),
      };
    });

    const totalValueReporting = perAssetSnapshot
      .reduce((acc, a) => acc + Number(a.valueReporting), 0)
      .toFixed(2);

    const totalCostBasisReporting = SEED_TRANSACTIONS.reduce((acc, tx) => {
      return acc + Number(tx.shares) * Number(tx.price_per_share) * FX_USD_CNY;
    }, 0).toFixed(2);

    const { error: snapErr } = await supabase.from("portfolio_value_snapshots").upsert(
      {
        portfolio_id: portfolioId,
        as_of: yesterdayAt23UTC,
        total_value: totalValueReporting,
        total_cost_basis: totalCostBasisReporting,
        reporting_currency: "CNY",
        per_asset: perAssetSnapshot,
        source: "manual",
      } as never,
      { onConflict: "portfolio_id,as_of" }
    );
    if (snapErr) throw new SeedError(`portfolio_value_snapshots upsert failed: ${snapErr.message}`);
    log(`✓ Seeded yesterday's snapshot — ${plan.baseline.expectedDeltaSummary}`);
  } else {
    log(`↷ Skipped yesterday's snapshot`);
  }

  if (plan.watchlist) {
    if (mode === "reset") {
      // already cleared above
    } else {
      const { error: delWlErr } = await supabase
        .from("watchlist_items")
        .delete()
        .eq("user_id", userId);
      if (delWlErr) {
        const msg = delWlErr.message ?? "";
        if (/watchlist_items/i.test(msg) && /does not exist|schema cache/i.test(msg)) {
          throw new SeedError(
            "watchlist_items table missing — run packages/db/drizzle/migrations/0004_watchlist_items.sql on dev Supabase"
          );
        }
        throw new SeedError(`Watchlist delete failed: ${msg}`);
      }
    }

    const watchAssets = plan.watchlist.assetIds.map((id) => {
      const found = SEED_ASSETS.find((a) => a.id === id);
      if (!found) {
        throw new SeedError(`Unknown watchlist asset id: ${id}`);
      }
      return found;
    });

    if (watchAssets.length > 0) {
      const { error: wlAssetErr } = await supabase
        .from("assets")
        .upsert(watchAssets as never, { onConflict: "id" });
      if (wlAssetErr) throw new SeedError(`Watchlist asset upsert failed: ${wlAssetErr.message}`);

      const wlRows = watchAssets.map((a) => ({
        user_id: userId,
        asset_id: a.id,
      }));
      const { error: wlInsErr } = await supabase.from("watchlist_items").insert(wlRows);
      if (wlInsErr) throw new SeedError(`watchlist_items insert failed: ${wlInsErr.message}`);
      log(`✓ Seeded watchlist (${wlRows.length} items)`);

      const quoteAsOf = plan.watchlist.staleQuotes
        ? new Date(Date.now() - 10 * 60 * 1000).toISOString()
        : new Date().toISOString();

      const wlPrices: Record<string, string> = {
        "US:AAPL": "189.50",
        "US:MSFT": "420.30",
        "US:NVDA": "875.00",
      };

      const wlChangePercent: Record<string, string> = {
        "US:AAPL": "-0.42",
        "US:MSFT": "1.05",
        "US:NVDA": "3.21",
      };

      const priceRows = watchAssets.map((a) => ({
        asset_id: a.id,
        as_of: quoteAsOf,
        price: wlPrices[a.id] ?? "100.00",
        currency: "USD",
        source: "seed-dev",
        change_percent: wlChangePercent[a.id] ?? null,
      }));

      const { error: wlPriceErr } = await supabase
        .from("price_snapshots")
        .upsert(priceRows as never, { onConflict: "asset_id,as_of" });
      if (wlPriceErr) {
        throw new SeedError(`watchlist price_snapshots upsert failed: ${wlPriceErr.message}`);
      }
      log(
        plan.watchlist.staleQuotes
          ? `✓ Seeded stale watchlist quotes (as_of ~10 min ago)`
          : `✓ Seeded fresh watchlist quotes`
      );
    } else {
      log(`✓ Watchlist left empty`);
    }
  }

  const expectedUi = describeExpectedUi(scenario);
  return { scenario, portfolioId, expectedUi };
};

export const describeExpectedUi = (scenario: Scenario): string[] => {
  switch (scenario) {
    case "default":
      return [
        "Daily Snapshot card at top (≈ +2% gain vs yesterday's baseline)",
        "Total value below + 3 holdings with fast cached quotes",
      ];
    case "daily-snapshot:big-gain":
      return [
        "Daily Snapshot card with ≈ +10% gain — large green numbers + 3 green chips",
        "Total value below + 3 holdings",
      ];
    case "daily-snapshot:big-loss":
      return [
        "Daily Snapshot card with ≈ -5% loss — large red numbers + 3 red chips",
        "Total value below + 3 holdings",
      ];
    case "daily-snapshot:mixed-movers":
      return [
        "Daily Snapshot card with 3 mover chips: NVDA (+8%), MSFT (-3%), AAPL (+0.5%)",
        "Top-3 sorted by |%|; mixed red/green colors",
      ];
    case "daily-snapshot:first-day":
      return [
        "Daily Snapshot card with no-baseline placeholder copy",
        "Total value + holdings still visible below",
      ];
    case "daily-snapshot:empty":
      return [
        "Daily Snapshot card NOT rendered (no holdings to compare)",
        "Empty-state CTA shown instead",
      ];
    case "watchlist:empty":
      return ["Markets Tab empty state + primary search CTA"];
    case "watchlist:3-items":
      return [
        "Markets Tab shows AAPL / MSFT / NVDA with price + change% chips",
        "Toggle finance color mode in Settings to verify S2-AC-2.7",
      ];
    case "watchlist:stale-quotes":
      return [
        "Watchlist rows show stale dot (·) next to price",
        "Pull-to-refresh fetches fresh quotes (bypasses 5-min cache)",
      ];
  }
};
