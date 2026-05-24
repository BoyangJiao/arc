/**
 * @arc/core/returns — type definitions for TWR / MWR (Stage 3 Block D).
 *
 * Pure types, zero runtime. See:
 * - .specify/feature-specs/stage-3/twr-stage-3.md §Data model
 * - .specify/constitution.md (Decimal everywhere; transaction immutability)
 */

import type Decimal from "decimal.js";

import type { Currency, Transaction } from "../domain/types";

// ─── Cash flow events ────────────────────────────────────────────────────

/**
 * A single portfolio cash-flow event (user funding or withdrawal).
 *
 * Driven by BUY/SELL CASH:* transactions per TWR spec §决策 2.
 * - `amount > 0` → money entering portfolio (BUY CASH:*)
 * - `amount < 0` → money leaving portfolio (SELL CASH:*)
 *
 * `amount` is in the transaction's native currency. Callers apply historical
 * FX when the TWR call site is in a different reporting currency (spec §决策 4).
 */
export interface CashFlowEvent {
  readonly transactionId: string;
  readonly date: Date;
  readonly amount: Decimal;
  readonly currency: Currency;
}

// ─── TWR result ──────────────────────────────────────────────────────────

export interface TwrResult {
  /** Time-weighted return as a decimal fraction (e.g. 0.1842 = 18.42%). */
  readonly value: Decimal;
  /** Number of sub-periods used in geometric compounding (debug + UI tooltip). */
  readonly subPeriods: number;
  /** Portfolio/asset value at the `from` boundary (reporting currency). */
  readonly startValue: Decimal;
  /** Portfolio/asset value at the `to` boundary (reporting currency). */
  readonly endValue: Decimal;
  /** Net cash flow over the window (sum of signed event amounts, debug only). */
  readonly netCashFlow: Decimal;
}

// ─── MWR result ──────────────────────────────────────────────────────────

export interface MwrResult {
  /** Money-weighted return (IRR). */
  readonly value: Decimal;
  /** Newton-Raphson iterations consumed. */
  readonly iterations: number;
  readonly converged: boolean;
}

// ─── TWR input shapes ────────────────────────────────────────────────────

/**
 * Asset-level TWR input. Each BUY/SELL on the asset is treated as a cash
 * flow event (spec §决策 6). `priceAt(date)` returns the asset's native price
 * at `date` and is wired by mobile hooks to the historical-price cache.
 */
export interface AssetTwrInput {
  readonly assetId: string;
  readonly portfolioId: string;
  readonly from: Date;
  readonly to: Date;
  readonly transactions: ReadonlyArray<Transaction>;
  readonly priceAt: (date: Date) => Decimal;
}

/**
 * Portfolio-level TWR input. Cash flow events come from BUY/SELL CASH:*
 * transactions only (spec §决策 2). `valueAt(date)` returns the portfolio
 * total value in reporting currency at `date`; mobile hooks wrap
 * `portfolio_value_snapshots` with `computeValuationAtDate` fallback.
 *
 * `reportingCurrency` filters cash-flow events to same-currency only: a
 * BUY CASH:USD in a CNY-reporting portfolio is treated as an internal asset
 * purchase, not external funding. Users who actually convert currencies
 * record two transactions (SELL CASH:CNY + BUY CASH:USD) so each portfolio
 * view stays internally consistent.
 */
export interface PortfolioTwrInput {
  readonly portfolioId: string;
  readonly reportingCurrency: Currency;
  readonly from: Date;
  readonly to: Date;
  readonly transactions: ReadonlyArray<Transaction>;
  readonly valueAt: (date: Date) => Decimal;
}

/** Discriminated union — narrow on presence of `assetId`. */
export type TwrInput = AssetTwrInput | PortfolioTwrInput;

// ─── Performance Attribution preview ─────────────────────────────────────

/**
 * Single-asset contribution to portfolio TWR.
 *
 * Minimal preview — the Performance Attribution spec (next after TWR) owns
 * the full shape and computation.
 */
export interface AssetContribution {
  readonly assetId: string;
  /** Contribution to portfolio TWR (fraction; sum across assets ≈ portfolio TWR). */
  readonly contribution: Decimal;
  /** Average weight of this asset in the portfolio over the window. */
  readonly weight: Decimal;
  /** Asset-level TWR over the same window. */
  readonly assetTwr: Decimal;
}
