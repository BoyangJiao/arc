/**
 * @arc/core/returns/twr — Time-Weighted Return (Stage 3 Block D).
 *
 * Spec: .specify/feature-specs/stage-3/twr-stage-3.md §决策 1, 6.
 *
 * Algorithm: Modified Dietz simplified — cash flow events split the window
 * into sub-periods; each sub-period's return is `(end - start) / start`
 * without CF in the numerator; total TWR = geometric compound of sub-returns.
 *
 * Boundary convention (CRITICAL):
 *   `valueAt(date)` returns EOD value AT `date` *INCLUDING* any cash flow
 *   that occurred on `date` (this matches the `portfolio_value_snapshots`
 *   table, where the 23:00 UTC snapshot reflects everything that day).
 *
 *   Inside the chain, for a sub-period `[boundary[i], boundary[i+1]]`:
 *     - startValue = valueAt(boundary[i])  // for i>0, post-CF on boundary[i]
 *     - endValue = valueAt(boundary[i+1]) - CF_at_boundary[i+1]
 *         (strip CF so endValue reflects "value just BEFORE next CF")
 *     - For the final boundary `to`, no CF subtraction (CF events are
 *       strictly inside (from, to) per cash-flow.ts).
 *
 * Pure module: zero I/O. The `priceAt` / `valueAt` callbacks are the
 * adapter seam.
 */

import Decimal from "decimal.js";

import type { Transaction } from "../domain/types";

import { detectCashFlowEvents } from "./cash-flow";
import type { AssetTwrInput, CashFlowEvent, PortfolioTwrInput, TwrResult } from "./types";

// ────────────────────────────────────────────────────────────────────────────
// Asset-level helpers (also useful to Performance Attribution spec)

/**
 * Cumulative shares of `assetId` at end-of-day `date` (inclusive).
 *
 * Counts BUY (+) and SELL (-). DIVIDEND, SPLIT, and ADJUSTMENT are ignored
 * — SPLIT in particular is a Stage 4 follow-up: handling it requires a
 * split-factor field on the transaction, which Stage 3 self-use does not
 * encounter.
 */
export const computeSharesAt = (
  transactions: ReadonlyArray<Transaction>,
  assetId: string,
  date: Date
): Decimal => {
  const ms = date.getTime();
  let shares = new Decimal(0);
  for (const tx of transactions) {
    if (tx.assetId !== assetId) continue;
    if (new Date(tx.tradeDate).getTime() > ms) continue;
    if (tx.type === "BUY") {
      shares = shares.plus(tx.shares);
    } else if (tx.type === "SELL") {
      shares = shares.minus(tx.shares);
    }
  }
  return shares;
};

/**
 * The earliest BUY tradeDate for `assetId`, or `null` if none exists.
 *
 * Implements spec §决策 8: asset-level "ALL" range starts at the first BUY's
 * `tradeDate`, not `created_at`, so a back-dated transaction (Block C
 * decision 8 allows back-dating) shifts the ALL window correctly.
 */
export const getAssetFirstBuyDate = (
  transactions: ReadonlyArray<Transaction>,
  assetId: string
): Date | null => {
  let earliest: number | null = null;
  for (const tx of transactions) {
    if (tx.assetId !== assetId) continue;
    if (tx.type !== "BUY") continue;
    const ms = new Date(tx.tradeDate).getTime();
    if (earliest === null || ms < earliest) earliest = ms;
  }
  return earliest === null ? null : new Date(earliest);
};

const detectAssetCashFlowEvents = (
  transactions: ReadonlyArray<Transaction>,
  assetId: string,
  from: Date,
  to: Date
): ReadonlyArray<CashFlowEvent> => {
  const fromMs = from.getTime();
  const toMs = to.getTime();
  const events: CashFlowEvent[] = [];
  for (const tx of transactions) {
    if (tx.assetId !== assetId) continue;
    if (tx.type !== "BUY" && tx.type !== "SELL") continue;
    const date = new Date(tx.tradeDate);
    const ms = date.getTime();
    if (ms <= fromMs || ms >= toMs) continue;
    const gross = tx.shares.times(tx.pricePerShare);
    const amount = tx.type === "BUY" ? gross : gross.negated();
    events.push({
      transactionId: tx.id,
      date,
      amount,
      currency: tx.currency,
    });
  }
  events.sort((a, b) => a.date.getTime() - b.date.getTime());
  return events;
};

