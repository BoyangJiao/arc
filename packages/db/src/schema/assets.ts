/**
 * assets — 全局资产元数据（不属于任何用户，所有用户共享）
 *
 * CLAUDE.md §3.2.1: id 一经写入永不修改；任何"修正"通过新增 ADJUSTMENT 交易实现
 * CLAUDE.md §3.2.4: currency 是该资产的"原始计价币种"，永不丢失
 *
 * RLS: 所有已认证用户可读，仅 service_role 可写（数据源 adapter 后端写入）
 */

import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { currencyEnum, marketEnum } from "./enums";

export const assets = pgTable(
  "assets",
  {
    /** 不可变 ID，格式 `{market}:{symbol}`（如 `US:AAPL`、`CN:600519`、`CRYPTO:btc`） */
    id: text("id").primaryKey(),
    market: marketEnum("market").notNull(),
    symbol: text("symbol").notNull(),
    /** 显示名（如 "Apple Inc."、"贵州茅台"） */
    name: text("name").notNull(),
    /** 资产原始计价货币 */
    currency: currencyEnum("currency").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    // id 必须严格匹配 `{market}:{symbol}`，且 symbol 部分非空
    check("assets_id_format", sql`${t.id} ~ '^[A-Z]+:.+$'`),
    // id 与 market、symbol 字段一致性（防写入时 id 与字段错配）
    check("assets_id_consistency", sql`${t.id} = ${t.market} || ':' || ${t.symbol}`),
  ]
);

export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
