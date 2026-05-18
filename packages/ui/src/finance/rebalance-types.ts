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

export interface RebalanceActionRow {
  readonly assetId: string;
  readonly label: string;
  readonly sharesNeeded: Decimal;
  readonly amountNeeded: Decimal;
  /** Pre-formatted price hint for disclaimer line */
  readonly priceHint: string;
  /** Decimal places for shares display */
  readonly shareDecimals: number;
}

/** |deviationPercent| → tier per rebalance-stage-2 spec (5% / 10%). */
export const deviationTierFromPercent = (deviationPercent: Decimal): DeviationTier => {
  const abs = deviationPercent.abs();
  if (abs.lte(5)) return "neutral";
  if (abs.lte(10)) return "warning";
  return "critical";
};
