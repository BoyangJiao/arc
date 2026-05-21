/**
 * Client-side portfolios Block B seed — JWT path (no Edge deploy).
 *
 * Mirrors supabase/functions/_shared/seed-core.ts runPortfoliosBlockBSeed.
 */

import { supabase } from "../supabase";
import type { PortfolioScenarioId } from "./scenarios";

const SEED_ASSETS = [
  { id: "US:AAPL", market: "US", symbol: "AAPL", name: "Apple Inc.", currency: "USD" },
  { id: "US:MSFT", market: "US", symbol: "MSFT", name: "Microsoft Corporation", currency: "USD" },
  { id: "US:NVDA", market: "US", symbol: "NVDA", name: "NVIDIA Corporation", currency: "USD" },
  { id: "CN:600519", market: "CN", symbol: "600519", name: "贵州茅台", currency: "CNY" },
  { id: "HK:00700", market: "HK", symbol: "00700", name: "腾讯控股", currency: "HKD" },
  { id: "FUND:000001", market: "FUND", symbol: "000001", name: "华夏成长", currency: "CNY" },
  { id: "FUND:510300", market: "FUND", symbol: "510300", name: "沪深300ETF", currency: "CNY" },
] as const;

const monthsAgo = (m: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() - m);
  return d.toISOString();
};

const yesterdayAt23Utc = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  d.setUTCHours(23, 0, 0, 0);
  return d.toISOString();
};

const MIGRATION_0010_HINT =
  "0010 若报 policy 已存在可忽略（说明已应用）。否则执行 packages/db/drizzle/migrations/0010_assets_cn_hk_fund_stage3.sql。";

const MIGRATION_0012_HINT =
  "请在 Supabase SQL Editor 执行 packages/db/drizzle/migrations/0012_portfolio_value_snapshots_user_insert_manual.sql（Dev 多组合种子写入每日快照基线）。";

const isAssetsRlsError = (message: string): boolean =>
  /row-level security|RLS/i.test(message) && /assets/i.test(message);

const isSnapshotsRlsError = (message: string): boolean =>
  /row-level security|RLS/i.test(message) && /portfolio_value_snapshots/i.test(message);

/** Per-portfolio baseline snapshots — B.11; requires migration 0012 on dev Supabase. */
const seedPortfolioSnapshots = async (
  rows: ReadonlyArray<{
    portfolioId: string;
    reportingCurrency: "CNY" | "USD";
    totalValue: string;
    perAsset: ReadonlyArray<{
      assetId: string;
      shares: string;
      valueNative: string;
      currency: "CNY" | "USD";
      valueReporting: string;
    }>;
  }>
): Promise<void> => {
  if (rows.length === 0) return;

  const asOf = yesterdayAt23Utc();
  const payload = rows.map((row) => ({
    portfolio_id: row.portfolioId,
    as_of: asOf,
    total_value: row.totalValue,
    total_cost_basis: row.totalValue,
    reporting_currency: row.reportingCurrency,
    per_asset: row.perAsset,
    source: "manual" as const,
  }));

  const { error } = await supabase
    .from("portfolio_value_snapshots")
    .upsert(payload as never, { onConflict: "portfolio_id,as_of", ignoreDuplicates: true });

  if (error) {
    const msg = error.message ?? "";
    if (isSnapshotsRlsError(msg)) {
      throw new PortfoliosSeedError(`快照写入失败（RLS）。\n${MIGRATION_0012_HINT}`);
    }
    throw new PortfoliosSeedError(`快照写入失败: ${msg}`);
  }
};

export class PortfoliosSeedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PortfoliosSeedError";
  }
}

/** Insert only missing catalog rows — never UPDATE (assets has no authenticated UPDATE policy). */
const ensureSeedAssets = async (
  rows: ReadonlyArray<{
    id: string;
    market: string;
    symbol: string;
    name: string;
    currency: string;
  }>
): Promise<void> => {
  const assetIds = rows.map((a) => a.id);
  const { data: existingAssets, error: loadErr } = await supabase
    .from("assets")
    .select("id")
    .in("id", assetIds);
  if (loadErr) throw new PortfoliosSeedError(`读取 assets 失败: ${loadErr.message}`);

  const existingIds = new Set((existingAssets ?? []).map((r) => r.id as string));
  const missing = rows.filter((a) => !existingIds.has(a.id));
  if (missing.length === 0) return;

  const { error: assetErr } = await supabase
    .from("assets")
    .upsert(missing as never, { onConflict: "id", ignoreDuplicates: true });
  if (assetErr) {
    const msg = assetErr.message ?? "";
    if (isAssetsRlsError(msg)) {
      throw new PortfoliosSeedError(
        `无法注册资产行（${missing.map((a) => a.id).join(", ")}）：RLS 未放行。\n${MIGRATION_0010_HINT}`
      );
    }
    throw new PortfoliosSeedError(`写入 assets 失败: ${msg}`);
  }
};

