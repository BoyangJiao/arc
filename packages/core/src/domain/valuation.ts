/**
 * valuation — 把 Holdings + 价格 + 汇率合成报告币种估值
 *
 * CLAUDE.md §3.2.4 / §3.2.5 约束：
 * - 永远不预先换算存储
 * - 每次估值都重算
 * - 当前估值用最新价 + 最新汇率；历史估值用对应时点的快照
 */

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
 * @stub Stage 1 实施
 */
export const computeMarketValue = (
  _holding: Holding,
  _quote: PriceQuote,
  _fx: FxRate | null,
  _reportingCurrency: Currency,
): MarketValuation => {
  throw new Error("computeMarketValue: not yet implemented (Stage 1 task)");
};

/**
 * computePortfolioValuation — 整个组合的估值汇总
 *
 * @stub Stage 1 实施
 */
export const computePortfolioValuation = (
  _portfolioId: string,
  _holdings: ReadonlyArray<Holding>,
  _quotes: ReadonlyArray<PriceQuote>,
  _fxRates: ReadonlyArray<FxRate>,
  _reportingCurrency: Currency,
): PortfolioValuation => {
  throw new Error("computePortfolioValuation: not yet implemented (Stage 1 task)");
};
