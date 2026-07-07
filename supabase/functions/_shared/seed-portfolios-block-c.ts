/**
 * Block C portfolio seeds — shared by CLI (service role) and mobile DEV FAB (JWT).
 *
 * Snapshot design (Portfolio Tab UAT):
 * - per_asset on every snapshot point (required for holdings period change)
 * - Daily EOD snapshots (30d for multi-market; 730d for history scenario) for area-chart UAT
 * - US:MSFT bought 3d ago → 「新建仓」 when baseline is older than 3d
 * - Other assets use varied 30d scale factors → mixed gain/loss badges
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export class PortfoliosBlockCSeedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PortfoliosBlockCSeedError";
  }
}

export type PortfoliosBlockCScenario =
  | "portfolios:multi-market-full"
  | "portfolios:30-days-history";

const SEED_ASSETS = [
  { id: "US:AAPL", market: "US", symbol: "AAPL", name: "Apple Inc.", currency: "USD" },
  { id: "US:MSFT", market: "US", symbol: "MSFT", name: "Microsoft Corporation", currency: "USD" },
  { id: "US:NVDA", market: "US", symbol: "NVDA", name: "NVIDIA Corporation", currency: "USD" },
  { id: "CN:600519", market: "CN", symbol: "600519", name: "贵州茅台", currency: "CNY" },
  { id: "CN:000001", market: "CN", symbol: "000001", name: "平安银行", currency: "CNY" },
  { id: "HK:00700", market: "HK", symbol: "00700", name: "腾讯控股", currency: "HKD" },
  { id: "FUND:000001", market: "FUND", symbol: "000001", name: "华夏成长", currency: "CNY" },
  { id: "FUND:510300", market: "FUND", symbol: "510300", name: "沪深300ETF", currency: "CNY" },
  { id: "CRYPTO:BTC", market: "CRYPTO", symbol: "BTC", name: "Bitcoin", currency: "USD" },
  { id: "CRYPTO:ETH", market: "CRYPTO", symbol: "ETH", name: "Ethereum", currency: "USD" },
] as const;

/** Dev seed FX — reporting currency is CNY for Block C portfolio. */
const USD_TO_CNY = 7.2;
const HKD_TO_CNY = 0.92;

type SeedCurrency = "CNY" | "USD" | "HKD";

interface SeedPosition {
  readonly assetId: string;
  readonly shares: string;
  /** Native currency market value at scale 1.0 (approximate). */
  readonly valueNativeAtPar: number;
  readonly currency: SeedCurrency;
}

/** Core holdings at "current" mark — used to synthesize per_asset snapshots. */
const CORE_POSITIONS: readonly SeedPosition[] = [
  { assetId: "US:AAPL", shares: "10", valueNativeAtPar: 2200, currency: "USD" },
  { assetId: "US:NVDA", shares: "5", valueNativeAtPar: 4500, currency: "USD" },
  { assetId: "CN:600519", shares: "100", valueNativeAtPar: 168_000, currency: "CNY" },
  { assetId: "CN:000001", shares: "1000", valueNativeAtPar: 12_000, currency: "CNY" },
  { assetId: "HK:00700", shares: "200", valueNativeAtPar: 80_000, currency: "HKD" },
  { assetId: "FUND:510300", shares: "5000", valueNativeAtPar: 22_500, currency: "CNY" },
  { assetId: "CRYPTO:BTC", shares: "0.25", valueNativeAtPar: 17_500, currency: "USD" },
  { assetId: "CRYPTO:ETH", shares: "2", valueNativeAtPar: 7000, currency: "USD" },
  { assetId: "CASH:CNY", shares: "5000", valueNativeAtPar: 5000, currency: "CNY" },
  { assetId: "CASH:USD", shares: "1000", valueNativeAtPar: 1000, currency: "USD" },
] as const;

/** MSFT — bought 3 days ago; absent from baselines ≥7d → 「新建仓」 on 1M/1W. */
const MSFT_POSITION: SeedPosition = {
  assetId: "US:MSFT",
  shares: "8",
  valueNativeAtPar: 3360,
  currency: "USD",
};

/**
 * Target scale vs current at ~30d baseline (implies period % when live quotes are flat).
 * Keys omitted → 1.0 at anchor day.
 */
