/**
 * transactions — 用户录入的不可变交易记录
 *
 * CLAUDE.md §3.2.1: 一经创建不修改；如需修正，新增 ADJUSTMENT 抵消
 * CLAUDE.md §3.2.2: 持仓 = Σ(transactions)，禁止直接编辑持仓数字
 * CLAUDE.md §3.1: 所有金额字段用 numeric（PostgreSQL 任意精度），不用 float/double
 *
 * Decimal 字段精度：
 *   - shares: numeric(28, 12) — 涵盖加密货币的 satoshi 级精度
 *   - pricePerShare / fee: numeric(28, 12) — 同上
 *   - 应用层用 decimal.js 包装；ORM 返回 string，不要 parseFloat
 *
 * RLS: portfolio belongs to auth.uid()
 */

import { sql } from "drizzle-orm";
import { check, index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { assets } from "./assets";
import { currencyEnum, transactionTypeEnum } from "./enums";
import { portfolios } from "./portfolios";

const DECIMAL_PRECISION = { precision: 28, scale: 12 } as const;

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => portfolios.id, { onDelete: "cascade" }),
    assetId: text("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "restrict" }),
    type: transactionTypeEnum("type").notNull(),
    /** 份额（Decimal as string；应用层用 decimal.js 包装）*/
    shares: numeric("shares", DECIMAL_PRECISION).notNull(),
    /** 单价（资产原始币种）*/
    pricePerShare: numeric("price_per_share", DECIMAL_PRECISION).notNull(),
    /** 交易币种（通常 = asset.currency；跨币种交易时可不同）*/
    currency: currencyEnum("currency").notNull(),
    /** 手续费（与 currency 同币种）*/
    fee: numeric("fee", DECIMAL_PRECISION).notNull().default("0"),
    /** 交易日期（含时区，多市场场景必须）*/
    tradeDate: timestamp("trade_date", { withTimezone: true }).notNull(),
    /** 备注 — 仅展示用，不参与计算 */
    notes: text("notes"),
    /** 持有账户 / 平台（如「支付宝」「IBKR」）— 资产位置敞口分组用（#12）；可空 */
    account: text("account"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    // 复合索引：按组合查交易历史（最常见 query）
    index("transactions_portfolio_trade_date_idx").on(t.portfolioId, t.tradeDate),
    // 按资产查（资产详情页历史）
    index("transactions_portfolio_asset_idx").on(t.portfolioId, t.assetId),
    // shares 必须 > 0（ADJUSTMENT 修正用 SELL 抵消，不允许负 shares）
    check("transactions_shares_positive", sql`${t.shares} > 0`),
    // pricePerShare 必须 ≥ 0（DIVIDEND 派息可能 = 0；BUY/SELL 必须 > 0 由应用层校验）
    check("transactions_price_non_negative", sql`${t.pricePerShare} >= 0`),
    // fee 必须 ≥ 0
    check("transactions_fee_non_negative", sql`${t.fee} >= 0`),
  ]
);

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
