/**
 * portfolio_value_snapshots — 组合每日总市值快照
 *
 * 用途：
 *   - Stage 2 J7 Daily Snapshot：今日变动 = 今日值 - 昨日快照（活跃）
 *   - Stage 3 J13 多时间段图表：取多日快照画折线
 *   - Stage 3 J14 TWR：基于时间序列计算 Time-Weighted Return
 *
 * 写入路径（Stage 2 起激活）：
 *   - GitHub Actions 23:00 UTC daily cron → Supabase Edge Function
 *     `daily-snapshot` → 遍历 portfolios，读 price_snapshots + fx_rates 缓存，
 *     `computePortfolioValuation` → upsert 一行
 *   - 用户开 app 时不主动写（避免每次 app start 都写一行）
 *
 * Idempotency: PK (portfolio_id, as_of) + ON CONFLICT DO UPDATE。
 *   Cron 每天用同一个 as_of (e.g. 23:00:00Z)，重复运行只更新不重复插入。
 *
 * RLS:
 *   - SELECT: 用户可读自己 portfolio 的快照（policy 见 migration 0003）
 *   - INSERT/UPDATE/DELETE: service_role only（Edge Function 用 service_role；
 *     client 永不直接写）
 *
 * 见 .specify/feature-specs/stage-2/daily-snapshot-stage-2.md
 */

import { sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { currencyEnum } from "./enums";
import { portfolios } from "./portfolios";

const DECIMAL_PRECISION = { precision: 28, scale: 12 } as const;

/**
 * Per-asset snapshot row (JSON-encoded for Stage 2 — defer normalization to
 * Stage 3 when historical per-asset queries arrive). All numeric fields are
 * Decimal-as-string per constitution §3.1.
 */
export interface SnapshotAssetRow {
  assetId: string;
  shares: string;
  valueNative: string;
  currency: string;
  valueReporting: string;
}

export const portfolioValueSnapshots = pgTable(
  "portfolio_value_snapshots",
  {
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => portfolios.id, { onDelete: "cascade" }),
    /** 快照时点。Cron 每天固定 23:00:00Z (= 07:00 北京次日，US 收盘后)；ADR 008 §决策一. */
    asOf: timestamp("as_of", { withTimezone: true }).notNull(),
    /** 该时点的总市值（按当时报告货币）*/
    totalValue: numeric("total_value", DECIMAL_PRECISION).notNull(),
    /** 总成本基 — 用于未实现盈亏分母 + Stage 3 TWR 计算 */
    totalCostBasis: numeric("total_cost_basis", DECIMAL_PRECISION).notNull().default("0"),
    /** 报告货币（冗余字段，避免历史快照随用户改 portfolio.reporting_currency 失效）*/
    reportingCurrency: currencyEnum("reporting_currency").notNull(),
    /** Per-asset 明细（top-3 movers 用）— JSONB array of SnapshotAssetRow */
    perAsset: jsonb("per_asset")
      .$type<SnapshotAssetRow[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    /** 'edge-function' (cron 写) | 'manual' (seed / 手动补) */
    source: text("source").notNull().default("edge-function"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    primaryKey({ columns: [t.portfolioId, t.asOf] }),
    index("pv_snapshots_as_of_idx").on(t.asOf.desc()),
    check(
      "portfolio_value_snapshots_source_check",
      sql`${t.source} IN ('edge-function', 'manual')`
    ),
  ]
);

export type PortfolioValueSnapshot = typeof portfolioValueSnapshots.$inferSelect;
export type NewPortfolioValueSnapshot = typeof portfolioValueSnapshots.$inferInsert;
