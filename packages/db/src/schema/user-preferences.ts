/**
 * user_preferences — Settings 页可调整字段
 *
 * 一行记录对应一个用户。Stage 1 J3-J5 验收依赖此表。
 *
 * RLS: user_id = auth.uid()
 */

import { sql } from "drizzle-orm";
import { boolean, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { currencyEnum, financeColorModeEnum, localeEnum } from "./enums";

export const userPreferences = pgTable("user_preferences", {
  /** PK = auth.users.id（一一对应）*/
  userId: uuid("user_id").primaryKey(),
  reportingCurrency: currencyEnum("reporting_currency").notNull().default("CNY"),
  locale: localeEnum("locale").notNull().default("zh"),
  financeColorMode: financeColorModeEnum("finance_color_mode").notNull().default("greenUpRedDown"),
  /** 一键脱敏开关（Stage 3 J16）*/
  redacted: boolean("redacted").notNull().default(false),
  /** Stage 2 欢迎屏是否已看过 — 决定 J6 触发与否 */
  hasSeenWelcome: boolean("has_seen_welcome").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type UserPreference = typeof userPreferences.$inferSelect;
export type NewUserPreference = typeof userPreferences.$inferInsert;