const SCALE_AT_30D: Readonly<Record<string, number>> = {
  "US:AAPL": 0.82,
  "US:NVDA": 0.78,
  "CN:600519": 0.95,
  "CN:000001": 1.08,
  "HK:00700": 0.9,
  "FUND:510300": 0.93,
  "CRYPTO:BTC": 0.86,
  "CRYPTO:ETH": 0.8,
  "CASH:CNY": 1,
  "CASH:USD": 1,
};

const MSFT_INTRODUCED_DAYS_AGO = 3;

/** Daily EOD rows for multi-market-full (C9 1M chart). */
const SNAPSHOT_DAILY_DAYS = 30;
/** Full history for 30-days-history scenario (1Y range UAT). */
const SNAPSHOT_HISTORY_DAYS = 730;

const SNAPSHOT_UPSERT_BATCH = 100;

const monthsAgo = (m: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() - m);
  return d.toISOString();
};

const daysAgoIso = (daysAgo: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString();
};

const dayAt23Utc = (daysAgo: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(23, 0, 0, 0);
  return d.toISOString();
};

const MIGRATION_0010_HINT =
  "0010 若报 policy 已存在可忽略。否则执行 packages/db/drizzle/migrations/0010_assets_cn_hk_fund_stage3.sql。";

const MIGRATION_0012_HINT =
  "请在 Supabase SQL Editor 执行 packages/db/drizzle/migrations/0012_portfolio_value_snapshots_user_insert_manual.sql。";

const isAssetsRlsError = (message: string): boolean =>
  /row-level security|RLS/i.test(message) && /assets/i.test(message);

const isSnapshotsRlsError = (message: string): boolean =>
  /row-level security|RLS/i.test(message) && /portfolio_value_snapshots/i.test(message);

const toReporting = (native: number, currency: SeedCurrency): number => {
  if (currency === "USD") return native * USD_TO_CNY;
  if (currency === "HKD") return native * HKD_TO_CNY;
  return native;
};

const buildPerAssetRows = (
  positions: readonly SeedPosition[],
  scale: number
): Array<{
  assetId: string;
  shares: string;
  valueNative: string;
  currency: SeedCurrency;
  valueReporting: string;
}> => {
  const rows = [];
  for (const p of positions) {
    const valueNative = p.valueNativeAtPar * scale;
    const valueReporting = toReporting(valueNative, p.currency);
    rows.push({
      assetId: p.assetId,
      shares: p.shares,
      valueNative: valueNative.toFixed(2),
      currency: p.currency,
      valueReporting: valueReporting.toFixed(2),
    });
  }
  return rows;
};

const sumReporting = (rows: ReadonlyArray<{ valueReporting: string }>): string => {
  let total = 0;
  for (const r of rows) {
    total += Number(r.valueReporting);
  }
  return total.toFixed(2);
};

const ensureSeedAssets = async (
  supabase: SupabaseClient,
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
  if (loadErr) throw new PortfoliosBlockCSeedError(`读取 assets 失败: ${loadErr.message}`);

  const existingIds = new Set((existingAssets ?? []).map((r) => r.id as string));
  const missing = rows.filter((a) => !existingIds.has(a.id));
  if (missing.length === 0) return;

  const { error: assetErr } = await supabase
    .from("assets")
    .upsert(missing as never, { onConflict: "id", ignoreDuplicates: true });
  if (assetErr) {
    const msg = assetErr.message ?? "";
    if (isAssetsRlsError(msg)) {
      throw new PortfoliosBlockCSeedError(
        `无法注册资产行（${missing.map((a) => a.id).join(", ")}）：RLS 未放行。\n${MIGRATION_0010_HINT}`
      );
    }
    throw new PortfoliosBlockCSeedError(`写入 assets 失败: ${msg}`);
  }
};

