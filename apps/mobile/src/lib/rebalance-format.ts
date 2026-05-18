/**
 * Rebalance UI helpers — labels, tiers, share formatting.
 */

import Decimal from "decimal.js";
import { parseAssetId, type Currency, type Market } from "@arc/core";
import { rebalance } from "@arc/core";

type DeviationItem = rebalance.DeviationItem;
import type { DeviationBarRow, DeviationTier, RebalanceDonutSegment } from "@arc/ui";
import { deviationTierFromPercent } from "@arc/ui";

export const shareDecimalsForMarket = (market: Market, currency: Currency): number => {
  if (market === "CRYPTO") return 8;
  if (market === "CASH") return currency === "JPY" ? 0 : 2;
  return 0;
};

export const formatSharesDelta = (shares: Decimal, decimals: number): string => {
  const rounded = shares.toDecimalPlaces(decimals, Decimal.ROUND_FLOOR);
  if (rounded.isZero()) return "0";
  const sign = rounded.isPositive() ? "+" : "";
  return `${sign}${rounded.toFixed(decimals)}`;
};

export const formatSignedPercent = (value: Decimal): string => {
  if (value.isZero()) return "0.0%";
  const sign = value.isPositive() ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
};

export const assetLabel = (assetId: string, cashName?: string): string => {
  const { market, symbol } = parseAssetId(assetId);
  if (market === "CASH" && cashName) return cashName;
  return symbol;
};

export const toDonutSegments = (
  items: ReadonlyArray<{ assetId: string; label: string; percent: Decimal }>
): RebalanceDonutSegment[] =>
  items.map((item) => ({
    assetId: item.assetId,
    label: item.label,
    percent: item.percent,
  }));

export const toDeviationBarRows = (
  deviations: ReadonlyArray<DeviationItem>,
  labelFor: (assetId: string) => string
): DeviationBarRow[] =>
  deviations.map((d) => ({
    assetId: d.assetId,
    label: labelFor(d.assetId),
    targetPercent: d.targetPercent,
    currentPercent: d.currentPercent,
    deviationPercent: d.deviationPercent,
    tier: deviationTierFromPercent(d.deviationPercent),
  }));

export const tierForDeviation = (deviationPercent: Decimal): DeviationTier =>
  deviationTierFromPercent(deviationPercent);
