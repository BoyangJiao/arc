import Decimal from "decimal.js";

/** Coinbase-style: ↑¥1,234.56 (+8.15%) — arrow, currency, abs amount, optional percent. */
export const formatCompactChangeLine = (
  delta: Decimal,
  percent: Decimal | null,
  currencySym: string
): string => {
  const arrow = delta.isPositive() ? "↑" : delta.isNegative() ? "↓" : "→";
  const amount = `${arrow}${currencySym}${delta.abs().toFixed(2)}`;
  if (percent === null || percent.isZero()) return amount;
  const pctSign = percent.isPositive() ? "+" : percent.isNegative() ? "-" : "";
  return `${amount} (${pctSign}${percent.abs().toFixed(2)}%)`;
};