const upsertPortfolioSnapshots = async (
  supabase: SupabaseClient,
  portfolioId: string,
  snapshots: ReadonlyArray<{
    asOf: string;
    perAsset: ReadonlyArray<{
      assetId: string;
      shares: string;
      valueNative: string;
      currency: SeedCurrency;
      valueReporting: string;
    }>;
  }>
): Promise<void> => {
  if (snapshots.length === 0) return;

  const payload = snapshots.map((snap) => ({
    portfolio_id: portfolioId,
    as_of: snap.asOf,
    total_value: sumReporting(snap.perAsset),
    total_cost_basis: sumReporting(snap.perAsset),
    reporting_currency: "CNY" as const,
    per_asset: snap.perAsset,
    source: "manual" as const,
  }));

  for (let offset = 0; offset < payload.length; offset += SNAPSHOT_UPSERT_BATCH) {
    const batch = payload.slice(offset, offset + SNAPSHOT_UPSERT_BATCH);
    const { error } = await supabase
      .from("portfolio_value_snapshots")
      .upsert(batch as never, { onConflict: "portfolio_id,as_of", ignoreDuplicates: true });

    if (error) {
      const msg = error.message ?? "";
      if (isSnapshotsRlsError(msg)) {
        throw new PortfoliosBlockCSeedError(`快照写入失败（RLS）。\n${MIGRATION_0012_HINT}`);
      }
      throw new PortfoliosBlockCSeedError(`快照写入失败: ${msg}`);
    }
  }
};

const seedBlockCDailySnapshots = async (
  supabase: SupabaseClient,
  portfolioId: string,
  days: number
): Promise<void> => {
  const payload: Array<{
    asOf: string;
    perAsset: ReturnType<typeof buildPerAssetRows>;
  }> = [];

  for (let daysAgo = days - 1; daysAgo >= 0; daysAgo -= 1) {
    const progress = (days - daysAgo) / days;
    const globalScale = 0.55 + 0.45 * progress;

    const positions = [...CORE_POSITIONS];
    if (daysAgo <= MSFT_INTRODUCED_DAYS_AGO) {
      positions.push(MSFT_POSITION);
    }

    const perAsset = positions.map((pos) => {
      const anchor30 = SCALE_AT_30D[pos.assetId] ?? 1;
      const scale = daysAgo >= 30 ? anchor30 + (1 - anchor30) * progress : globalScale;
      const valueNative = pos.valueNativeAtPar * scale;
      const valueReporting = toReporting(valueNative, pos.currency);
      return {
        assetId: pos.assetId,
        shares: pos.shares,
        valueNative: valueNative.toFixed(2),
        currency: pos.currency,
        valueReporting: valueReporting.toFixed(2),
      };
    });

    payload.push({ asOf: dayAt23Utc(daysAgo), perAsset });
  }

  // Intraday point so 1D range has a baseline when run before 23:00 UTC
  payload.push({
    asOf: new Date().toISOString(),
    perAsset: buildPerAssetRows([...CORE_POSITIONS, MSFT_POSITION], 1),
  });

  await upsertPortfolioSnapshots(supabase, portfolioId, payload);
};

