/**
 * Map business gain/loss semantics to HeroUI Pro TrendChip `trend` prop,
 * respecting red-up-green-down vs green-up-red-down (S1-AC-5).
 */

import type { FinanceColorMode } from "../tokens/business";

export type BusinessPnLSign = "gain" | "loss" | "neutral";
export type TrendDirection = "up" | "down" | "neutral";

export function trendDirectionForPnL(
  sign: BusinessPnLSign,
  mode: FinanceColorMode
): TrendDirection {
  if (sign === "neutral") return "neutral";
  if (sign === "gain") {
    return mode === "greenUpRedDown" ? "up" : "down";
  }
  return mode === "greenUpRedDown" ? "down" : "up";
}

export const pnlSignFromDecimal = (value: {
  isZero(): boolean;
  isNegative(): boolean;
}): BusinessPnLSign => {
  if (value.isZero()) return "neutral";
  return value.isNegative() ? "loss" : "gain";
};
