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
