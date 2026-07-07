/**
 * @arc/core/returns/period-pnl — period P&L for the Insights 盈亏分析 module.
 *
 * Spec: .specify/feature-specs/stage-3/pnl-analysis-insights.md
 *   §决策 1 (algorithm split) · §决策 3 (cumulative cost-basis return curve)
 *   §决策 4 (period value change) · §决策 5 (realized P&L) · §决策 6 (ranking)
 *
 * Implements ADR 016 §决策 7. Pure module — zero I/O. All financial math via
 * decimal.js (CLAUDE.md §3.1). Historical FX is injected by the caller via
 * `fxAt` so this layer never reaches a network / cache (CLAUDE.md §3.4, Law 5
 * 历史 ≠ 当下 — period cost basis & realized P&L use trade-date FX, while
 * `valueAt(d)` is already reporting-currency-normalized at day d).
 *
 * ─── Cost-basis replay (shared by curve + realized) ──────────────────────
 * We replay transactions chronologically with the SAME accumulator semantics
 * as `computeHoldings` (domain/holdings.ts) so the cumulative return curve and
 * realized P&L stay mathematically closed with the holdings rows (AC.1.1):
 *   - averageCost is the fee-free share-weighted mean (used for SELL realized)
 *   - totalCostBasis is fee-inclusive (used as the curve's `totalInvested`)
 * Each native cost delta is converted to reporting currency at its own trade
 * date so the running `cumInvested` is the historical-FX reporting cost basis.
 *
 * ─── MWR (money-weighted / XIRR) ─────────────────────────────────────────
 * Per §决策 1 the period cash-flow series is
 *   [ −startValue@from, (−BUY / +SELL gross)@event…, +endValue@to ]
 * fed to `computeMwr` (xirr.ts). XIRR returns an ANNUALIZED rate. The UI shows
 * two distinct numbers ("现金加权 MWR" vs "年化收益率估算"), so we expose both:
 *   - `mwrAnnualized` = raw XIRR annual rate
 *   - `mwrPeriod`     = de-annualized to the actual window: (1+r)^(T/365) − 1
 * Either is `null` when XIRR is degenerate (single day, all-same-sign, no
 * convergence) — surfaced as "—" in UI, never NaN (mirrors S3-AC-D.1.8).
 *
 * NOTE on spec drift: the spec's `PeriodPnlResult` listed a single `mwr` field;
 * splitting it into `mwrPeriod` + `mwrAnnualized` resolves the spec's internal
 * inconsistency (period vs annualized) without losing information. Cash
 * dividends are intentionally NOT injected as MWR flows here (the spec's flow
 * construction omits them); they ARE captured in the cost-basis return curve
 * and per-asset contribution. Revisit if real-env dogfooding shows drift.
 */

import Decimal from "decimal.js";

import type { Currency, Transaction } from "../domain/types";

import { computeMwr } from "./xirr";

const DAYS_PER_YEAR = new Decimal(365);
const MS_PER_DAY = 86_400_000;
const ZERO = new Decimal(0);

/** Day-keyed FX resolver: 1 unit of `currency` → reporting currency at `date`. */
export type FxResolver = (currency: Currency, date: Date) => Decimal;

/** Per-period inputs aggregated by the caller from snapshots + bootstrap. */
export interface PeriodPnlInput {
  readonly from: Date;
  readonly to: Date;
  readonly reportingCurrency: Currency;
  /** Portfolio total value in reporting currency at `date` (snapshot/bootstrap). */
  readonly valueAt: (date: Date) => Decimal;
  /** Per-asset reporting-currency value at `date` (0 when not held). */
  readonly perAssetValueAt: (date: Date, assetId: string) => Decimal;
  readonly transactions: ReadonlyArray<Transaction>;
  /** Day-keyed historical FX (injected via compute-valuation-at-date). */
  readonly fxAt: FxResolver;
  /**
   * Dates at which to sample the cumulative-return curve — the chart's
   * x-axis sample days (snapshot dates + bootstrap fill), within [from, to].
   * Order-independent: sorted + deduped internally for deterministic output.
   */
  readonly sampleDates: ReadonlyArray<Date>;
}

/** A single sampled point on the cumulative cost-basis return curve. */
export interface ReturnCurvePoint {
  readonly date: Date;
  /** Cumulative cost-basis return as a fraction (e.g. 0.417 = +41.7%). */
  readonly ratio: Decimal;
}

/** Per-asset signed contribution over the period (for the ranking card). */
export interface AssetPeriodContribution {
  readonly assetId: string;
  /** Signed reporting-currency contribution = ΔValue − netInflow + dividends. */
  readonly contribution: Decimal;
  /** contribution / startValue; `null` for a position opened inside the period. */
  readonly ratio: Decimal | null;
  /**
   * Realized P&L from SELLs in the period (reporting currency, trade-date FX),
   * `(sell price − average cost) × shares`. Zero when the asset wasn't sold (#6).
   */
  readonly realized: Decimal;
}

