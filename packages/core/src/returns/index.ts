/**
 * returns — 收益率计算（TWR / MWR / 累计收益率）
 *
 * Stage 1: 仅实现累计收益率（cumulative return）
 * Stage 2: 实现 TWR (Time-Weighted Return) + MWR (Money-Weighted Return)
 *
 * CLAUDE.md §3.2.5：历史净值用历史汇率/价格；混用是 P0 bug。
 */

import type Decimal from "decimal.js";
import type { Currency, Holding, PriceQuote } from "../domain/types";

/**
 * computeCumulativeReturn — 累计收益率（简化版）
 *
 * formula：(currentValue - totalCostBasis) / totalCostBasis
 *
 * @stub Stage 1 实施
 */
export const computeCumulativeReturn = (
  _holdings: ReadonlyArray<Holding>,
  _currentQuotes: ReadonlyArray<PriceQuote>,
  _reportingCurrency: Currency,
): Decimal => {
  throw new Error("computeCumulativeReturn: not yet implemented (Stage 1 task)");
};

/**
 * computeTWR — Time-Weighted Return（消除现金流影响的收益率）
 *
 * @stub Stage 2 实施 — 需要历史净值快照支持
 */
export const computeTWR = (..._args: unknown[]): Decimal => {
  throw new Error("computeTWR: not yet implemented (Stage 2 task)");
};

/**
 * computeMWR — Money-Weighted Return（IRR 思想，包含现金流时点影响）
 *
 * @stub Stage 2 实施
 */
export const computeMWR = (..._args: unknown[]): Decimal => {
  throw new Error("computeMWR: not yet implemented (Stage 2 task)");
};
