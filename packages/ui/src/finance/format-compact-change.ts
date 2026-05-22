import Decimal from "decimal.js";

/**
 * PnL percent / amount formatting rules (Arc finance copy):
 *
 * - **Combined line** (`formatCompactChangeLine`): sign only on the amount
 *   → `+¥1,234.56 (13.17%)` — parentheses hold unsigned magnitude.
 * - **Standalone percent** (`formatSignedPercent`): sign on the value
 *   → `+13.17%` — watchlist, movers, badges-as-text, etc.
 */

/** Signed numeric amount without currency symbol — e.g. +123.45 / -12.30 */
export const formatSignedAmount = (amount: Decimal): string => {
  if (amount.isZero()) return amount.toFixed(2);
  const sign = amount.isPositive() ? "+" : "-";
  return `${sign}${amount.abs().toFixed(2)}`;
};

/** Unsigned percent magnitude — for use after a signed amount, inside parentheses. */
export const formatUnsignedPercent = (percent: Decimal): string => `${percent.abs().toFixed(2)}%`;

/** Standalone percent with sign — e.g. +13.17% / -8.00% */
export const formatSignedPercent = (percent: Decimal): string => {
  if (percent.isZero()) return `${percent.toFixed(2)}%`;
  const sign = percent.isPositive() ? "+" : "-";
  return `${sign}${formatUnsignedPercent(percent)}`;
};

/** Portfolio hero / holding row: +¥1,234.56 (13.17%) — sign on amount only. */
export const formatCompactChangeLine = (
  delta: Decimal,
  percent: Decimal | null,
  currencySym: string
): string => {
  const amountSign = delta.isPositive() ? "+" : delta.isNegative() ? "-" : "";
  const amount = `${amountSign}${currencySym}${delta.abs().toFixed(2)}`;
  if (percent === null || percent.isZero()) return amount;
  return `${amount} (${formatUnsignedPercent(percent)})`;
};
