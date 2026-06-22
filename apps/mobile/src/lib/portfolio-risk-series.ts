/**
 * Cash-flow-adjusted risk series for the Insights 风险 / 回撤 pages.
 *
 * The risk metrics (volatility, drawdown — and #11 beta) must be computed on
 * *market* movement only. A portfolio snapshot's totalValue includes every
 * trade settled that day (a fund/stock BUY raises totalValue by its cost; a
 * SELL lowers it), so raw value ratios treat funding events as returns and
 * inflate the metrics wildly (the 450% volatility / -54.8% drawdown bug).
 *
 * This module aligns each snapshot to the net trade flow during the period that
 * ends on it, in reporting currency at trade-date FX, so the page can feed
 * `(value, flow)` pairs to `insights.cashFlowAdjustedReturns` (core). "Flow" for
 * risk = ALL BUY/SELL of any asset (incl. CASH:*), because nothing auto-offsets
 * a trade in the holdings-only totalValue — broader than returns/cash-flow.ts,
 * which is portfolio-funding only. DIVIDEND/SPLIT/ADJUSTMENT are not flows.
 */

import Decimal from "decimal.js";
import { returns, type Currency, type Transaction } from "@arc/core";

import type { PortfolioSnapshotPoint } from "./queries/use-portfolio-value-snapshots";
import { toUtcDayKey } from "./twr-day-lookup";

const ZERO = new Decimal(0);

type FxAt = (currency: Currency, date: Date) => Decimal;

/** One asset's aligned (value, flow) series over the snapshot index. */
export interface AssetRiskSeries {
  readonly values: Decimal[];
  readonly flows: Decimal[];
}

export interface PortfolioRiskSeries {
  /** Snapshot totalValue series (already de-noised of leading zero totals upstream). */
  readonly values: Decimal[];
  /** Net trade flow (reporting currency) aligned to each snapshot index; index 0 = 0. */
  readonly flows: Decimal[];
  /** Per-asset series, keyed by assetId, for every asset seen across the snapshots. */
  readonly perAsset: ReadonlyMap<string, AssetRiskSeries>;
}

/**
 * Net signed trade flow per UTC day, total and per asset (reporting currency).
 * BUY → +gross, SELL → −gross. Same sign as the trade's impact on totalValue.
 */
const buildDayFlows = (
  transactions: readonly Transaction[],
  fxAt: FxAt
): { total: Map<string, Decimal>; perAsset: Map<string, Map<string, Decimal>> } => {
  const total = new Map<string, Decimal>();
  const perAsset = new Map<string, Map<string, Decimal>>();
  for (const tx of transactions) {
    if (tx.type !== "BUY" && tx.type !== "SELL") continue;
    const tradeDate = new Date(tx.tradeDate);
    const gross = tx.shares.times(tx.pricePerShare).times(fxAt(tx.currency, tradeDate));
    const signed = tx.type === "BUY" ? gross : gross.negated();
    const day = toUtcDayKey(tradeDate);

    total.set(day, (total.get(day) ?? ZERO).plus(signed));
    const assetDays = perAsset.get(tx.assetId) ?? new Map<string, Decimal>();
    assetDays.set(day, (assetDays.get(day) ?? ZERO).plus(signed));
    perAsset.set(tx.assetId, assetDays);
  }
  return { total, perAsset };
};

/**
 * Align sparse per-day flows to snapshot indices: flow[i] = Σ flows on trade
 * days `d` with `snapDay[i-1] < d ≤ snapDay[i]`. Trades on/before the first
 * snapshot day land in bucket 0 (ignored downstream — index 0 is the base, no
 * return). Trades after the last snapshot day are dropped.
 */
const alignFlows = (snapDayKeys: readonly string[], dayFlows: Map<string, Decimal>): Decimal[] => {
  const aligned = snapDayKeys.map(() => ZERO);
  for (const [day, flow] of dayFlows) {
    const idx = snapDayKeys.findIndex((s) => s >= day);
    if (idx < 0) continue;
    aligned[idx] = aligned[idx]!.plus(flow);
  }
  return aligned;
};

/**
 * Ledger-gated, forward-filled reporting value for one asset across snapshots.
 *
 * The transaction ledger is the source of truth (数据模型不变性 §2: 持仓 = Σ交易),
 * so an asset's value counts ONLY on days it is actually held (computeSharesAt > 0).
 * This (a) zeroes anachronistic snapshot rows — a back-dated cache may list an
 * asset before its buy date — and (b) zeroes a fully-sold asset. While held, an
 * absent snapshot entry (flaky price that day) carries the last-known value to
 * avoid a false V-shaped dip.
 */
const ledgerGatedAssetValues = (
  snapshots: readonly PortfolioSnapshotPoint[],
  assetId: string,
  transactions: readonly Transaction[]
): Decimal[] => {
  let lastKnown: Decimal | undefined;
  return snapshots.map((snap) => {
    const current = snap.perAssetReporting.get(assetId);
    if (current !== undefined) lastKnown = current;
    const shares = returns.computeSharesAt(transactions, assetId, new Date(snap.asOf));
    if (shares.lessThanOrEqualTo(0)) return ZERO; // ledger says not held → 0
    return lastKnown ?? ZERO; // held; carry last price if unpriced today
  });
};

export const buildPortfolioRiskSeries = (
  snapshots: readonly PortfolioSnapshotPoint[],
  transactions: readonly Transaction[],
  fxAt: FxAt
): PortfolioRiskSeries => {
  const snapDayKeys = snapshots.map((s) => toUtcDayKey(new Date(s.asOf)));
  const { total, perAsset: perAssetDayFlows } = buildDayFlows(transactions, fxAt);

  const assetIds = new Set<string>();
  for (const snap of snapshots) for (const id of snap.perAssetReporting.keys()) assetIds.add(id);

  const perAsset = new Map<string, AssetRiskSeries>();
  for (const id of assetIds) {
    perAsset.set(id, {
      values: ledgerGatedAssetValues(snapshots, id, transactions),
      flows: alignFlows(snapDayKeys, perAssetDayFlows.get(id) ?? new Map()),
    });
  }

  // Reconstruct the portfolio value per index by summing ledger-gated per-asset
  // values — robust to partial snapshots (matches raw totalValue on complete days).
  // This deliberately differs from snapshot.totalValue: it gates anachronistic rows
  // and forward-fills failed-price days (see tests). Known limitation: an asset that
  // is held (per ledger) and counted in totalValue but NEVER appears in any
  // snapshot's per_asset map has no price series here, so it is excluded from the
  // risk base; the metrics then describe the priced portion of the portfolio.
  const values = snapshots.map((_, i) =>
    [...perAsset.values()].reduce((sum, a) => sum.plus(a.values[i]!), ZERO)
  );

  return { values, flows: alignFlows(snapDayKeys, total), perAsset };
};
