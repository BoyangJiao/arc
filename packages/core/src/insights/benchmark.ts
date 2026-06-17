/**
 * insights/benchmark — 指数对标 helpers (Insights #9, benchmark comparison).
 *
 * Pure functions, Decimal everywhere (宪法 §3.1). The benchmark side of the
 * comparison: a calendar bucket's price return for an index, from its EOD close
 * series. The portfolio side uses per-bucket TWR (returns/twr.ts) — kept separate
 * so the two sides stay同口径 (D4): time-weighted portfolio vs price-return index.
 *
 * Benchmark returns are price returns (close-to-close), not total return — see
 * benchmark-comparison-stage-3.md D5. Historical, for-reference (宪法 §二).
 */

import Decimal from "decimal.js";

/** One EOD close for an index (date = ISO `YYYY-MM-DD`, ascending in a series). */
export interface IndexClose {
  readonly date: string;
  readonly close: Decimal;
}

/**
 * bucketReturn — price return of an index over the window [from, to], aligned by
 * trading date: start = first close on/after `from`, end = last close on/before
 * `to` (closes assumed ascending by date; ISO strings compare chronologically).
 *
 * Returns `null` when the window has < 2 usable closes, a non-positive start
 * close, or no overlap — caller renders that bucket's benchmark bar as absent.
 */
export function bucketReturn(
  closes: ReadonlyArray<IndexClose>,
  from: string,
  to: string
): Decimal | null {
  let start: IndexClose | undefined;
  let end: IndexClose | undefined;
  for (const c of closes) {
    if (c.date < from || c.date > to) continue;
    if (start === undefined) start = c;
    end = c;
  }
  if (start === undefined || end === undefined || start === end) return null;
  if (start.close.lessThanOrEqualTo(0)) return null;
  return end.close.dividedBy(start.close).minus(1);
}

// ─── calendar bucket windows (月/季度/年) ──────────────────────────────────

export type BucketGranularity = "month" | "quarter" | "year";

/** A calendar period window [from, to] (UTC); `to` is now for the current bucket. */
export interface CalendarBucket {
  /** Stable key: `2026` (year) · `2026-Q1` (quarter, q 0-based) · `2026-5` (month, m 0-based). */
  readonly key: string;
  readonly from: Date;
  readonly to: Date;
}

const startOfDayUtc = (y: number, monthIndex: number, day: number): Date =>
  new Date(Date.UTC(y, monthIndex, day, 0, 0, 0, 0));
const endOfDayUtc = (y: number, monthIndex: number, day: number): Date =>
  new Date(Date.UTC(y, monthIndex, day, 23, 59, 59, 999));

/**
 * The last `count` calendar buckets ending at the period containing `now`,
 * oldest → newest. Past buckets span the full period; the current bucket ends
 * at `now`. Pure (no IO); used by 指数对标 + trade-stats period charts.
 */
export function calendarBuckets(
  granularity: BucketGranularity,
  count: number,
  now: Date = new Date()
): CalendarBucket[] {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const buckets: CalendarBucket[] = [];

  for (let i = count - 1; i >= 0; i -= 1) {
    const current = i === 0;
    if (granularity === "year") {
      const by = y - i;
      buckets.push({
        key: `${by}`,
        from: startOfDayUtc(by, 0, 1),
        to: current ? now : endOfDayUtc(by, 11, 31),
      });
    } else if (granularity === "quarter") {
      const total = y * 4 + Math.floor(m / 3) - i;
      const by = Math.floor(total / 4);
      const bq = ((total % 4) + 4) % 4;
      const startMonth = bq * 3;
      buckets.push({
        key: `${by}-Q${bq}`,
        from: startOfDayUtc(by, startMonth, 1),
        to: current ? now : endOfDayUtc(by, startMonth + 3, 0),
      });
    } else {
      const total = y * 12 + m - i;
      const by = Math.floor(total / 12);
      const bm = ((total % 12) + 12) % 12;
      buckets.push({
        key: `${by}-${bm}`,
        from: startOfDayUtc(by, bm, 1),
        to: current ? now : endOfDayUtc(by, bm + 1, 0),
      });
    }
  }
  return buckets;
}
