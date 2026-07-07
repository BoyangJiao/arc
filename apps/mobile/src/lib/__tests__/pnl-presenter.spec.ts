/**
 * pnl-presenter — cumulative 盈亏 summary (Insights 盈亏分析 §J18c / AC.1.1).
 *
 * Verifies the cumulative card closes with the holdings-row formula, including
 * cross-currency dividends valued at the per-asset reporting FX.
 */

import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import type { Holding, MarketValuation, PortfolioValuation } from "@arc/core";

import { buildCumulativePnlSummary } from "../pnl-presenter";

const dec = (n: number | string): Decimal => new Decimal(n);

const mkMarketValuation = (
  over: Partial<MarketValuation> & { assetId: string }
): MarketValuation => ({
  shares: dec(1),
  priceNative: dec(1),
  valueNative: dec(1),
  nativeCurrency: "CNY",
  valueReporting: dec(1),
  costBasisReporting: dec(1),
  unrealizedPnL: dec(0),
  unrealizedPnLPercent: dec(0),
  dailyChangePercent: null,
  reportingCurrency: "CNY",
  fxRateUsed: dec(1),
  priceAsOf: "2026-05-01T00:00:00.000Z",
  fxAsOf: "2026-05-01T00:00:00.000Z",
  ...over,
});

const mkHolding = (over: Partial<Holding> & { assetId: string }): Holding => ({
  shares: dec(1),
  averageCost: dec(1),
  totalCostBasis: dec(1),
  realizedPnL: dec(0),
  totalDividends: dec(0),
  portfolioId: "p-1",
  currency: "CNY",
  ...over,
});

describe("buildCumulativePnlSummary", () => {
  it("holdingReturn = totalValue − totalInvested + Σ dividends", () => {
    const valuation: PortfolioValuation = {
      portfolioId: "p-1",
      reportingCurrency: "CNY",
      totalValue: dec("176036.44"),
      totalCostBasis: dec("119288.26"),
      totalUnrealizedPnL: dec("56748.18"),
      totalUnrealizedPnLPercent: dec(0),
      perAsset: [mkMarketValuation({ assetId: "FUND:506002", fxRateUsed: dec(1) })],
      missingQuoteAssetIds: [],
      missingFxAssetIds: [],
      computedAt: "2026-05-01T00:00:00.000Z",
    };
    const holdings = [mkHolding({ assetId: "FUND:506002", totalDividends: dec("45125") })];

    const summary = buildCumulativePnlSummary(valuation, holdings);
    // 176036.44 − 119288.26 + 45125 = 101873.18
    expect(summary.holdingReturn.toString()).toBe("101873.18");
    expect(summary.totalInvested.toString()).toBe("119288.26");
    expect(summary.totalValue.toString()).toBe("176036.44");
    expect(summary.holdingReturnPercent!.toFixed(2)).toBe("85.40");
  });

  it("values cross-currency dividends at the per-asset reporting FX", () => {
    const valuation: PortfolioValuation = {
      portfolioId: "p-1",
      reportingCurrency: "CNY",
      totalValue: dec("7200"),
      totalCostBasis: dec("7000"),
      totalUnrealizedPnL: dec("200"),
      totalUnrealizedPnLPercent: dec(0),
      perAsset: [
        mkMarketValuation({ assetId: "US:UBER", nativeCurrency: "USD", fxRateUsed: dec(7) }),
      ],
      missingQuoteAssetIds: [],
      missingFxAssetIds: [],
      computedAt: "2026-05-01T00:00:00.000Z",
    };
    // 10 USD dividends × 7 = 70 CNY
    const holdings = [mkHolding({ assetId: "US:UBER", currency: "USD", totalDividends: dec(10) })];

    const summary = buildCumulativePnlSummary(valuation, holdings);
    // 7200 − 7000 + 70 = 270
    expect(summary.holdingReturn.toString()).toBe("270");
  });

  it("returns null percent when nothing is invested", () => {
    const valuation: PortfolioValuation = {
      portfolioId: "p-1",
      reportingCurrency: "CNY",
      totalValue: dec(0),
      totalCostBasis: dec(0),
      totalUnrealizedPnL: dec(0),
      totalUnrealizedPnLPercent: dec(0),
      perAsset: [],
      missingQuoteAssetIds: [],
      missingFxAssetIds: [],
      computedAt: "2026-05-01T00:00:00.000Z",
    };
    const summary = buildCumulativePnlSummary(valuation, []);
    expect(summary.holdingReturnPercent).toBeNull();
    expect(summary.holdingReturn.toString()).toBe("0");
  });
});
