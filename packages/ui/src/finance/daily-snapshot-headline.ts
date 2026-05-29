/**
 * Daily snapshot headline helpers — shared by card + detail view.
 */

import type { DailySnapshotDelta } from "./DailySnapshotCard";

/** Movers with non-zero overnight change (excludes new positions after P0). */
export const visibleDailySnapshotMovers = (
  delta: DailySnapshotDelta
): DailySnapshotDelta["movers"] =>
  delta.movers.filter((m) => !m.deltaReporting.isZero() || !m.deltaPercent.isZero());

/** Show copy instead of "+¥0.00" when there is no overnight P&L under current scope. */
export const shouldShowAllNewPositionsHeadline = (delta: DailySnapshotDelta): boolean => {
  if (delta.status !== "ok") return false;
  if (delta.movers.length === 0) return false;
  if (!delta.totalDeltaReporting.isZero()) return false;
  return delta.movers.every((m) => m.deltaReporting.isZero() && m.deltaPercent.isZero());
};
