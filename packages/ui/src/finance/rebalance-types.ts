/**
 * Presentational types for Rebalance UI — duck-typed Decimal, no @arc/core import.
 */

import type Decimal from "decimal.js";

export type DeviationTier = "neutral" | "warning" | "critical";

export interface RebalanceDonutSegment {
  readonly assetId: string;
  readonly label: string;
  /** Share of ring, 0–100 */
  readonly percent: Decimal;
}

export interface DeviationBarRow {
  readonly assetId: string;
  readonly label: string;
  readonly targetPercent: Decimal;
  readonly currentPercent: Decimal;
  readonly deviationPercent: Decimal;
  readonly tier: DeviationTier;
}

/** Mirrors @arc/core Market — local so @arc/ui stays domain-free. */
export type RebalanceMarket = "CN" | "HK" | "US" | "CRYPTO" | "FUND" | "CASH";

/** Mirrors @arc/core Currency — local so @arc/ui stays domain-free. */
export type RebalanceCurrency = "CNY" | "HKD" | "USD" | "JPY" | "BTC" | "ETH";

export interface RebalanceActionRow {
  readonly assetId: string;
  readonly label: string;
  readonly sharesNeeded: Decimal;
  readonly amountNeeded: Decimal;
  readonly market: RebalanceMarket;
  readonly nativeCurrency: RebalanceCurrency;
  /** Pre-formatted price hint for disclaimer line */
  readonly priceHint: string;
}

/** |deviationPercent| → tier per rebalance-stage-2 spec (5% / 10%). */
export const deviationTierFromPercent = (deviationPercent: Decimal): DeviationTier => {
  const abs = deviationPercent.abs();
  if (abs.lte(5)) return "neutral";
  if (abs.lte(10)) return "warning";
  return "critical";
};
