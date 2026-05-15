/**
 * Unit tests for computeMarketValue & computePortfolioValuation.
 *
 * Enforces CLAUDE.md §3.1 (Decimal) and §3.2.4 (currency never lost).
 */

import { describe, test, expect } from "vitest";
import Decimal from "decimal.js";
import { computeMarketValue, computePortfolioValuation } from "../src/domain/valuation";
import type { FxRate, Holding, PriceQuote } from "../src/domain/types";

/** Helper: create a Holding */
const makeHolding = (
  shares: string | number,
  avgCost: string | number,
  opts?: Partial<Holding>
): Holding => ({
  assetId: "US:AAPL",
  shares: new Decimal(shares),
  averageCost: new Decimal(avgCost),
  totalCostBasis: new Decimal(shares).times(new Decimal(avgCost)),
  realizedPnL: new Decimal(0),
  totalDividends: new Decimal(0),
  portfolioId: "p-1",
  currency: "USD",
  ...opts,
});

/** Helper: create a PriceQuote */
const makeQuote = (price: string | number, opts?: Partial<PriceQuote>): PriceQuote => ({
  assetId: "US:AAPL",
  price: new Decimal(price),
  currency: "USD",
  asOf: "2026-05-15T10:00:00Z",
  source: "test",
  ...opts,
});

/** Helper: create an FxRate */
const makeFx = (
  from: "CNY" | "HKD" | "USD",
  to: "CNY" | "HKD" | "USD",
  rate: string | number
): FxRate => ({
  from,
  to,
  rate: new Decimal(rate),
  asOf: "2026-05-15T10:00:00Z",
  source: "test",
});

describe("computeMarketValue", () => {
  test("same currency (fx=null) → fxRate=1", () => {
    const holding = makeHolding(100, "150");
    const quote = makeQuote("180");

    const v = computeMarketValue(holding, quote, null, "USD");

    // valueNative = 100 × 180 = 18000
    expect(v.valueNative.equals(new Decimal(18000))).toBe(true);
    // valueReporting = same as native (no FX)
    expect(v.valueReporting.equals(new Decimal(18000))).toBe(true);
    // costBasisReporting = 100 × 150 × 1 = 15000
    expect(v.costBasisReporting.equals(new Decimal(15000))).toBe(true);
    // unrealizedPnL = 18000 - 15000 = 3000
    expect(v.unrealizedPnL.equals(new Decimal(3000))).toBe(true);
    // unrealizedPnLPercent = 3000 / 15000 × 100 = 20
    expect(v.unrealizedPnLPercent.equals(new Decimal(20))).toBe(true);
    expect(v.fxRateUsed.equals(new Decimal(1))).toBe(true);
  });

  test("cross-currency with FX rate", () => {
    // US stock, reporting in CNY, USD→CNY = 7.2
    const holding = makeHolding(50, "100");
    const quote = makeQuote("120");
    const fx = makeFx("USD", "CNY", "7.2");

    const v = computeMarketValue(holding, quote, fx, "CNY");

    // valueNative = 50 × 120 = 6000 USD
    expect(v.valueNative.equals(new Decimal(6000))).toBe(true);
    // valueReporting = 6000 × 7.2 = 43200 CNY
    expect(v.valueReporting.equals(new Decimal(43200))).toBe(true);
    // costBasisReporting = 50 × 100 × 7.2 = 36000 CNY
    expect(v.costBasisReporting.equals(new Decimal(36000))).toBe(true);
    // unrealizedPnL = 43200 - 36000 = 7200
    expect(v.unrealizedPnL.equals(new Decimal(7200))).toBe(true);
    // unrealizedPnLPercent = 7200 / 36000 × 100 = 20%
    expect(v.unrealizedPnLPercent.equals(new Decimal(20))).toBe(true);
    expect(v.fxRateUsed.equals(new Decimal("7.2"))).toBe(true);
  });

  test("zero cost basis → unrealizedPnLPercent = 0", () => {
    const holding = makeHolding(0, "0", {
      shares: new Decimal(10),
      averageCost: new Decimal(0),
      totalCostBasis: new Decimal(0),
    });
    const quote = makeQuote("50");

    const v = computeMarketValue(holding, quote, null, "USD");

    expect(v.unrealizedPnLPercent.equals(new Decimal(0))).toBe(true);
  });
});

describe("computePortfolioValuation", () => {
  test("single holding, same currency → sums correctly", () => {
    const holdings = [makeHolding(100, "50")];
    const quotes = [makeQuote("60")];

    const pv = computePortfolioValuation("p-1", holdings, quotes, [], "USD");

    // totalValue = 100 × 60 = 6000
    expect(pv.totalValue.equals(new Decimal(6000))).toBe(true);
    // totalCostBasis = 100 × 50 = 5000
    expect(pv.totalCostBasis.equals(new Decimal(5000))).toBe(true);
    // totalUnrealizedPnL = 6000 - 5000 = 1000
    expect(pv.totalUnrealizedPnL.equals(new Decimal(1000))).toBe(true);
    // totalUnrealizedPnLPercent = 1000 / 5000 × 100 = 20
    expect(pv.totalUnrealizedPnLPercent.equals(new Decimal(20))).toBe(true);
    expect(pv.perAsset.length).toBe(1);
  });

  test("multi-currency portfolio → applies correct FX rates", () => {
    const holdings = [
      makeHolding(100, "150", { assetId: "US:AAPL", currency: "USD" }),
      makeHolding(200, "50", { assetId: "CN:600519", currency: "CNY" }),
    ];
    const quotes = [
      makeQuote("180", { assetId: "US:AAPL", currency: "USD" }),
      makeQuote("55", { assetId: "CN:600519", currency: "CNY" }),
    ];
    const fxRates = [makeFx("USD", "CNY", "7.2")];

    const pv = computePortfolioValuation("p-1", holdings, quotes, fxRates, "CNY");

    // AAPL: value = 100×180×7.2 = 129600, cost = 100×150×7.2 = 108000
    // CN:600519: value = 200×55×1 = 11000, cost = 200×50×1 = 10000
    // total value = 129600 + 11000 = 140600
    expect(pv.totalValue.equals(new Decimal(140600))).toBe(true);
    // total cost = 108000 + 10000 = 118000
    expect(pv.totalCostBasis.equals(new Decimal(118000))).toBe(true);
    expect(pv.perAsset.length).toBe(2);
  });

  test("missing quote → holding skipped, others still valued", () => {
    const holdings = [
      makeHolding(100, "50", { assetId: "US:AAPL" }),
      makeHolding(50, "100", { assetId: "US:GOOG" }),
    ];
    // Only provide quote for AAPL
    const quotes = [makeQuote("60", { assetId: "US:AAPL" })];

    const pv = computePortfolioValuation("p-1", holdings, quotes, [], "USD");

    // Only AAPL is valued
    expect(pv.perAsset.length).toBe(1);
    expect(pv.totalValue.equals(new Decimal(6000))).toBe(true);
  });

  test("empty holdings → zero totals", () => {
    const pv = computePortfolioValuation("p-1", [], [], [], "USD");

    expect(pv.totalValue.equals(new Decimal(0))).toBe(true);
    expect(pv.totalCostBasis.equals(new Decimal(0))).toBe(true);
    expect(pv.totalUnrealizedPnL.equals(new Decimal(0))).toBe(true);
    expect(pv.totalUnrealizedPnLPercent.equals(new Decimal(0))).toBe(true);
    expect(pv.perAsset.length).toBe(0);
  });
});
