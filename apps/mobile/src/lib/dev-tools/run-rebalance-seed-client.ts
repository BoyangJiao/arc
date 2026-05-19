/**
 * Client-side rebalance seed — JWT path for DEV panel (no Edge deploy).
 */

import Decimal from "decimal.js";
import type { PriceQuote } from "@arc/core";

import { fxCache, getRegistry, priceCache } from "../market-data";
import { supabase } from "../supabase";
import {
  REBALANCE_FIXTURE_NVDA,
  REBALANCE_NVDA_HEAVY,
  REBALANCE_NVDA_MILD,
  REBALANCE_TARGETS_ALIGNED,
  REBALANCE_TARGETS_HEAVY,
  REBALANCE_TARGETS_MILD,
} from "./rebalance-seed-plans";
import type { RebalanceScenarioId } from "./scenarios";

const EQUITY_ASSETS = [
  { id: "US:AAPL", market: "US", symbol: "AAPL", name: "Apple Inc.", currency: "USD" },
  { id: "US:MSFT", market: "US", symbol: "MSFT", name: "Microsoft Corporation", currency: "USD" },
  { id: "US:NVDA", market: "US", symbol: "NVDA", name: "NVIDIA Corporation", currency: "USD" },
] as const;

const BASE_TX = [
  {
    asset_id: "US:AAPL",
    type: "BUY" as const,
    shares: "10",
    price_per_share: "189.50",
    currency: "USD" as const,
    fee: "1",
  },
  {
    asset_id: "US:MSFT",
    type: "BUY" as const,
    shares: "5",
    price_per_share: "420.30",
    currency: "USD" as const,
    fee: "1",
  },
  {
    asset_id: "US:NVDA",
    type: "BUY" as const,
    shares: "8",
    price_per_share: REBALANCE_FIXTURE_NVDA,
    currency: "USD" as const,
    fee: "2",
  },
  {
    asset_id: "CASH:USD",
    type: "BUY" as const,
    shares: "5000",
    price_per_share: "1",
    currency: "USD" as const,
    fee: "0",
  },
];

type RebalancePlan = {
  readonly targets: Readonly<Record<string, string>>;
  readonly nvdaPriceOverride?: string;
};

const PLANS: Record<RebalanceScenarioId, RebalancePlan> = {
  "rebalance:empty-target": { targets: {} },
  "rebalance:aligned": { targets: REBALANCE_TARGETS_ALIGNED },
  "rebalance:mild-drift": {
    targets: REBALANCE_TARGETS_MILD,
    nvdaPriceOverride: REBALANCE_NVDA_MILD,
  },
  "rebalance:heavy-drift": {
    targets: REBALANCE_TARGETS_HEAVY,
    nvdaPriceOverride: REBALANCE_NVDA_HEAVY,
  },
};

const SEED_SOURCE = "seed-dev";

const fetchLiveUsQuote = async (symbol: string): Promise<PriceQuote> => {
  const adapter = getRegistry().resolvePriceAdapter("US");
  return adapter.fetchLatest(symbol);
};

/** Warm device cache from Finnhub (+ optional NVDA skew for drift UAT). */
export const warmRebalanceMarketCache = async (nvdaPriceOverride?: string): Promise<void> => {
  const symbols = ["AAPL", "MSFT", "NVDA"] as const;

  for (const sym of symbols) {
    let quote = await fetchLiveUsQuote(sym);
    if (sym === "NVDA" && nvdaPriceOverride) {
      quote = {
        ...quote,
        price: new Decimal(nvdaPriceOverride),
        source: SEED_SOURCE,
      };
    }
    await priceCache.set(quote);
  }

  const cash = await getRegistry().resolvePriceAdapter("CASH").fetchLatest("USD");
  await priceCache.set(cash);

  const fx = await getRegistry().fxAdapter.fetchRate("USD", "CNY");
  await fxCache.set(fx);
};

export class RebalanceSeedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RebalanceSeedError";
  }
}