export const runPortfoliosSeedClient = async (
  scenario: PortfolioScenarioId,
  userId: string
): Promise<{ portfolioId: string; expectedUi: string[] }> => {
  const { error: delErr } = await supabase.from("portfolios").delete().eq("user_id", userId);
  if (delErr) throw new PortfoliosSeedError(`清空组合失败: ${delErr.message}`);

  const cashAssets = [
    { id: "CASH:USD", market: "CASH", symbol: "USD", name: "USD", currency: "USD" },
    { id: "CASH:CNY", market: "CASH", symbol: "CNY", name: "CNY", currency: "CNY" },
  ];
  await ensureSeedAssets([...SEED_ASSETS, ...cashAssets]);

  const portfolioDefs =
    scenario === "portfolios:single"
      ? [{ name: "My Portfolio", reporting_currency: "CNY" as const }]
      : [
          { name: "My Portfolio", reporting_currency: "CNY" as const },
          { name: "加密钱包", reporting_currency: "USD" as const },
          { name: "401k", reporting_currency: "USD" as const },
        ];

  const createdIds: string[] = [];
  for (const def of portfolioDefs) {
    const { data, error } = await supabase
      .from("portfolios")
      .insert({ user_id: userId, name: def.name, reporting_currency: def.reporting_currency })
      .select("id")
      .single();
    if (error || !data) throw new PortfoliosSeedError(`创建组合失败: ${error?.message}`);
    createdIds.push(data.id as string);
  }

  const [p1, p2, p3] = createdIds;
  const iso = monthsAgo(0);

  if (p1) {
    await supabase.from("transactions").insert([
      {
        portfolio_id: p1,
        asset_id: "CN:600519",
        type: "BUY",
        shares: "10",
        price_per_share: "1688",
        currency: "CNY",
        fee: "0",
        trade_date: monthsAgo(2),
        notes: "portfolios:multi-3",
      },
      {
        portfolio_id: p1,
        asset_id: "CASH:CNY",
        type: "BUY",
        shares: "12000",
        price_per_share: "1",
        currency: "CNY",
        fee: "0",
        trade_date: iso,
        notes: "portfolios:multi-3",
      },
    ]);
    await supabase.from("target_allocations").delete().eq("portfolio_id", p1);
    await supabase.from("target_allocations").insert([
      { portfolio_id: p1, asset_id: "CN:600519", target_percent: "40" },
      { portfolio_id: p1, asset_id: "CASH:CNY", target_percent: "60" },
    ]);
  }

  if (p2 && scenario !== "portfolios:single") {
    await supabase.from("transactions").insert([
      {
        portfolio_id: p2,
        asset_id: "US:NVDA",
        type: "BUY",
        shares: "5",
        price_per_share: "875",
        currency: "USD",
        fee: "0",
        trade_date: monthsAgo(1),
        notes: "portfolios:multi-3",
      },
      {
        portfolio_id: p2,
        asset_id: "CASH:USD",
        type: "BUY",
        shares: "3000",
        price_per_share: "1",
        currency: "USD",
        fee: "0",
        trade_date: iso,
        notes: "portfolios:multi-3",
      },
    ]);
    await supabase.from("target_allocations").delete().eq("portfolio_id", p2);
    await supabase.from("target_allocations").insert([
      { portfolio_id: p2, asset_id: "US:NVDA", target_percent: "70" },
      { portfolio_id: p2, asset_id: "CASH:USD", target_percent: "30" },
    ]);
  }

  if (p3 && scenario !== "portfolios:single") {
    await supabase.from("transactions").insert([
      {
        portfolio_id: p3,
        asset_id: "US:AAPL",
        type: "BUY",
        shares: "20",
        price_per_share: "189.5",
        currency: "USD",
        fee: "0",
        trade_date: monthsAgo(3),
        notes: "portfolios:multi-3",
      },
      {
        portfolio_id: p3,
        asset_id: "US:MSFT",
        type: "BUY",
        shares: "8",
        price_per_share: "420.3",
        currency: "USD",
        fee: "0",
        trade_date: monthsAgo(2),
        notes: "portfolios:multi-3",
      },
      {
        portfolio_id: p3,
        asset_id: "CASH:USD",
        type: "BUY",
        shares: "8000",
        price_per_share: "1",
        currency: "USD",
        fee: "0",
        trade_date: iso,
        notes: "portfolios:multi-3",
      },
    ]);
    await supabase.from("target_allocations").delete().eq("portfolio_id", p3);
    await supabase.from("target_allocations").insert([
      { portfolio_id: p3, asset_id: "US:AAPL", target_percent: "35" },
      { portfolio_id: p3, asset_id: "US:MSFT", target_percent: "25" },
      { portfolio_id: p3, asset_id: "CASH:USD", target_percent: "40" },
    ]);
  }

  if (scenario === "portfolios:transfer-history" && p1 && p2) {
    await supabase.from("transactions").insert([
      {
        portfolio_id: p1,
        asset_id: "CASH:USD",
        type: "BUY",
        shares: "2000",
        price_per_share: "1",
        currency: "USD",
        fee: "0",
        trade_date: monthsAgo(1),
        notes: "portfolios:multi-3",
      },
      {
        portfolio_id: p1,
        asset_id: "CASH:USD",
        type: "SELL",
        shares: "500",
        price_per_share: "1",
        currency: "USD",
        fee: "0",
        trade_date: iso,
        notes: `transfer-out-to-${p2}`,
      },
      {
        portfolio_id: p2,
        asset_id: "CASH:USD",
        type: "BUY",
        shares: "500",
        price_per_share: "1",
        currency: "USD",
        fee: "0",
        trade_date: iso,
        notes: `transfer-in-from-${p1}`,
      },
    ]);
  }

  const snapshotRows: Array<{
    portfolioId: string;
    reportingCurrency: "CNY" | "USD";
    totalValue: string;
    perAsset: ReadonlyArray<{
      assetId: string;
      shares: string;
      valueNative: string;
      currency: "CNY" | "USD";
      valueReporting: string;
    }>;
  }> = [];
  if (p1) {
    snapshotRows.push({
      portfolioId: p1,
      reportingCurrency: "CNY",
      totalValue: "50000.00",
      perAsset: [
        {
          assetId: "CN:600519",
          shares: "10",
          valueNative: "15000.00",
          currency: "CNY",
          valueReporting: "15000.00",
        },
        {
          assetId: "CASH:CNY",
          shares: "12000",
          valueNative: "12000.00",
          currency: "CNY",
          valueReporting: "12000.00",
        },
      ],
    });
  }
  if (p2 && scenario !== "portfolios:single") {
    snapshotRows.push({
      portfolioId: p2,
      reportingCurrency: "USD",
      totalValue: "12000.00",
      perAsset: [
        {
          assetId: "US:NVDA",
          shares: "5",
          valueNative: "4000.00",
          currency: "USD",
          valueReporting: "4000.00",
        },
        {
          assetId: "CASH:USD",
          shares: "3000",
          valueNative: "3000.00",
          currency: "USD",
          valueReporting: "3000.00",
        },
      ],
    });
  }
  if (p3 && scenario !== "portfolios:single") {
    snapshotRows.push({
      portfolioId: p3,
      reportingCurrency: "USD",
      totalValue: "28000.00",
      perAsset: [
        {
          assetId: "US:AAPL",
          shares: "20",
          valueNative: "10000.00",
          currency: "USD",
          valueReporting: "10000.00",
        },
        {
          assetId: "US:MSFT",
          shares: "8",
          valueNative: "8000.00",
          currency: "USD",
          valueReporting: "8000.00",
        },
        {
          assetId: "CASH:USD",
          shares: "8000",
          valueNative: "8000.00",
          currency: "USD",
          valueReporting: "8000.00",
        },
      ],
    });
  }
  if (snapshotRows.length > 0) {
    await seedPortfolioSnapshots(snapshotRows);
  }

  const expectedUi =
    scenario === "portfolios:single"
      ? ["单组合", "Portfolio Tab 无 ▼"]
      : scenario === "portfolios:transfer-history"
        ? ["三组合", "含转账 notes", "Insights 三卡"]
        : ["三组合", "Switcher ▼", "Insights 三卡"];

  return { portfolioId: p1 ?? createdIds[0]!, expectedUi };
};
