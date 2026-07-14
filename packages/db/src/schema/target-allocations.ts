/**
 * target_allocations — 组合内各资产的目标配置占比
 *
 * 用途：
 *   - Stage 2 J9 Rebalance：偏离度计算 + 行动单
 *   - Stage 3 Performance Attribution：tracking error 等指标
 *
 * 设计要点：
 *   - 一行 = (portfolio, asset) 的目标占比（0–100）
 *   - Sum-to-100 在应用层校验（允许编辑过程中的部分保存）
 *   - UNIQUE (portfolio_id, asset_id) — 每个资产仅一条目标
 *
 * RLS:
 *   - SELECT / INSERT / UPDATE / DELETE：portfolio 属于 auth.uid()
 *
 * 见 .specify/feature-specs/stage-2/rebalance-stage-2.md
 */

import { sql } from "drizzle-orm";
import {
  check,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { assets } from "./assets";
import { portfolios } from "./portfolios";

const DECIMAL_PRECISION = { precision: 28, scale: 12 } as const;

export const targetAllocations = pgTable(
  "target_allocations",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => portfolios.id, { onDelete: "cascade" }),
    /** 资产 ID — `market:symbol`（含 CASH:USD 等现金资产）*/
    assetId: text("asset_id")
      .notNull()
      .references(() => assets.id),
    /** 目标占比 0–100（Decimal-as-string）*/
    targetPercent: numeric("target_percent", DECIMAL_PRECISION).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("target_allocations_portfolio_asset_uniq").on(t.portfolioId, t.assetId),
    index("target_allocations_portfolio_id_idx").on(t.portfolioId),
    // FK covering index（asset join / 引用完整性检查）
    index("target_allocations_asset_id_idx").on(t.assetId),
    check(
      "target_allocations_percent_range",
      sql`${t.targetPercent} >= 0 AND ${t.targetPercent} <= 100`
    ),
  ]
);

export type TargetAllocation = typeof targetAllocations.$inferSelect;
export type NewTargetAllocation = typeof targetAllocations.$inferInsert;