const runMultiMarketFullSeed = async (
  supabase: SupabaseClient,
  userId: string,
  snapshotDays: number = SNAPSHOT_DAILY_DAYS
): Promise<{ portfolioId: string; expectedUi: string[] }> => {
  const { error: delErr } = await supabase.from("portfolios").delete().eq("user_id", userId);
  if (delErr) throw new PortfoliosBlockCSeedError(`清空组合失败: ${delErr.message}`);

  const cashAssets = [
    { id: "CASH:USD", market: "CASH", symbol: "USD", name: "USD", currency: "USD" },
    { id: "CASH:CNY", market: "CASH", symbol: "CNY", name: "CNY", currency: "CNY" },
  ];
  await ensureSeedAssets(supabase, [...SEED_ASSETS, ...cashAssets]);

  const { data, error } = await supabase
    .from("portfolios")
    .insert({ user_id: userId, name: "Block C 多市场", reporting_currency: "CNY" })
    .select("id")
    .single();
  if (error || !data) throw new PortfoliosBlockCSeedError(`创建组合失败: ${error?.message}`);
  const portfolioId = data.id as string;
  const tradeDateCore = monthsAgo(1);
  const tradeDateMsft = daysAgoIso(MSFT_INTRODUCED_DAYS_AGO);

  await supabase.from("transactions").insert([
    {
      portfolio_id: portfolioId,
      asset_id: "US:AAPL",
      type: "BUY",
      shares: "10",
      price_per_share: "180",
      currency: "USD",
      fee: "0",
      trade_date: tradeDateCore,
      notes: "portfolios:multi-market-full",
    },
    {
      portfolio_id: portfolioId,
      asset_id: "US:NVDA",
      type: "BUY",
      shares: "5",
      price_per_share: "800",
      currency: "USD",
      fee: "0",
      trade_date: tradeDateCore,
      notes: "portfolios:multi-market-full",
    },
    {
      portfolio_id: portfolioId,
      asset_id: "US:MSFT",
      type: "BUY",
      shares: "8",
      price_per_share: "420",
      currency: "USD",
      fee: "0",
      trade_date: tradeDateMsft,
      notes: "portfolios:multi-market-full:new-position",
    },
    {
      portfolio_id: portfolioId,
      asset_id: "CN:600519",
      type: "BUY",
      shares: "100",
      price_per_share: "1680",
      currency: "CNY",
      fee: "0",
      trade_date: tradeDateCore,
      notes: "portfolios:multi-market-full",
    },
    {
      portfolio_id: portfolioId,
      asset_id: "CN:000001",
      type: "BUY",
      shares: "1000",
      price_per_share: "12",
      currency: "CNY",
      fee: "0",
      trade_date: tradeDateCore,
      notes: "portfolios:multi-market-full",
    },
    {
      portfolio_id: portfolioId,
      asset_id: "HK:00700",
      type: "BUY",
      shares: "200",
      price_per_share: "380",
      currency: "HKD",
      fee: "0",
      trade_date: tradeDateCore,
      notes: "portfolios:multi-market-full",
    },
    {
      portfolio_id: portfolioId,
      asset_id: "FUND:510300",
      type: "BUY",
      shares: "5000",
      price_per_share: "4.5",
      currency: "CNY",
      fee: "0",
      trade_date: tradeDateCore,
      notes: "portfolios:multi-market-full",
    },
    {
      portfolio_id: portfolioId,
      asset_id: "CRYPTO:BTC",
      type: "BUY",
      shares: "0.25",
      price_per_share: "65000",
      currency: "USD",
      fee: "0",
      trade_date: tradeDateCore,
      notes: "portfolios:multi-market-full",
    },
    {
      portfolio_id: portfolioId,
      asset_id: "CRYPTO:ETH",
      type: "BUY",
      shares: "2",
      price_per_share: "3200",
      currency: "USD",
      fee: "0",
      trade_date: tradeDateCore,
      notes: "portfolios:multi-market-full",
    },
    {
      portfolio_id: portfolioId,
      asset_id: "CASH:CNY",
      type: "BUY",
      shares: "5000",
      price_per_share: "1",
      currency: "CNY",
      fee: "0",
      trade_date: tradeDateCore,
      notes: "portfolios:multi-market-full",
    },
    {
      portfolio_id: portfolioId,
      asset_id: "CASH:USD",
      type: "BUY",
      shares: "1000",
      price_per_share: "1",
      currency: "USD",
      fee: "0",
      trade_date: tradeDateCore,
      notes: "portfolios:multi-market-full",
    },
  ]);

  await seedBlockCDailySnapshots(supabase, portfolioId, snapshotDays);

  return {
    portfolioId,
    expectedUi: [
      "单组合",
      "US/CN/HK/FUND/CRYPTO/CASH 分组",
      "市场 Toggle 筛选 → 总市值/图表/涨跌随筛选变",
      "周期涨跌 mix（非全新建仓）",
      "US:MSFT 新建仓 chip",
      `${snapshotDays} 天 area-chart + per_asset 历史`,
    ],
  };
};

const runThirtyDaysHistorySeed = async (
  supabase: SupabaseClient,
  userId: string
): Promise<{ portfolioId: string; expectedUi: string[] }> => {
  return runMultiMarketFullSeed(supabase, userId, SNAPSHOT_HISTORY_DAYS);
};

export const runPortfoliosBlockCSeed = async (
  supabase: SupabaseClient,
  userId: string,
  scenario: PortfoliosBlockCScenario
): Promise<{ portfolioId: string; expectedUi: string[] }> => {
  if (scenario === "portfolios:multi-market-full") {
    return runMultiMarketFullSeed(supabase, userId);
  }
  return runThirtyDaysHistorySeed(supabase, userId);
};

export const isPortfoliosBlockCScenario = (v: string): v is PortfoliosBlockCScenario =>
  v === "portfolios:multi-market-full" || v === "portfolios:30-days-history";
