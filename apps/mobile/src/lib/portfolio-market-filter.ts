/**
 * Portfolio Tab market filter — sum / slice valuation & snapshots by market.
 */

import Decimal from "decimal.js";
import {
  parseAssetId,
  type Market,
  type PortfolioDailySnapshot,
  type PortfolioValuation,
} from "@arc/core";

const ZERO = new Decimal(0);

export const isMarketFilterActive = (markets: ReadonlySet<Market>): boolean => markets.size > 0;

export const assetMatchesMarketFilter = (
  assetId: string,
  markets: ReadonlySet<Market>
): boolean => {
  if (markets.size === 0) return true;
  return markets.has(parseAssetId(assetId).market);
};

export const sumReportingByMarketFilter = (
  entries: ReadonlyArray<{ readonly assetId: string; readonly valueReporting: Decimal }>,
  markets: ReadonlySet<Market>
): Decimal => {
  if (markets.size === 0) {
    return entries.reduce((sum, e) => sum.plus(e.valueReporting), ZERO);
  }
  return entries.reduce((sum, e) => {
    if (!assetMatchesMarketFilter(e.assetId, markets)) return sum;
    return sum.plus(e.valueReporting);
  }, ZERO);
};

/** Re-aggregate portfolio valuation for selected markets (empty set = full portfolio). */
export const filterPortfolioValuation = (
  valuation: PortfolioValuation,
  markets: ReadonlySet<Market>
): PortfolioValuation => {
  if (markets.size === 0) return valuation;

  const perAsset = valuation.perAsset.filter((v) => assetMatchesMarketFilter(v.assetId, markets));
  let totalValue = ZERO;
  let totalCostBasis = ZERO;
  for (const v of perAsset) {
    totalValue = totalValue.plus(v.valueReporting);
    totalCostBasis = totalCostBasis.plus(v.costBasisReporting);
  }
  const totalUnrealizedPnL = totalValue.minus(totalCostBasis);
  const totalUnrealizedPnLPercent = totalCostBasis.isZero()
    ? ZERO
    : totalUnrealizedPnL.dividedBy(totalCostBasis).times(100);

  return {
    ...valuation,
    perAsset,
    totalValue,
    totalCostBasis,
    totalUnrealizedPnL,
    totalUnrealizedPnLPercent,
  };
};

/** Re-aggregate baseline snapshot for selected markets (empty set = unchanged). */
export const filterPortfolioDailySnapshot = (
  snapshot: PortfolioDailySnapshot,
  markets: ReadonlySet<Market>
): PortfolioDailySnapshot => {
  if (markets.size === 0) return snapshot;

  const perAsset = snapshot.perAsset.filter((a) => assetMatchesMarketFilter(a.assetId, markets));
  let totalValue = ZERO;
  let totalCostBasis = ZERO;
  for (const a of perAsset) {
    totalValue = totalValue.plus(a.valueReporting);
    totalCostBasis = totalCostBasis.plus(a.valueReporting);
  }

  return {
    ...snapshot,
    perAsset,
    totalValue,
    totalCostBasis,
  };
};

/** Sum per-asset reporting map for chart / scrub when market filter is active. */
export const sumPerAssetReportingMap = (
  perAssetReporting: ReadonlyMap<string, Decimal>,
  markets: ReadonlySet<Market>
): Decimal => {
  if (markets.size === 0) return ZERO;
  let sum = ZERO;
  for (const [assetId, value] of perAssetReporting) {
    if (assetMatchesMarketFilter(assetId, markets)) {
      sum = sum.plus(value);
    }
  }
  return sum;
};
