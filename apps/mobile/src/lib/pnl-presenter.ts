/**
 * pnl-presenter — derive the Insights 盈亏分析 累计盈亏 (cumulative) card.
 *
 * Spec: .specify/feature-specs/stage-3/pnl-analysis-insights.md §J18c / AC.1.1.
 *
 * Time-range INDEPENDENT — computed from the live valuation + holdings, NOT the
 * period query, so switching the page time range never refetches it (AC.2.2).
 *
 * 持有收益 uses the SAME per-row formula as holdings-presenter.ts so the card
 * sum closes mathematically with the Portfolio Tab holdings rows (ADR 016 v3
 * 持有收益含分红语义):
 *   holdingReturn = Σ (valueReporting − costBasisReporting + dividendsReporting)
 *                 = totalValue − totalCostBasis + Σ dividends_reporting
 */

import Decimal from "decimal.js";
import type { Holding, PortfolioValuation } from "@arc/core";

const ONE = new Decimal(1);
const ZERO = new Decimal(0);

export interface CumulativePnlSummary {
  /** 持有收益 = totalValue − totalInvested + Σ dividends (reporting currency). */
  readonly holdingReturn: Decimal;
  /** 持有收益率 (%) — `null` when nothing has been invested yet. */
  readonly holdingReturnPercent: Decimal | null;
  /** 总投入 = Σ totalCostBasis (reporting currency). */
  readonly totalInvested: Decimal;
  /** 现持市值 = Σ current value (reporting currency). */
  readonly totalValue: Decimal;
}

export const buildCumulativePnlSummary = (
  valuation: PortfolioValuation,
  holdings: readonly Holding[]
): CumulativePnlSummary => {
  const fxByAsset = new Map(valuation.perAsset.map((v) => [v.assetId, v.fxRateUsed]));

  let dividendsReporting = ZERO;
  for (const holding of holdings) {
    dividendsReporting = dividendsReporting.plus(
      holding.totalDividends.times(fxByAsset.get(holding.assetId) ?? ONE)
    );
  }

  const totalInvested = valuation.totalCostBasis;
  const totalValue = valuation.totalValue;
  const holdingReturn = totalValue.minus(totalInvested).plus(dividendsReporting);
  const holdingReturnPercent = totalInvested.isZero()
    ? null
    : holdingReturn.dividedBy(totalInvested).times(100);

  return { holdingReturn, holdingReturnPercent, totalInvested, totalValue };
};
