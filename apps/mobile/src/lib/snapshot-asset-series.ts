/**
 * Build per-asset value series from EOD snapshots for multi-line charts.
 *
 * When a snapshot omits an asset (missing price that day), forward-fill the last
 * known value instead of plotting 0 — avoids false V-shaped dips.
 */

import Decimal from "decimal.js";

import type { PortfolioSnapshotPoint } from "./queries/use-portfolio-value-snapshots";

/** Drop leading all-zero totalValue snapshots (pre-inception noise). */
export const trimSnapshotsLeadingZeroTotals = (
  snapshots: readonly PortfolioSnapshotPoint[]
): PortfolioSnapshotPoint[] => {
  const first = snapshots.findIndex((s) => s.totalValue.greaterThan(0));
  return first < 0 ? [] : snapshots.slice(first);
};

export const forwardFilledAssetValueSeries = (
  snapshots: readonly PortfolioSnapshotPoint[],
  assetId: string
): Decimal[] => {
  let lastKnown: Decimal | undefined;
  return snapshots.map((snap) => {
    const current = snap.perAssetReporting.get(assetId);
    if (current !== undefined) lastKnown = current;
    return lastKnown ?? new Decimal(0);
  });
};

export const buildForwardFilledAssetSeries = (
  snapshots: readonly PortfolioSnapshotPoint[],
  assetIds: readonly string[],
  valueKey: (assetId: string) => string
): Record<string, number>[] => {
  const lastKnown = new Map<string, Decimal>();

  return snapshots.map((snap, index) => {
    const row: Record<string, number> = { index };
    for (const id of assetIds) {
      const current = snap.perAssetReporting.get(id);
      if (current !== undefined) {
        lastKnown.set(id, current);
      }
      row[valueKey(id)] = lastKnown.get(id)?.toNumber() ?? 0;
    }
    return row;
  });
};
