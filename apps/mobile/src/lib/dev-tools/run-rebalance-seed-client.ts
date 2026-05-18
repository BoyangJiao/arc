/**
 * Client-side rebalance seed — JWT path for DEV panel (no Edge deploy).
 */

import type { RebalanceScenarioId } from "./scenarios";
import { supabase } from "../supabase";

const CASH_ASSETS = [
  { id: "CASH:USD", market: "CASH", symbol: "USD", name: "美元现金", currency: "USD" },
  { id: "CASH:CNY", market: "CASH", symbol: "CNY", name: "人民币现金", currency: "CNY" },
  { id: "CASH:HKD", market: "CASH", symbol: "HKD", name: "港元现金", currency: "HKD" },
  { id: "CASH:JPY", market: "CASH", symbol: "JPY", name: "日元现金", currency: "JPY" },
] as const;

const EQUITY_ASSETS = [
  { id: "US:AAPL", market: "US", symbol: "AAPL", name: "Apple Inc.", currency: "USD" },
  { id: "US:MSFT", market: "US", symbol: "MSFT", name: "Microsoft Corporation", currency: "USD" },
  { id: "US:NVDA", market: "US", symbol: "NVDA", name: "NVIDIA Corporation", currency: "USD" },
] as const;

const BASE_PRICES = { AAPL: "189.50", MSFT: "420.30", NVDA: "875.00" } as const;

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
    price_per_share: "875.00",
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
  readonly nvdaPrice?: string;
};

const PLANS: Record<RebalanceScenarioId, RebalancePlan> = {
  "rebalance:empty-target": { targets: {} },
  "rebalance:aligned": {
    targets: { "US:AAPL": "12", "US:MSFT": "13", "US:NVDA": "44", "CASH:USD": "31" },
  },
  "rebalance:mild-drift": {
    targets: { "US:AAPL": "12", "US:MSFT": "13", "US:NVDA": "44", "CASH:USD": "31" },
    nvdaPrice: "962.50",
  },
  "rebalance:heavy-drift": {
    targets: { "US:AAPL": "12", "US:MSFT": "13", "US:NVDA": "44", "CASH:USD": "31" },
    nvdaPrice: "1181.25",
  },
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

  const allAssets = [...EQUITY_ASSETS, ...CASH_ASSETS];
  const { error: assetErr } = await supabase
    .from("assets")
    .upsert(allAssets as never, { onConflict: "id", ignoreDuplicates: true });
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
  if (txErr) throw new RebalanceSeedError(`写入 transactions 失败: ${txErr.message}`);

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

  const asOf = new Date().toISOString();
  const nvdaPrice = plan.nvdaPrice ?? BASE_PRICES.NVDA;
  const priceRows = [
    {
      asset_id: "US:AAPL",
      as_of: asOf,
      price: BASE_PRICES.AAPL,
      currency: "USD",
      source: "seed-dev",
    },
    {
      asset_id: "US:MSFT",
      as_of: asOf,
      price: BASE_PRICES.MSFT,
      currency: "USD",
      source: "seed-dev",
    },
    { asset_id: "US:NVDA", as_of: asOf, price: nvdaPrice, currency: "USD", source: "seed-dev" },
    { asset_id: "CASH:USD", as_of: asOf, price: "1", currency: "USD", source: "seed-dev" },
  ];
  const { error: priceErr } = await supabase
    .from("price_snapshots")
    .upsert(priceRows as never, { onConflict: "asset_id,as_of" });
  if (priceErr) throw new RebalanceSeedError(`写入 price_snapshots 失败: ${priceErr.message}`);

  await supabase.from("fx_rates").upsert(
    {
      from_currency: "USD",
      to_currency: "CNY",
      as_of: asOf,
      rate: "7.20",
      source: "seed-dev",
    } as never,
    { onConflict: "from_currency,to_currency,as_of" }
  );

  return portfolioId;
};
