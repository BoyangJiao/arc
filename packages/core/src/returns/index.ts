/**
 * @arc/core/returns — return calculations (TWR / MWR + Stage 1 cumulative).
 *
 * Stage 1: simple cumulative return (still a stub).
 * Stage 3 Block D: TWR (Modified Dietz simplified) + MWR (XIRR Newton-Raphson)
 *   — see .specify/feature-specs/stage-3/twr-stage-3.md.
 *
 * Commit landing order:
 *   #1  types / errors / cash-flow detection  ← this commit
 *   #2  twr.ts (computeAssetTwr + computePortfolioTwr)
 *   #3  xirr.ts (computeMwr)
 *   #4  twr.property.spec.ts (≥ 20 property tests)
 */

import Decimal from "decimal.js";
import type { Currency, Holding, PriceQuote } from "../domain/types";

// 28-digit precision per TWR spec §决策 7 — aligns with transactions
// numeric(28,12) column. Set globally on the Decimal class; existing modules
// (rebalance / valuation / daily-delta) tested at this precision are stable
// because their assertions use exact-string comparisons that match at both
// 20 and 28 digits.
Decimal.set({ precision: 28 });

export * from "./types";
export * from "./errors";
export * from "./cash-flow";
export * from "./twr";

/**
 * computeCumulativeReturn — Stage 1 simple cumulative return.
 *
 * formula: (currentValue - totalCostBasis) / totalCostBasis
 *
 * @stub Stage 1 task — not yet implemented.
 */
export const computeCumulativeReturn = (
  _holdings: ReadonlyArray<Holding>,
  _currentQuotes: ReadonlyArray<PriceQuote>,
  _reportingCurrency: Currency
): Decimal => {
  throw new Error("computeCumulativeReturn: not yet implemented (Stage 1 task)");
};
