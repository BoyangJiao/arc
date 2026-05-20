/**
 * Client-side CN/HK/FUND portfolio seed — JWT path (no Edge deploy).
 *
 * Mirrors supabase/functions/_shared/seed-core.ts cross-market scenarios;
 * skips price_snapshots so Portfolio pull fetches live Tushare / AKShare quotes.
 */

import { supabase } from "../supabase";
import type { DevSeedScenarioId } from "./scenarios";

export const CROSS_MARKET_SCENARIO_IDS = [
  "default:cn-only",
  "default:hk-only",
  "default:fund-only",
  "default:cross-market",
] as const satisfies readonly DevSeedScenarioId[];

export type CrossMarketScenarioId = (typeof CROSS_MARKET_SCENARIO_IDS)[number];

export const isCrossMarketScenario = (id: DevSeedScenarioId): id is CrossMarketScenarioId =>
  (CROSS_MARKET_SCENARIO_IDS as readonly string[]).includes(id);

const CROSS_MARKET_ASSETS = [
  { id: "CN:600519", market: "CN", symbol: "600519", name: "贵州茅台", currency: "CNY" },
  { id: "HK:00700", market: "HK", symbol: "00700", name: "腾讯控股", currency: "HKD" },
  { id: "FUND:000001", market: "FUND", symbol: "000001", name: "华夏成长", currency: "CNY" },
  { id: "FUND:510300", market: "FUND", symbol: "510300", name: "沪深300ETF", currency: "CNY" },
] as const;

type SeedTx = {
  asset_id: string;
  type: "BUY";
  shares: string;
  price_per_share: string;
  currency: "CNY" | "HKD";
  fee: string;
  notes: string;
};

const TX_CN_ONLY: SeedTx[] = [
  {
    asset_id: "CN:600519",
    type: "BUY",
    shares: "100",
    price_per_share: "1688.00",
    currency: "CNY",
    fee: "0",
    notes: "CN-only dev seed",
  },
];

const TX_HK_ONLY: SeedTx[] = [
  {
    asset_id: "HK:00700",
    type: "BUY",
    shares: "50",
    price_per_share: "380.00",
    currency: "HKD",
    fee: "0",
    notes: "HK-only dev seed",
  },
];

const TX_FUND_ONLY: SeedTx[] = [
  {
    asset_id: "FUND:000001",
    type: "BUY",
    shares: "1000",
    price_per_share: "1.20",
    currency: "CNY",
    fee: "0",
    notes: "FUND open-end dev seed",
  },
];

const TX_CROSS_MARKET: SeedTx[] = [
  ...TX_CN_ONLY,
  ...TX_HK_ONLY,
  ...TX_FUND_ONLY,
  {
    asset_id: "FUND:510300",
    type: "BUY",
    shares: "500",
    price_per_share: "4.50",
    currency: "CNY",
    fee: "0",
    notes: "FUND ETF dev seed",
  },
];

const TX_BY_SCENARIO: Record<CrossMarketScenarioId, SeedTx[]> = {
  "default:cn-only": TX_CN_ONLY,
  "default:hk-only": TX_HK_ONLY,
  "default:fund-only": TX_FUND_ONLY,
  "default:cross-market": TX_CROSS_MARKET,
};

const EXPECTED_UI: Record<CrossMarketScenarioId, string[]> = {
  "default:cn-only": [
    "Portfolio: 100× CN:600519 only",
    "Pull Portfolio to fetch live CNY via Tushare (EXPO_PUBLIC_TUSHARE_TOKEN)",
  ],
  "default:hk-only": ["Portfolio: 50× HK:00700 — live HKD via AKShare wrapper"],
  "default:fund-only": ["Portfolio: 1000× FUND:000001 — live NAV via AKShare wrapper"],
  "default:cross-market": ["Portfolio: CN + HK + FUND — verify each market quotes"],
};

export class CrossMarketSeedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CrossMarketSeedError";
  }
}

export const runCrossMarketSeedClient = async (
  scenario: CrossMarketScenarioId,
  userId: string
): Promise<{ portfolioId: string; expectedUi: string[] }> => {
  const txs = TX_BY_SCENARIO[scenario];
  const tradeDate = new Date().toISOString();

  const { error: delWlErr } = await supabase.from("watchlist_items").delete().eq("user_id", userId);
  if (delWlErr) throw new CrossMarketSeedError(`清空自选失败: ${delWlErr.message}`);

  const { error: delPortErr } = await supabase.from("portfolios").delete().eq("user_id", userId);
  if (delPortErr) throw new CrossMarketSeedError(`清空组合失败: ${delPortErr.message}`);

  const { error: assetErr } = await supabase
    .from("assets")
    .upsert(CROSS_MARKET_ASSETS as never, { onConflict: "id", ignoreDuplicates: true });
  if (assetErr) throw new CrossMarketSeedError(`写入 assets 失败: ${assetErr.message}`);

  const { data: port, error: portErr } = await supabase
    .from("portfolios")
    .insert({ user_id: userId, name: "My Portfolio", reporting_currency: "CNY" })
    .select("id")
    .single();
  if (portErr || !port) {
    throw new CrossMarketSeedError(`创建组合失败: ${portErr?.message ?? "unknown"}`);
  }
  const portfolioId = port.id as string;

  const txRows = txs.map((tx) => ({
    portfolio_id: portfolioId,
    ...tx,
    trade_date: tradeDate,
  }));
  const { error: txErr } = await supabase.from("transactions").insert(txRows);
  if (txErr) throw new CrossMarketSeedError(`写入 transactions 失败: ${txErr.message}`);

  return { portfolioId, expectedUi: EXPECTED_UI[scenario] };
};
