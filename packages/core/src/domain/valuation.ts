/**
 * valuation — 把 Holdings + 价格 + 汇率合成报告币种估值
 *
 * CLAUDE.md §3.2.4 / §3.2.5 约束：
 * - 永远不预先换算存储
 * - 每次估值都重算
 * - 当前估值用最新价 + 最新汇率；历史估值用对应时点的快照
 */

import Decimal from "decimal.js";
import type {
  Currency,
  FxRate,
  Holding,
  MarketValuation,
  PortfolioValuation,
  PriceQuote,
} from "./types";

/**
 * computeMarketValue — 把单个 holding 换算成报告币种估值
 *
 * 当 fx 为 null 时，表示 holding 和 reportingCurrency 同币种，汇率视为 1。
 */
export const computeMarketValue = (
  holding: Holding,
  quote: PriceQuote,
  fx: FxRate | null,
  reportingCurrency: Currency
): MarketValuation => {
  const fxRate = fx ? fx.rate : new Decimal(1);
  const fxAsOf = fx ? fx.asOf : quote.asOf;

  // 原始币种市值
  const valueNative = holding.shares.times(quote.price);
  // 报告币种市值
  const valueReporting = valueNative.times(fxRate);
  // 报告币种成本
  const costBasisReporting = holding.shares.times(holding.averageCost).times(fxRate);
  // 未实现盈亏
  const unrealizedPnL = valueReporting.minus(costBasisReporting);
  // 未实现盈亏百分比
  const unrealizedPnLPercent = costBasisReporting.isZero()
    ? new Decimal(0)
    : unrealizedPnL.dividedBy(costBasisReporting).times(100);

  return {
    assetId: holding.assetId,
    shares: holding.shares,
    priceNative: quote.price,
    valueNative,
    nativeCurrency: holding.currency,
    valueReporting,
    costBasisReporting,
    unrealizedPnL,
    unrealizedPnLPercent,
    reportingCurrency,
    fxRateUsed: fxRate,
    priceAsOf: quote.asOf,
    fxAsOf,
  };
};

/**
 * computePortfolioValuation — 整个组合的估值汇总
 *
 * 遍历每个 holding，根据 assetId 查找对应 quote 和 fxRate，
 * 调用 computeMarketValue 后汇总。
 */
export const computePortfolioValuation = (
  portfolioId: string,
  holdings: ReadonlyArray<Holding>,
  quotes: ReadonlyArray<PriceQuote>,
  fxRates: ReadonlyArray<FxRate>,
  reportingCurrency: Currency
): PortfolioValuation => {
  // Build lookup maps
  const quoteMap = new Map<string, PriceQuote>();
  for (const q of quotes) {
    quoteMap.set(q.assetId, q);
  }

  const fxMap = new Map<string, FxRate>();
  for (const fx of fxRates) {
    // key: "from->to"
    fxMap.set(`${fx.from}->${fx.to}`, fx);
  }

  let totalValue = new Decimal(0);
  let totalCostBasis = new Decimal(0);
  const perAsset: MarketValuation[] = [];

  for (const holding of holdings) {
    const quote = quoteMap.get(holding.assetId);
    if (!quote) {
      // 无报价则跳过（不影响其他持仓的计算）
      continue;
    }

    // 查找汇率：如果持仓币种与报告币种相同则无需换算
    let fx: FxRate | null = null;
    if (holding.currency !== reportingCurrency) {
      fx = fxMap.get(`${holding.currency}->${reportingCurrency}`) ?? null;
    }

    const valuation = computeMarketValue(holding, quote, fx, reportingCurrency);
    perAsset.push(valuation);
    totalValue = totalValue.plus(valuation.valueReporting);
    totalCostBasis = totalCostBasis.plus(valuation.costBasisReporting);
  }

  const totalUnrealizedPnL = totalValue.minus(totalCostBasis);
  const totalUnrealizedPnLPercent = totalCostBasis.isZero()
    ? new Decimal(0)
    : totalUnrealizedPnL.dividedBy(totalCostBasis).times(100);

  return {
    portfolioId,
    reportingCurrency,
    totalValue,
    totalCostBasis,
    totalUnrealizedPnL,
    totalUnrealizedPnLPercent,
    perAsset,
    computedAt: new Date().toISOString(),
  };
};