export interface PeriodPnlResult {
  /** Portfolio value at the `from` boundary (reporting currency). */
  readonly startValue: Decimal;
  /** Portfolio value at the `to` boundary (reporting currency). */
  readonly endValue: Decimal;
  /** = endValue − startValue − netInflow. 含资金流的金额变化（§决策 4）。 */
  readonly valueChange: Decimal;
  /** Net inflow (reporting currency) inside (from, to]. */
  readonly netInflow: Decimal;
  /** Σ realized P&L from SELL transactions inside [from, to] (§决策 5). */
  readonly realizedPnL: Decimal;
  /** Cumulative cost-basis return curve sample points (matches chart, §决策 3). */
  readonly returnCurve: ReadonlyArray<ReturnCurvePoint>;
  /** Money-weighted return over the window (de-annualized). `null` if degenerate. */
  readonly mwrPeriod: Decimal | null;
  /** Raw annualized XIRR. `null` if degenerate. */
  readonly mwrAnnualized: Decimal | null;
  /** Per-asset contribution (§决策 6). Sorted by abs(contribution) DESC. */
  readonly perAssetContribution: ReadonlyArray<AssetPeriodContribution>;
}

// ─── Internal replay state ───────────────────────────────────────────────

interface AssetAcc {
  shares: Decimal;
  /** Fee-free share-weighted average cost (native), mirrors computeHoldings. */
  averageCost: Decimal;
  /** Fee-inclusive total cost basis (native), used for ADJUSTMENT avgCost. */
  totalCostBasis: Decimal;
}

interface InvestedCheckpoint {
  readonly ms: number;
  /** Running reporting-currency cost basis as of this event (= totalInvested). */
  readonly cumInvested: Decimal;
  /** Running reporting-currency cash dividends received as of this event. */
  readonly cumDividends: Decimal;
}

const isCashAsset = (assetId: string): boolean => assetId.startsWith("CASH:");

const sortByTradeDate = (transactions: ReadonlyArray<Transaction>): ReadonlyArray<Transaction> =>
  [...transactions].sort(
    (a, b) => new Date(a.tradeDate).getTime() - new Date(b.tradeDate).getTime()
  );

/**
 * computeRealizedPnlInPeriod — Σ over SELL inside [from, to] of
 * shares × (sellPrice − averageCost_at_sell) × fx_at_sell (§决策 5).
 *
 * `averageCost_at_sell` is the running fee-free weighted mean at the moment of
 * the SELL, replayed from the full transaction history (not just the window).
 */
export const computeRealizedPnlInPeriod = (
  transactions: ReadonlyArray<Transaction>,
  from: Date,
  to: Date,
  _reportingCurrency: Currency,
  fxResolver: FxResolver
): Decimal => {
  const fromMs = from.getTime();
  const toMs = to.getTime();
  const accumulators = new Map<string, AssetAcc>();
  let realized = ZERO;

  for (const tx of sortByTradeDate(transactions)) {
    const acc = getAcc(accumulators, tx.assetId);
    const txDate = new Date(tx.tradeDate);
    applyToAccumulator(acc, tx, (sellRealizedNative) => {
      const ms = txDate.getTime();
      if (ms >= fromMs && ms <= toMs) {
        realized = realized.plus(sellRealizedNative.times(fxResolver(tx.currency, txDate)));
      }
    });
  }

  return realized;
};

const getAcc = (map: Map<string, AssetAcc>, assetId: string): AssetAcc => {
  let acc = map.get(assetId);
  if (!acc) {
    acc = { shares: ZERO, averageCost: ZERO, totalCostBasis: ZERO };
    map.set(assetId, acc);
  }
  return acc;
};

/**
 * Mutates `acc` for one transaction exactly like computeHoldings, and reports
 * the native realized P&L for SELLs (0 otherwise) via `onSellRealized`.
 * Returns the native cost-basis delta (signed) for cumInvested bookkeeping.
 */
