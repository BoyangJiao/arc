/**
 * fx_rates — 汇率缓存（from × to × 时点 → rate）
 *
 * rate 表示 1 单位 from 等于多少 to。如 USD→CNY rate=7.20。
 *
 * 反向汇率：可在应用层取倒数，不存两份（避免一致性问题）
 *
 * RLS: 公开读 + service_role 写
 */

import { sql } from "drizzle-orm";
import { check, index, numeric, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { currencyEnum } from "./enums";

const FX_PRECISION = { precision: 18, scale: 8 } as const;

export const fxRates = pgTable(
  "fx_rates",
  {
    fromCurrency: currencyEnum("from_currency").notNull(),
    toCurrency: currencyEnum("to_currency").notNull(),
    asOf: timestamp("as_of", { withTimezone: true }).notNull(),
    /** 1 unit of from = rate units of to */
    rate: numeric("rate", FX_PRECISION).notNull(),
    source: text("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    primaryKey({ columns: [t.fromCurrency, t.toCurrency, t.asOf] }),
    index("fx_rates_as_of_idx").on(t.asOf.desc()),
    // 不允许 from === to（恒等汇率应在应用层 short-circuit，不入库）
    check("fx_rates_from_to_distinct", sql`${t.fromCurrency} <> ${t.toCurrency}`),
    // rate 必须 > 0
    check("fx_rates_rate_positive", sql`${t.rate} > 0`),
  ]
);

export type FxRate = typeof fxRates.$inferSelect;
export type NewFxRate = typeof fxRates.$inferInsert;