export const runRebalanceSeedClient = async (
  scenario: RebalanceScenarioId,
  userId: string
): Promise<string> => {
  const plan = PLANS[scenario];
  const tradeDate = new Date().toISOString();

  const { error: delPortErr } = await supabase.from("portfolios").delete().eq("user_id", userId);
  if (delPortErr) throw new RebalanceSeedError(`清空组合失败: ${delPortErr.message}`);

  const { error: assetErr } = await supabase
    .from("assets")
    .upsert(EQUITY_ASSETS as never, { onConflict: "id", ignoreDuplicates: true });
  if (assetErr) throw new RebalanceSeedError(`写入 assets 失败: ${assetErr.message}`);

  const { data: port, error: portErr } = await supabase
    .from("portfolios")
    .insert({ user_id: userId, name: "My Portfolio", reporting_currency: "CNY" })
    .select("id")
    .single();
  if (portErr || !port) {
    throw new RebalanceSeedError(`创建组合失败: ${portErr?.message ?? "unknown"}`);
  }
  const portfolioId = port.id as string;

  const txRows = BASE_TX.map((tx) => ({
    portfolio_id: portfolioId,
    ...tx,
    trade_date: tradeDate,
    notes: "rebalance-seed",
  }));
  const { error: txErr } = await supabase.from("transactions").insert(txRows);
  if (txErr) {
    const msg = txErr.message ?? "";
    if (/CASH:USD|assets/i.test(msg) && /foreign key|violates/i.test(msg)) {
      throw new RebalanceSeedError(
        "CASH:USD 资产不存在 — 请在 Supabase 执行 migration 0008_cash_assets_seed.sql"
      );
    }
    throw new RebalanceSeedError(`写入 transactions 失败: ${msg}`);
  }

  const targetEntries = Object.entries(plan.targets);
  if (targetEntries.length > 0) {
    const targetRows = targetEntries.map(([asset_id, target_percent]) => ({
      portfolio_id: portfolioId,
      asset_id,
      target_percent,
    }));
    const { error: tgtErr } = await supabase.from("target_allocations").insert(targetRows);
    if (tgtErr) {
      throw new RebalanceSeedError(
        `写入 target_allocations 失败: ${tgtErr.message} — 请确认 migration 0007 已执行`
      );
    }
  }

  const aapl = await fetchLiveUsQuote("AAPL");
  const msft = await fetchLiveUsQuote("MSFT");
  let nvda = await fetchLiveUsQuote("NVDA");
  if (plan.nvdaPriceOverride) {
    nvda = { ...nvda, price: new Decimal(plan.nvdaPriceOverride), source: SEED_SOURCE };
  }

  const asOf = new Date().toISOString();
  const priceRows = [
    {
      asset_id: "US:AAPL",
      as_of: asOf,
      price: aapl.price.toString(),
      currency: "USD",
      source: "finnhub",
    },
    {
      asset_id: "US:MSFT",
      as_of: asOf,
      price: msft.price.toString(),
      currency: "USD",
      source: "finnhub",
    },
    {
      asset_id: "US:NVDA",
      as_of: asOf,
      price: nvda.price.toString(),
      currency: "USD",
      source: plan.nvdaPriceOverride ? SEED_SOURCE : "finnhub",
    },
    { asset_id: "CASH:USD", as_of: asOf, price: "1", currency: "USD", source: SEED_SOURCE },
  ];
  const { error: priceErr } = await supabase
    .from("price_snapshots")
    .upsert(priceRows as never, { onConflict: "asset_id,as_of" });
  if (priceErr) throw new RebalanceSeedError(`写入 price_snapshots 失败: ${priceErr.message}`);

  const fx = await getRegistry().fxAdapter.fetchRate("USD", "CNY");
  await supabase.from("fx_rates").upsert(
    {
      from_currency: "USD",
      to_currency: "CNY",
      as_of: asOf,
      rate: fx.rate.toString(),
      source: fx.source,
    } as never,
    { onConflict: "from_currency,to_currency,as_of" }
  );

  await warmRebalanceMarketCache(plan.nvdaPriceOverride);

  return portfolioId;
};