// ────────────────────────────────────────────────────────────────────────────
// Modified Dietz chain core (shared by portfolio + asset)

interface ChainResult {
  readonly subReturns: ReadonlyArray<Decimal>;
  readonly subPeriods: number;
  readonly firstValue: Decimal;
  readonly lastValue: Decimal;
  readonly netCashFlow: Decimal;
}

const runModifiedDietzChain = (
  events: ReadonlyArray<CashFlowEvent>,
  from: Date,
  to: Date,
  valueAt: (date: Date) => Decimal
): ChainResult => {
  // Consolidate same-date events (multiple CFs on one day → one boundary).
  const eventsByDate = new Map<number, Decimal>();
  for (const e of events) {
    const t = e.date.getTime();
    eventsByDate.set(t, (eventsByDate.get(t) ?? new Decimal(0)).plus(e.amount));
  }

  // Unique sorted boundary timestamps including from + to.
  const uniqueBoundaryMs = Array.from(
    new Set([from.getTime(), ...eventsByDate.keys(), to.getTime()])
  ).sort((a, b) => a - b);

  const subReturns: Decimal[] = [];
  for (let i = 0; i < uniqueBoundaryMs.length - 1; i++) {
    const startDate = new Date(uniqueBoundaryMs[i]!);
    const endDate = new Date(uniqueBoundaryMs[i + 1]!);

    const startValue = valueAt(startDate);
    const isFinal = i + 1 === uniqueBoundaryMs.length - 1;
    const cfOnEnd = isFinal
      ? new Decimal(0)
      : (eventsByDate.get(endDate.getTime()) ?? new Decimal(0));
    const endValue = valueAt(endDate).minus(cfOnEnd);

    if (startValue.isZero()) continue;
    const r = endValue.minus(startValue).div(startValue);
    subReturns.push(r);
  }

  const netCashFlow = events.reduce((acc, e) => acc.plus(e.amount), new Decimal(0));

  return {
    subReturns,
    subPeriods: subReturns.length,
    firstValue: valueAt(from),
    lastValue: valueAt(to),
    netCashFlow,
  };
};

const compoundReturns = (subReturns: ReadonlyArray<Decimal>): Decimal => {
  const product = subReturns.reduce((acc, r) => acc.times(new Decimal(1).plus(r)), new Decimal(1));
  return product.minus(1);
};

// ────────────────────────────────────────────────────────────────────────────
// Public entry points

export const computePortfolioTwr = (input: PortfolioTwrInput): TwrResult => {
  const allEvents = detectCashFlowEvents(input.transactions, input.from, input.to);
  // Filter to same-currency events only — cross-currency CASH:* movements
  // are treated as internal asset purchases, not funding (see types.ts
  // PortfolioTwrInput docstring).
  const events = allEvents.filter((e) => e.currency === input.reportingCurrency);
  const chain = runModifiedDietzChain(events, input.from, input.to, input.valueAt);
  return {
    value: compoundReturns(chain.subReturns),
    subPeriods: chain.subPeriods,
    startValue: chain.firstValue,
    endValue: chain.lastValue,
    netCashFlow: chain.netCashFlow,
  };
};

export const computeAssetTwr = (input: AssetTwrInput): TwrResult => {
  const events = detectAssetCashFlowEvents(input.transactions, input.assetId, input.from, input.to);
  const valueAt = (d: Date): Decimal =>
    computeSharesAt(input.transactions, input.assetId, d).times(input.priceAt(d));
  const chain = runModifiedDietzChain(events, input.from, input.to, valueAt);
  return {
    value: compoundReturns(chain.subReturns),
    subPeriods: chain.subPeriods,
    startValue: chain.firstValue,
    endValue: chain.lastValue,
    netCashFlow: chain.netCashFlow,
  };
};
