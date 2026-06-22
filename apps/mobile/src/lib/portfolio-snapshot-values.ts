/**
 * Pure snapshot value helpers — no IO / no React Native imports (testable in vitest).
 */

import Decimal from "decimal.js";
import type { Transaction } from "@arc/core";

import { startOfUtcDay } from "./time-range";

export interface SnapshotTotalRow {
  readonly asOf: string;
  readonly totalValue: Decimal;
}

export const snapshotValueOnOrBefore = (
  dayKey: string,
  sortedSnaps: readonly SnapshotTotalRow[]
): Decimal | undefined => {
  let value: Decimal | undefined;
  for (const s of sortedSnaps) {
    if (s.asOf.slice(0, 10) <= dayKey) value = s.totalValue;
    else break;
  }
  return value;
};

/** Calendar bucket with portfolio activity → effective TWR start (may be after bucket.from). */
export const findEffectiveBucketFrom = (
  bucket: { readonly from: Date; readonly to: Date },
  sortedSnaps: readonly SnapshotTotalRow[],
  transactions: readonly Transaction[]
): Date | null => {
  const calendarFromMs = bucket.from.getTime();
  const toMs = bucket.to.getTime();
  const calendarFromKey = bucket.from.toISOString().slice(0, 10);

  const hasActivityInBucket =
    sortedSnaps.some((s) => {
      const ms = new Date(s.asOf).getTime();
      return ms >= calendarFromMs && ms <= toMs && s.totalValue.greaterThan(0);
    }) ||
    transactions.some((t) => {
      const ms = new Date(t.tradeDate).getTime();
      return ms >= calendarFromMs && ms <= toMs;
    });

  if (!hasActivityInBucket) return null;

  const atCalendarStart = snapshotValueOnOrBefore(calendarFromKey, sortedSnaps);
  if (atCalendarStart !== undefined && atCalendarStart.greaterThan(0)) {
    return bucket.from;
  }

  for (const s of sortedSnaps) {
    const ms = new Date(s.asOf).getTime();
    if (ms < calendarFromMs) continue;
    if (ms > toMs) break;
    if (s.totalValue.greaterThan(0)) {
      return startOfUtcDay(new Date(s.asOf));
    }
  }

  let earliestTx: number | null = null;
  for (const t of transactions) {
    const ms = new Date(t.tradeDate).getTime();
    if (ms < calendarFromMs || ms > toMs) continue;
    if (earliestTx === null || ms < earliestTx) earliestTx = ms;
  }
  return earliestTx === null ? null : startOfUtcDay(new Date(earliestTx));
};
