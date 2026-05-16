/**
 * portfolios — 用户的投资组合
 *
 * Stage 1: 每用户首登自动创建一个默认组合 `My Portfolio`
 * Stage 3: 支持多组合（List 末尾"+ 新建组合"激活）
 *
 * RLS: user_id = auth.uid()
 */

import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { currencyEnum } from "./enums";

export const portfolios = pgTable(
  "portfolios",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    /** 拥有者 — 引用 auth.users.id（Supabase Auth 自动管理）*/
    userId: uuid("user_id").notNull(),
    /** 组合名（如 `My Portfolio`、`401k`、`加密钱包`）*/
    name: text("name").notNull(),
    /** 该组合的报告货币（用户偏好可在 Stage 3+ 覆盖单组合）*/
    reportingCurrency: currencyEnum("reporting_currency").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("portfolios_user_id_idx").on(t.userId)]
);

export type Portfolio = typeof portfolios.$inferSelect;
export type NewPortfolio = typeof portfolios.$inferInsert;
