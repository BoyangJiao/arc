/**
 * Smart default chart range — pick the narrowest TimeRange that fits the
 * user's actual trade history.
 *
 * Rationale (ADR 014 — True Historical algorithm):
 *   The chart shows ¥0 for days before the first transaction. Defaulting a
 *   2-week-old portfolio to "1Y" yields 50 weeks of ¥0 followed by 2 weeks
 *   of data — visually broken. We snap the default to the closest range
 *   that contains the data, then let users widen manually.
 *
 * One-shot: applied once per portfolio on first render. Once the user picks
 * a range manually, the choice persists and this helper is bypassed.
 */

import type { Transaction } from "@arc/core";
import type { TimeRange } from "@arc/ui";

const DAY_MS = 86_400_000;

const earliestTradeMs = (transactions: readonly Transaction[]): number | null => {
  let earliest = Infinity;
  for (const tx of transactions) {
    const ms = new Date(tx.tradeDate).getTime();
    if (Number.isFinite(ms) && ms < earliest) earliest = ms;
  }
  return Number.isFinite(earliest) ? earliest : null;
};

export const pickDefaultRangeForFirstTrade = (firstTradeMs: number, nowMs: number): TimeRange => {
  const days = Math.max(0, (nowMs - firstTradeMs) / DAY_MS);
  if (days < 1) return "1D";
  if (days < 7) return "1W";
  if (days < 30) return "1M";
  // Default 3M for any portfolio with ≥ 30d of history — aligns with quarterly
  // rebalance cadence + matches the global DEFAULT_TIME_RANGE.
  return "3M";
};

/**
 * Returns null when there is no trade history yet (caller should keep the
 * current range — usually the global DEFAULT_TIME_RANGE).
 */
export const pickDefaultRangeForTransactions = (
  transactions: readonly Transaction[] | undefined,
  now: Date = new Date()
): TimeRange | null => {
  if (!transactions || transactions.length === 0) return null;
  const firstMs = earliestTradeMs(transactions);
  if (firstMs === null) return null;
  return pickDefaultRangeForFirstTrade(firstMs, now.getTime());
};
