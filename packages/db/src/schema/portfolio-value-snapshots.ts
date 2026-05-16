/**
 * portfolio_value_snapshots — 组合每日总市值快照
 *
 * 用途：
 *   - Stage 2 J7 Daily Snapshot：今日变动 = 今日值 - 昨日快照
 *   - Stage 3 J13 多时间段图表：取多日快照画折线
 *   - Stage 3 J14 TWR：基于时间序列计算 Time-Weighted Return
 *
 * 写入：定时任务（每日午夜后用户时区 + 实时分钟级在用户开 app 时增量补）
 * Stage 1 不读不写此表，schema 先就位避免后续 migration 影响生产
 *
 * RLS: portfolio belongs to auth.uid()
 */

import { sql } from "drizzle-orm";
import { index, numeric, pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";

import { currencyEnum } from "./enums";
import { portfolios } from "./portfolios";

const DECIMAL_PRECISION = { precision: 28, scale: 12 } as const;

export const portfolioValueSnapshots = pgTable(
  "portfolio_value_snapshots",
  {
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => portfolios.id, { onDelete: "cascade" }),
    /** 快照时点（通常是用户时区的午夜）*/
    asOf: timestamp("as_of", { withTimezone: true }).notNull(),
    /** 该时点的总市值（按当时报告货币）*/
    totalValue: numeric("total_value", DECIMAL_PRECISION).notNull(),
    /** 报告货币（冗余字段，避免历史快照随用户改 portfolio.reporting_currency 失效）*/
    reportingCurrency: currencyEnum("reporting_currency").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    primaryKey({ columns: [t.portfolioId, t.asOf] }),
    index("pv_snapshots_as_of_idx").on(t.asOf.desc()),
  ]
);

export type PortfolioValueSnapshot = typeof portfolioValueSnapshots.$inferSelect;
export type NewPortfolioValueSnapshot = typeof portfolioValueSnapshots.$inferInsert;
