/**
 * Postgres ENUM 定义
 *
 * 与 packages/core/src/domain/types.ts 的 TypeScript 联合类型一一对应。
 * 任何枚举扩展必须 **同步两边**：先改 packages/core，再改这里，再 generate migration。
 */

import { pgEnum } from "drizzle-orm/pg-core";

/** 市场代码（CLAUDE.md §3.2.3 资产 ID 前缀严格对应）*/
export const marketEnum = pgEnum("market", ["CN", "HK", "US", "CRYPTO", "FUND"]);

/** 货币代码 — Stage 1 仅 CNY/USD；Stage 3 扩展 */
export const currencyEnum = pgEnum("currency", ["CNY", "HKD", "USD", "JPY", "BTC", "ETH"]);

/** 交易类型 — Stage 1 仅 BUY；Stage 3 启用其余 */
export const transactionTypeEnum = pgEnum("transaction_type", [
  "BUY",
  "SELL",
  "DIVIDEND",
  "SPLIT",
  "ADJUSTMENT",
]);

/** 涨跌色偏好（ADR 003 §决策五）*/
export const financeColorModeEnum = pgEnum("finance_color_mode", [
  "redUpGreenDown",
  "greenUpRedDown",
]);

/** 语言偏好（i18n） */
export const localeEnum = pgEnum("locale", ["zh", "en"]);
