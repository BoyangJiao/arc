/**
 * Resolve portfolio total value on TWR boundary days — shared by usePortfolioTwr
 * and useBenchmarkComparison.
 *
 * Priority: exact EOD snapshot → forward-fill prior snapshot → computeValuationAtDate
 * (network). Falls back to 0 only when the portfolio truly had no holdings yet.
 */

import Decimal from "decimal.js";
import type { Currency, Transaction } from "@arc/core";

import { computeValuationAtDate } from "./compute-valuation-at-date";
import { snapshotValueOnOrBefore } from "./portfolio-snapshot-values";
import { indexByUtcDay } from "./twr-day-lookup";
import type { PortfolioSnapshotPoint } from "./queries/use-portfolio-value-snapshots";

export { findEffectiveBucketFrom } from "./portfolio-snapshot-values";

export const resolvePortfolioValuesByDay = async (input: {
  readonly portfolioId: string;
  readonly dayKeys: readonly string[];
  readonly snapshots: readonly PortfolioSnapshotPoint[];
  readonly transactions: readonly Transaction[];
  readonly reportingCurrency: Currency;
}): Promise<Map<string, Decimal>> => {
  const snapshotByDay = indexByUtcDay(input.snapshots);
  const sortedSnaps = [...input.snapshots].sort((a, b) => a.asOf.localeCompare(b.asOf));
  const valueByDay = new Map<string, Decimal>();

  for (const dayKey of input.dayKeys) {
    const exact = snapshotByDay.get(dayKey);
    if (exact) {
      valueByDay.set(dayKey, exact.totalValue);
      continue;
    }

    const filled = snapshotValueOnOrBefore(dayKey, sortedSnaps);
    if (filled !== undefined && filled.greaterThan(0)) {
      valueByDay.set(dayKey, filled);
      continue;
    }

    try {
      valueByDay.set(
        dayKey,
        await computeValuationAtDate({
          portfolioId: input.portfolioId,
          dayKey,
          transactions: input.transactions,
          reportingCurrency: input.reportingCurrency,
        })
      );
    } catch {
      valueByDay.set(dayKey, filled ?? new Decimal(0));
    }
  }

  return valueByDay;
};
