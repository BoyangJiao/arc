/**
 * TWR day-key lookup — normalizes tx (T12:00Z) vs snapshot (T23:00Z) timestamps.
 *
 * See twr-stage-3.md §Implementation plan Phase 2 hint + ADR 009.
 */

import Decimal from "decimal.js";
import type { PriceQuote } from "@arc/core";

/** UTC calendar day — never compare raw timestamps across tx vs snapshot rows. */
export const toUtcDayKey = (date: Date): string => date.toISOString().slice(0, 10);

export interface AsOfRow {
  readonly asOf: string;
}

/** Index rows by UTC day key (last row wins if multiple timestamps share a day). */
export const indexByUtcDay = <T extends AsOfRow>(rows: readonly T[]): ReadonlyMap<string, T> => {
  const map = new Map<string, T>();
  for (const row of rows) {
    map.set(toUtcDayKey(new Date(row.asOf)), row);
  }
  return map;
};

/**
 * Exact day match, else most recent prior day (spec §决策 12 forward-fill).
 */
export const lookupByUtcDayWithForwardFill = <T extends AsOfRow>(
  dayKey: string,
  index: ReadonlyMap<string, T>
): T | undefined => {
  const exact = index.get(dayKey);
  if (exact) return exact;

  let bestKey: string | null = null;
  for (const key of index.keys()) {
    if (key < dayKey && (bestKey === null || key > bestKey)) {
      bestKey = key;
    }
  }
  return bestKey === null ? undefined : index.get(bestKey);
};

/**
 * Prefer prior day (forward-fill); if none, fall back to the earliest future day.
 *
 * Use this for "current-shares projection" charts where the user may scrub to
 * a date BEFORE the asset's first historical quote (e.g., scrubbing 1Y back on
 * a newly listed crypto). Forward-fill alone would return undefined; this
 * helper substitutes the earliest known price so the curve doesn't collapse.
 */
export const lookupByUtcDayBidirectional = <T extends AsOfRow>(
  dayKey: string,
  index: ReadonlyMap<string, T>
): T | undefined => {
  const exact = index.get(dayKey);
  if (exact) return exact;

  let bestPrior: string | null = null;
  let earliestFuture: string | null = null;
  for (const key of index.keys()) {
    if (key < dayKey) {
      if (bestPrior === null || key > bestPrior) bestPrior = key;
    } else if (key > dayKey) {
      if (earliestFuture === null || key < earliestFuture) earliestFuture = key;
    }
  }
  if (bestPrior !== null) return index.get(bestPrior);
  if (earliestFuture !== null) return index.get(earliestFuture);
  return undefined;
};

/** Unique UTC day keys for TWR boundary timestamps (from, to, cash-flow dates). */
export const collectBoundaryDayKeys = (
  from: Date,
  to: Date,
  boundaryTimestamps: readonly number[]
): readonly string[] =>
  Array.from(
    new Set([from, to, ...boundaryTimestamps.map((ms) => new Date(ms))].map((d) => toUtcDayKey(d)))
  );

/** Sync priceAt from pre-fetched historical quotes (day-rounded + forward-fill). */
export const buildPriceAt = (
  quotes: readonly PriceQuote[],
  assetId: string
): ((date: Date) => Decimal) => {
  const index = indexByUtcDay(quotes);
  return (t: Date) => {
    const dayKey = toUtcDayKey(t);
    const hit = lookupByUtcDayWithForwardFill(dayKey, index);
    if (!hit) {
      throw new Error(`no historical price for ${assetId} on ${dayKey}`);
    }
    return hit.price;
  };
};

/** Sync valueAt from a pre-resolved day → Decimal map. */
export const buildValueAt = (
  valueByDay: ReadonlyMap<string, Decimal>
): ((date: Date) => Decimal) => {
  return (t: Date) => {
    const dayKey = toUtcDayKey(t);
    const value = valueByDay.get(dayKey);
    if (value === undefined) {
      throw new Error(`no portfolio value for ${dayKey}`);
    }
    return value;
  };
};