const applyToAccumulator = (
  acc: AssetAcc,
  tx: Transaction,
  onSellRealized: (realizedNative: Decimal) => void
): Decimal => {
  switch (tx.type) {
    case "BUY": {
      const newShares = acc.shares.plus(tx.shares);
      acc.averageCost = newShares.isZero()
        ? ZERO
        : acc.shares
            .times(acc.averageCost)
            .plus(tx.shares.times(tx.pricePerShare))
            .dividedBy(newShares);
      acc.shares = newShares;
      const costDelta = tx.shares.times(tx.pricePerShare).plus(tx.fee);
      acc.totalCostBasis = acc.totalCostBasis.plus(costDelta);
      return costDelta;
    }
    case "SELL": {
      const realizedNative = tx.shares.times(tx.pricePerShare.minus(acc.averageCost));
      onSellRealized(realizedNative);
      const costRemoved = tx.shares.times(acc.averageCost);
      acc.shares = acc.shares.minus(tx.shares);
      acc.totalCostBasis = acc.totalCostBasis.minus(costRemoved);
      return costRemoved.negated();
    }
    case "SPLIT": {
      const ratio = tx.pricePerShare;
      acc.shares = acc.shares.times(ratio);
      if (!ratio.isZero()) {
        acc.averageCost = acc.averageCost.dividedBy(ratio);
      }
      return ZERO; // total cost unchanged by a split
    }
    case "ADJUSTMENT": {
      acc.shares = acc.shares.plus(tx.shares);
      const costDelta = tx.shares.times(tx.pricePerShare);
      acc.totalCostBasis = acc.totalCostBasis.plus(costDelta);
      acc.averageCost = acc.shares.isZero() ? ZERO : acc.totalCostBasis.dividedBy(acc.shares);
      return costDelta;
    }
    case "DIVIDEND":
    default:
      return ZERO; // dividends don't touch cost basis or shares
  }
};

const uniqueSortedDates = (dates: ReadonlyArray<Date>): Date[] => {
  const seen = new Set<number>();
  const out: Date[] = [];
  for (const d of dates) {
    const ms = d.getTime();
    if (!seen.has(ms)) {
      seen.add(ms);
      out.push(d);
    }
  }
  out.sort((a, b) => a.getTime() - b.getTime());
  return out;
};

