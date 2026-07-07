/**
 * Deterministic monogram + gradient helpers for AssetAvatar.
 */

import { AVATAR_GRADIENT_PAIRS } from "../tokens/avatar-gradients";
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
  const index = hashString(seed) % AVATAR_GRADIENT_PAIRS.length;
  return AVATAR_GRADIENT_PAIRS[index] ?? AVATAR_GRADIENT_PAIRS[0]!;
};
