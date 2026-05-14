/**
 * price_snapshots — 行情缓存（asset × 时点 → 价格）
 *
 * 用途：
 *   1. 减少调用第三方数据源 API（避免速率限制 + 节省成本）
 *   2. 历史估值重算需要历史价（CLAUDE.md §3.2.5「历史 ≠ 当下」）
 *   3. Stage 2 Daily Snapshot 需要 24h 前快照对比
 *
 * 写入：数据源 adapter（packages/data-sources/）后端写入
 * 读取：所有用户共享（不携带 user_id）
 *
 * RLS: 公开读 + service_role 写
 */

import { sql } from "drizzle-orm";
import { index, numeric, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { assets } from "./assets";
import { currencyEnum } from "./enums";

const DECIMAL_PRECISION = { precision: 28, scale: 12 } as const;

export const priceSnapshots = pgTable(
  "price_snapshots",
  {
    assetId: text("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    /** 报价时点（ISO 8601 + 时区）*/
    asOf: timestamp("as_of", { withTimezone: true }).notNull(),
    /** 价格（资产原始币种）*/
    price: numeric("price", DECIMAL_PRECISION).notNull(),
    /** 资产 native 币种（冗余字段，避免 join 才能拿到货币）*/
    currency: currencyEnum("currency").notNull(),
    /** 数据源标识，如 "alphavantage" / "tushare" / "coingecko" */
    source: text("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    primaryKey({ columns: [t.assetId, t.asOf] }),
    // 反向索引：按时间倒序快速查"最新价"
    index("price_snapshots_as_of_idx").on(t.asOf.desc()),
  ]
);

export type PriceSnapshot = typeof priceSnapshots.$inferSelect;
export type NewPriceSnapshot = typeof priceSnapshots.$inferInsert;