/** Latest checkpoint with `ms <= targetMs`, or null when none precede it. */
const checkpointAt = (
  checkpoints: ReadonlyArray<InvestedCheckpoint>,
  targetMs: number
): InvestedCheckpoint | null => {
  // checkpoints are sorted ascending by ms — binary search the rightmost ≤ target.
  let lo = 0;
  let hi = checkpoints.length - 1;
  let found: InvestedCheckpoint | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const cp = checkpoints[mid]!;
    if (cp.ms <= targetMs) {
      found = cp;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
};

/**
 * computePeriodPnl — the full Insights 盈亏分析 period bundle.
 *
 * One chronological pass builds: running reporting cost basis & dividends
 * (curve checkpoints), period net inflow, realized P&L, per-asset period
 * inflow/dividends, and the period cash-flow series for XIRR.
 */
export const computePeriodPnl = (input: PeriodPnlInput): PeriodPnlResult => {
  const { from, to, valueAt, perAssetValueAt, fxAt, transactions } = input;
  const fromMs = from.getTime();
  const toMs = to.getTime();

  const accumulators = new Map<string, AssetAcc>();
  const checkpoints: InvestedCheckpoint[] = [];
  let cumInvested = ZERO;
  let cumDividends = ZERO;
  let netInflow = ZERO;
  let realizedPnL = ZERO;

  // Per-asset period aggregates (non-CASH only) for the ranking card.
  const perAssetInflow = new Map<string, Decimal>();
  const perAssetDividends = new Map<string, Decimal>();
  const perAssetRealized = new Map<string, Decimal>();
  const rankedAssetIds: string[] = [];
  const seenAsset = new Set<string>();

  // Period cash-flow events for XIRR (signed, reporting currency).
  const periodFlows: Array<{ date: Date; amount: Decimal }> = [];

  for (const tx of sortByTradeDate(transactions)) {
    const acc = getAcc(accumulators, tx.assetId);
    const txDate = new Date(tx.tradeDate);
    const ms = txDate.getTime();
    const fx = fxAt(tx.currency, txDate);
    const inHalfOpen = ms > fromMs && ms <= toMs; // (from, to] — funding window
    const inClosed = ms >= fromMs && ms <= toMs; // [from, to] — realized window
    const cash = isCashAsset(tx.assetId);

    if (!cash && !seenAsset.has(tx.assetId)) {
      seenAsset.add(tx.assetId);
      rankedAssetIds.push(tx.assetId);
    }

    const costDeltaNative = applyToAccumulator(acc, tx, (realizedNative) => {
      if (inClosed) {
        const realizedReporting = realizedNative.times(fx);
        realizedPnL = realizedPnL.plus(realizedReporting);
        if (!cash) {
          perAssetRealized.set(
            tx.assetId,
            (perAssetRealized.get(tx.assetId) ?? ZERO).plus(realizedReporting)
          );
        }
      }
    });
    cumInvested = cumInvested.plus(costDeltaNative.times(fx));

    if (tx.type === "DIVIDEND") {
      const divReporting = tx.shares.times(tx.pricePerShare).times(fx);
      cumDividends = cumDividends.plus(divReporting);
      if (inHalfOpen && !cash) {
        perAssetDividends.set(
          tx.assetId,
          (perAssetDividends.get(tx.assetId) ?? ZERO).plus(divReporting)
        );
      }
    }

    if (tx.type === "BUY" && inHalfOpen) {
      const grossReporting = tx.shares.times(tx.pricePerShare).plus(tx.fee).times(fx);
      netInflow = netInflow.plus(grossReporting);
      periodFlows.push({ date: txDate, amount: grossReporting.negated() });
      if (!cash) {
        perAssetInflow.set(
          tx.assetId,
          (perAssetInflow.get(tx.assetId) ?? ZERO).plus(grossReporting)
        );
      }
    } else if (tx.type === "SELL" && inHalfOpen) {
      const grossReporting = tx.shares.times(tx.pricePerShare).times(fx);
      netInflow = netInflow.minus(grossReporting);
      periodFlows.push({ date: txDate, amount: grossReporting });
      if (!cash) {
        perAssetInflow.set(
          tx.assetId,
          (perAssetInflow.get(tx.assetId) ?? ZERO).minus(grossReporting)
        );
      }
    }

    // Record a checkpoint after each event (last-write-wins on duplicate ms).
    const lastCp = checkpoints[checkpoints.length - 1];
    if (lastCp && lastCp.ms === ms) {
      checkpoints[checkpoints.length - 1] = { ms, cumInvested, cumDividends };
    } else {
      checkpoints.push({ ms, cumInvested, cumDividends });
    }
  }

  // ─── Boundary values ───────────────────────────────────────────────────
  const startValue = valueAt(from);
  const endValue = valueAt(to);
  const valueChange = endValue.minus(startValue).minus(netInflow);

  // ─── Cumulative cost-basis return curve (§决策 3) ───────────────────────
  const returnCurve: ReturnCurvePoint[] = [];
  for (const d of uniqueSortedDates(input.sampleDates)) {
    const cp = checkpointAt(checkpoints, d.getTime());
    if (!cp || cp.cumInvested.lte(0)) continue; // no meaningful cost basis yet
    const ratio = valueAt(d).plus(cp.cumDividends).minus(cp.cumInvested).dividedBy(cp.cumInvested);
    returnCurve.push({ date: d, ratio });
  }

  // ─── MWR / XIRR (§决策 1) ────────────────────────────────────────────────
  let mwrAnnualized: Decimal | null = null;
  let mwrPeriod: Decimal | null = null;
  const spanDays = (toMs - fromMs) / MS_PER_DAY;
  if (spanDays > 0) {
    const flows = [
      { date: from, amount: startValue.negated() },
      ...periodFlows,
      { date: to, amount: endValue },
    ];
    // XIRR is only defined when the series changes sign — a same-sign series
    // (e.g. start value 0 + a single terminal inflow) has no internal rate of
    // return, yet Newton-Raphson would "converge" by driving r → ∞ so the lone
    // term vanishes within tolerance. Guard against that false root.
    const hasPositive = flows.some((f) => f.amount.gt(0));
    const hasNegative = flows.some((f) => f.amount.lt(0));
    if (hasPositive && hasNegative) {
      try {
        const r = computeMwr(flows).value;
        mwrAnnualized = r;
        // de-annualize: (1+r)^(T/365) − 1. Guard 1+r ≤ 0 (computeMwr keeps r > -1).
        const base = new Decimal(1).plus(r);
        mwrPeriod = base.lte(0)
          ? null
          : base.pow(new Decimal(spanDays).dividedBy(DAYS_PER_YEAR)).minus(1);
      } catch {
        mwrAnnualized = null;
        mwrPeriod = null;
      }
    }
  }

  // ─── Per-asset contribution + ranking (§决策 6, AC.1.7) ──────────────────
  const perAssetContribution: AssetPeriodContribution[] = rankedAssetIds.map((assetId) => {
    const startV = perAssetValueAt(from, assetId);
    const endV = perAssetValueAt(to, assetId);
    const inflow = perAssetInflow.get(assetId) ?? ZERO;
    const dividends = perAssetDividends.get(assetId) ?? ZERO;
    const contribution = endV.minus(startV).minus(inflow).plus(dividends);
    const ratio = startV.isZero() ? null : contribution.dividedBy(startV);
    return { assetId, contribution, ratio, realized: perAssetRealized.get(assetId) ?? ZERO };
  });
  perAssetContribution.sort((a, b) => {
    const diff = b.contribution.abs().minus(a.contribution.abs());
    if (!diff.isZero()) return diff.isPositive() ? 1 : -1;
    // tie-break by assetId for deterministic order
    return a.assetId < b.assetId ? -1 : a.assetId > b.assetId ? 1 : 0;
  });

  return {
    startValue,
    endValue,
    valueChange,
    netInflow,
    realizedPnL,
    returnCurve,
    mwrPeriod,
    mwrAnnualized,
    perAssetContribution,
  };
};
