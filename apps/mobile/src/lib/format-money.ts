/**
 * format-money — single source of "render a Decimal as a money string".
 *
 * Why this lives in apps/mobile (not @arc/core or @arc/ui):
 * - Pure presentation concern (Decimal → string), not domain logic
 * - Stage 1 only needs CNY/USD; expanding to HKD/JPY/etc. is just one row
 *   in CURRENCY_SYMBOL — no abstraction needed yet
 * - Was duplicated in 3 places before (Portfolio Tab, Portfolio Detail,
 *   Settings); the audit flagged it
 *
 * Stage 3+ can swap to Intl.NumberFormat for locale-aware grouping if
 * needed. For now, fixed 2 decimals + leading symbol matches the IA spec.
 */

import type Decimal from "decimal.js";
import type { Currency } from "@arc/core";
// Import via subpath to keep this module testable under Node (the @arc/ui
// barrel pulls in React Native primitives that vitest can't parse).
import { AMOUNT_REDACTION_MASK } from "@arc/ui/src/finance/amount-redaction";

const CURRENCY_SYMBOL: Record<Currency, string> = {
  CNY: "¥",
  USD: "$",
  HKD: "HK$",
  JPY: "¥",
  BTC: "₿",
  ETH: "Ξ",
};

export const currencySymbol = (c: Currency): string => CURRENCY_SYMBOL[c] ?? c;

export type FormatMoneyOptions = {
  /** When true, returns a fixed dot mask (percent lines use separate formatters). */
  readonly redact?: boolean;
};

/** Render a Decimal amount with the given currency's symbol + 2 decimals. */
export const formatMoney = (
  amount: Decimal,
  currency: Currency,
  options?: FormatMoneyOptions
): string =>
  options?.redact ? AMOUNT_REDACTION_MASK : `${currencySymbol(currency)}${amount.toFixed(2)}`;
