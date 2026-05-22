/**
 * Deterministic monogram + gradient helpers for AssetAvatar.
 */

import type { RebalanceMarket } from "./rebalance-types";

/** Short market code for corner badge (max ~2 chars). */
export const MARKET_BADGE_CODE: Readonly<Record<RebalanceMarket, string>> = {
  US: "US",
  CN: "CN",
  HK: "HK",
  FUND: "F",
  CRYPTO: "₿",
  CASH: "$",
};

const GRADIENT_PAIRS: readonly (readonly [string, string])[] = [
  ["#6366f1", "#8b5cf6"],
  ["#0ea5e9", "#06b6d4"],
  ["#10b981", "#059669"],
  ["#f59e0b", "#d97706"],
  ["#ec4899", "#db2777"],
  ["#64748b", "#475569"],
];

const hashString = (input: string): number => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
};

export const monogramFromSymbol = (symbol: string): string =>
  symbol.trim().slice(0, 2).toUpperCase() || "?";

export const gradientForSeed = (seed: string): readonly [string, string] => {
  const index = hashString(seed) % GRADIENT_PAIRS.length;
  return GRADIENT_PAIRS[index] ?? GRADIENT_PAIRS[0]!;
};
