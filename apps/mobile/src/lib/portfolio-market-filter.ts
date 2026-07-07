/**
 * Portfolio Tab market filter — sum / slice valuation & snapshots by market.
 */

import Decimal from "decimal.js";
import {
  parseAssetId,
  type Holding,
  type Market,
  type PortfolioDailySnapshot,
  type PortfolioValuation,
  type Transaction,
} from "@arc/core";

const ZERO = new Decimal(0);

const ALL_MARKETS: readonly Market[] = ["CN", "HK", "US", "CRYPTO", "FUND", "CASH"];
const MARKET_LOOKUP = new Set<string>(ALL_MARKETS);

export const serializeMarketFilters = (markets: ReadonlySet<Market>): string =>
  Array.from(markets).sort().join(",");

/** Parse `markets` route param from Portfolio Tab → daily P&L detail navigation. */
export const parseMarketFiltersParam = (
  param: string | string[] | undefined
): ReadonlySet<Market> => {
  if (param == null) return new Set();
  const raw = Array.isArray(param) ? param.join(",") : param;
  if (!raw.trim()) return new Set();
  const out = new Set<Market>();
  for (const part of raw.split(",")) {
    const market = part.trim();
    if (MARKET_LOOKUP.has(market)) out.add(market as Market);
  }
  return out;
};

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
  for (const a of perAsset) {
    totalValue = totalValue.plus(a.valueReporting);
  }

  // SnapshotAsset has no costBasis field — filtered total is unrecoverable.
  // Set to ZERO (downstream only reads `perAsset` + `totalValue`).
  return {
    ...snapshot,
    perAsset,
    totalValue,
    totalCostBasis: ZERO,
  };
};

export const filterHoldingsByMarket = (
  holdings: readonly Holding[],
  markets: ReadonlySet<Market>
): readonly Holding[] => {
  if (markets.size === 0) return holdings;
  return holdings.filter((h) => assetMatchesMarketFilter(h.assetId, markets));
};

export const filterTransactionsByMarket = (
  transactions: readonly Transaction[],
  markets: ReadonlySet<Market>
): readonly Transaction[] => {
  if (markets.size === 0) return transactions;
  return transactions.filter((tx) => assetMatchesMarketFilter(tx.assetId, markets));
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
