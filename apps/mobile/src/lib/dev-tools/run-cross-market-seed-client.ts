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
  "default:crypto-only",
] as const satisfies readonly DevSeedScenarioId[];

export type CrossMarketScenarioId = (typeof CROSS_MARKET_SCENARIO_IDS)[number];

export const isCrossMarketScenario = (id: DevSeedScenarioId): id is CrossMarketScenarioId =>
  (CROSS_MARKET_SCENARIO_IDS as readonly string[]).includes(id);

const CROSS_MARKET_ASSETS = [
  { id: "CN:600519", market: "CN", symbol: "600519", name: "贵州茅台", currency: "CNY" },
  { id: "HK:00700", market: "HK", symbol: "00700", name: "腾讯控股", currency: "HKD" },
  { id: "FUND:000001", market: "FUND", symbol: "000001", name: "华夏成长", currency: "CNY" },
  { id: "FUND:510300", market: "FUND", symbol: "510300", name: "沪深300ETF", currency: "CNY" },
  { id: "CRYPTO:BTC", market: "CRYPTO", symbol: "BTC", name: "Bitcoin", currency: "USD" },
  { id: "CRYPTO:ETH", market: "CRYPTO", symbol: "ETH", name: "Ethereum", currency: "USD" },
  { id: "CRYPTO:USDC", market: "CRYPTO", symbol: "USDC", name: "USD Coin", currency: "USD" },
] as const;

type SeedTx = {
  asset_id: string;
  type: "BUY";
  shares: string;
  price_per_share: string;
  currency: "CNY" | "HKD" | "USD";
  fee: string;
  notes: string;
  trade_date?: string;
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

const daysAgoIso = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
};

const TX_CRYPTO_ONLY: SeedTx[] = [
  {
    asset_id: "CRYPTO:BTC",
    type: "BUY",
    shares: "0.5",
    price_per_share: "65000",
    currency: "USD",
    fee: "0",
    notes: "CRYPTO-only dev seed",
    trade_date: daysAgoIso(7),
  },
  {
    asset_id: "CRYPTO:ETH",
    type: "BUY",
    shares: "5",
    price_per_share: "3200",
    currency: "USD",
    fee: "0",
    notes: "CRYPTO-only dev seed",
    trade_date: daysAgoIso(14),
  },
  {
    asset_id: "CRYPTO:USDC",
    type: "BUY",
    shares: "1000",
    price_per_share: "1",
    currency: "USD",
    fee: "0",
    notes: "CRYPTO-only dev seed",
    trade_date: daysAgoIso(21),
  },
];

const TX_BY_SCENARIO: Record<CrossMarketScenarioId, SeedTx[]> = {
  "default:cn-only": TX_CN_ONLY,
  "default:hk-only": TX_HK_ONLY,
  "default:fund-only": TX_FUND_ONLY,
  "default:cross-market": TX_CROSS_MARKET,
  "default:crypto-only": TX_CRYPTO_ONLY,
};

const EXPECTED_UI: Record<CrossMarketScenarioId, string[]> = {
  "default:cn-only": [
    "Portfolio: 100× CN:600519 only",
    "Pull Portfolio to fetch live CNY via Tushare (EXPO_PUBLIC_TUSHARE_TOKEN)",
  ],
  "default:hk-only": ["Portfolio: 50× HK:00700 — live HKD via AKShare wrapper"],
  "default:fund-only": ["Portfolio: 1000× FUND:000001 — live NAV via AKShare wrapper"],
  "default:cross-market": ["Portfolio: CN + HK + FUND — verify each market quotes"],
  "default:crypto-only": [
    "Portfolio: 0.5× BTC + 5× ETH + 1000× USDC",
    "Pull Portfolio for live CoinGecko USD prices (no API key)",
  ],
};

const MIGRATION_0010_HINT =
  "请在 Supabase SQL Editor 执行 packages/db/drizzle/migrations/0010_assets_cn_hk_fund_stage3.sql（种子资产行 + CN/HK/FUND 的 RLS INSERT 策略）。";

const CRYPTO_ASSETS_BOOTSTRAP_HINT =
  "CRYPTO 资产行需 service_role 写入。请先运行一次：pnpm seed:crypto-only（或等 Block C migration 0012）。";

export class CrossMarketSeedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CrossMarketSeedError";
  }
}

const isAssetsRlsError = (message: string): boolean =>
  /row-level security|RLS/i.test(message) && /assets/i.test(message);

const isCryptoAssetId = (id: string): boolean => id.startsWith("CRYPTO:");

export const runCrossMarketSeedClient = async (
  scenario: CrossMarketScenarioId,
  userId: string
): Promise<{ portfolioId: string; expectedUi: string[] }> => {
  const txs = TX_BY_SCENARIO[scenario];
  const tradeDateDefault = new Date().toISOString();

  const assetIdsForScenario =
    scenario === "default:crypto-only"
      ? (["CRYPTO:BTC", "CRYPTO:ETH", "CRYPTO:USDC"] as const)
      : CROSS_MARKET_ASSETS.filter((a) => txs.some((tx) => tx.asset_id === a.id)).map((a) => a.id);

  const { error: delWlErr } = await supabase.from("watchlist_items").delete().eq("user_id", userId);
  if (delWlErr) throw new CrossMarketSeedError(`清空自选失败: ${delWlErr.message}`);

  const { error: delPortErr } = await supabase.from("portfolios").delete().eq("user_id", userId);
  if (delPortErr) throw new CrossMarketSeedError(`清空组合失败: ${delPortErr.message}`);

  const assetIds = [...assetIdsForScenario];
  const assetsToUpsert = CROSS_MARKET_ASSETS.filter((a) => assetIds.includes(a.id));
  const { data: existingAssets, error: loadErr } = await supabase
    .from("assets")
    .select("id")
    .in("id", assetIds);
  if (loadErr) throw new CrossMarketSeedError(`读取 assets 失败: ${loadErr.message}`);

  const existingIds = new Set((existingAssets ?? []).map((r) => r.id as string));
  const missingIds = assetIds.filter((id) => !existingIds.has(id));

  if (missingIds.length > 0) {
    const { error: assetErr } = await supabase
      .from("assets")
      .upsert(assetsToUpsert as never, { onConflict: "id", ignoreDuplicates: true });
    if (assetErr) {
      const msg = assetErr.message ?? "";
      if (isAssetsRlsError(msg)) {
        const cryptoMissing = missingIds.some(isCryptoAssetId);
        throw new CrossMarketSeedError(
          cryptoMissing
            ? `无法注册 CRYPTO 资产行：RLS 未放行 CRYPTO。\n${CRYPTO_ASSETS_BOOTSTRAP_HINT}`
            : `无法注册资产行（${missingIds.join(", ")}）：RLS 未放行 CN/HK/FUND。\n${MIGRATION_0010_HINT}`
        );
      }
      throw new CrossMarketSeedError(`写入 assets 失败: ${msg}`);
    }
  }

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
    trade_date: tx.trade_date ?? tradeDateDefault,
  }));
  const { error: txErr } = await supabase.from("transactions").insert(txRows);
  if (txErr) throw new CrossMarketSeedError(`写入 transactions 失败: ${txErr.message}`);

  return { portfolioId, expectedUi: EXPECTED_UI[scenario] };
};
