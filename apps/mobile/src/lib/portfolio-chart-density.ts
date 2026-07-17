/**
 * Per-range chart sample density — shared by bootstrap and DB fallback gating (ADR 014).
 */

import Decimal from "decimal.js";
import type { Currency, Market, Transaction } from "@arc/core";
import type { TimeRange } from "@arc/ui";

import { sumPerAssetReportingMap } from "./portfolio-market-filter";
import type { PortfolioSnapshotPoint } from "./queries/use-portfolio-value-snapshots";
import { resolvePortfolioTwrWindow } from "./twr-window";

const ZERO = new Decimal(0);

const DAY_MS = 86_400_000;

const sampleCountForRange = (range: TimeRange, windowFrom: Date, windowTo: Date): number => {
  switch (range) {
    case "1D":
      return 1;
    case "1W":
      return 7;
    case "1M":
      return 30;
    case "3M":
    case "YTD":
    case "1Y":
    case "ALL": {
      const days = Math.max(0, (windowTo.getTime() - windowFrom.getTime()) / DAY_MS);
      return Math.max(7, Math.round(days / 7));
    }
  }
};

/** Intervals between window ends; `buildSampleDayKeys` emits `sampleCount + 1` day keys. */
export const chartSampleIntervalCount = (
  range: TimeRange,
  windowFrom: Date,
  windowTo: Date
): number => sampleCountForRange(range, windowFrom, windowTo);

/** Minimum chart points for a range (matches bootstrap sampling). */
export const expectedBootstrapPointCount = (
  range: TimeRange,
  transactions: readonly Transaction[],
  now: Date = new Date()
): number => {
  const window = resolvePortfolioTwrWindow(range, transactions, now);
  return chartSampleIntervalCount(range, window.from, window.to) + 1;
};

/**
 * True when DB snapshots lack the per-range sample density (ADR 014).
 * Two sparse cron rows are not enough for 1W/1M/weekly ranges — bootstrap required.
 */
export const needsChartBootstrap = (
  snapshots: readonly PortfolioSnapshotPoint[],
  range: TimeRange,
  transactions: readonly Transaction[]
): boolean => {
  if (transactions.length === 0) return false;
  return snapshots.length < expectedBootstrapPointCount(range, transactions);
};

/**
 * True when any snapshot row was stored in a different reporting currency than
 * the current display currency（铁律 4「币种永不丢失」+ 铁律 5「历史 ≠ 当下」）。
 *
 * 快照 totalValue 是按写入时组合的 reporting_currency 存的（如 ¥CNY）；显示
 * 币种不同（如 $USD）时绝不能把两种单位混进同一条曲线 / 同一次 periodChange
 * 相减 —— 历史值换算需要历史汇率，正确路径是 True-Historical bootstrap
 * （它在目标币种下用逐日历史 FX 重算），而不是拿快照数值直接用。
 */
export const snapshotsCurrencyMismatch = (
  snapshots: readonly PortfolioSnapshotPoint[],
  displayCurrency: Currency
): boolean => snapshots.some((p) => p.reportingCurrency !== displayCurrency);

/** Non-zero market-sliced snapshot rows — need ≥2 for a meaningful period baseline. */
export const countNonZeroMarketSlicePoints = (
  snapshots: readonly PortfolioSnapshotPoint[],
  markets: ReadonlySet<Market>
): number => {
  let count = 0;
  for (const p of snapshots) {
    if (sumPerAssetReportingMap(p.perAssetReporting, markets).gt(ZERO)) count += 1;
  }
  return count;
};

/**
 * DB rows are usable for market filter only when dense enough AND per_asset carries
 * sliced history (sparse cron rows without per_asset sum to ¥0 → fake flat chart).
 */
export const dbSnapshotsUsableForMarketFilter = (
  snapshots: readonly PortfolioSnapshotPoint[],
  range: TimeRange,
  transactions: readonly Transaction[],
  markets: ReadonlySet<Market>,
  now: Date = new Date()
): boolean => {
  if (transactions.length === 0) return false;
  const minPoints = expectedBootstrapPointCount(range, transactions, now);
  if (snapshots.length < minPoints) return false;
  return countNonZeroMarketSlicePoints(snapshots, markets) >= 2;
};

/**
 * Market-filtered chart series (ADR 014 extension):
 * 1. Market-scoped bootstrap at full range density (preferred)
 * 2. Dense DB snapshots with per_asset slice (only when rows actually carry market history)
 * 3. While bootstrap pending — empty (caller shows loading; never sparse 2-row DB)
 */
export const resolveMarketFilteredChartSeries = (input: {
  readonly boot: readonly PortfolioSnapshotPoint[] | undefined;
  readonly dbSnapshots: readonly PortfolioSnapshotPoint[];
  readonly range: TimeRange;
  /** Market-scoped transactions — drives expected point count / ALL window. */
  readonly transactions: readonly Transaction[];
  readonly markets: ReadonlySet<Market>;
  readonly bootstrapPending: boolean;
  readonly now?: Date;
}): readonly PortfolioSnapshotPoint[] => {
  const minPoints = expectedBootstrapPointCount(
    input.range,
    input.transactions,
    input.now ?? new Date()
  );
  const boot = input.boot;

  if (boot && boot.length >= minPoints) return boot;

  if (
    dbSnapshotsUsableForMarketFilter(
      input.dbSnapshots,
      input.range,
      input.transactions,
      input.markets,
      input.now
    )
  ) {
    return input.dbSnapshots;
  }

  if (input.bootstrapPending) return [];

  if (boot && boot.length >= 2) return boot;

  return [];
};
