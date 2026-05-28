/**
 * Unit tests for computeHoldings — core financial calculation function.
 *
 * Enforces CLAUDE.md §3.1 (all amounts via Decimal) and §3.2 (data model invariants).
 */

import { describe, test, expect } from "vitest";
import Decimal from "decimal.js";
import { computeHoldings } from "../src/domain/holdings";
import type { Transaction } from "../src/domain/types";

/** Helper: create a BUY transaction */
const makeBuy = (
  shares: string | number,
  price: string | number,
  opts?: Partial<Transaction>
): Transaction => ({
  id: `tx-${Math.random().toString(36).slice(2)}`,
  portfolioId: "p-1",
  assetId: "US:AAPL",
  type: "BUY",
  shares: new Decimal(shares),
  pricePerShare: new Decimal(price),
  currency: "USD",
  fee: new Decimal(0),
  tradeDate: "2026-01-01T10:00:00Z",
  ...opts,
});

/** Helper: create a SELL transaction */
const makeSell = (
  shares: string | number,
  price: string | number,
  opts?: Partial<Transaction>
): Transaction => ({
  id: `tx-${Math.random().toString(36).slice(2)}`,
  portfolioId: "p-1",
  assetId: "US:AAPL",
  type: "SELL",
  shares: new Decimal(shares),
  pricePerShare: new Decimal(price),
  currency: "USD",
  fee: new Decimal(0),
  tradeDate: "2026-02-01T10:00:00Z",
  ...opts,
});

/** Helper: create a DIVIDEND transaction */
const makeDividend = (
  shares: string | number,
  perShare: string | number,
  opts?: Partial<Transaction>
): Transaction => ({
  id: `tx-${Math.random().toString(36).slice(2)}`,
  portfolioId: "p-1",
  assetId: "US:AAPL",
  type: "DIVIDEND",
  shares: new Decimal(shares),
  pricePerShare: new Decimal(perShare),
  currency: "USD",
  fee: new Decimal(0),
  tradeDate: "2026-03-01T10:00:00Z",
  ...opts,
});

/** Helper: create a SPLIT transaction */
const makeSplit = (splitRatio: string | number, opts?: Partial<Transaction>): Transaction => ({
  id: `tx-${Math.random().toString(36).slice(2)}`,
  portfolioId: "p-1",
  assetId: "US:AAPL",
  type: "SPLIT",
  shares: new Decimal(1), // shares field not used for split
  pricePerShare: new Decimal(splitRatio), // splitRatio stored in pricePerShare
  currency: "USD",
  fee: new Decimal(0),
  tradeDate: "2026-04-01T10:00:00Z",
  ...opts,
});

describe("computeHoldings", () => {
  test("empty transaction list → empty holdings", () => {
    const result = computeHoldings([]);
    expect(result).toEqual([]);
  });

  test("single BUY → correct holding", () => {
    const txs = [makeBuy(10, "150")];
    const [h] = computeHoldings(txs);
    expect(h.shares.equals(new Decimal(10))).toBe(true);
    expect(h.averageCost.equals(new Decimal("150"))).toBe(true);
    expect(h.totalCostBasis.equals(new Decimal("1500"))).toBe(true);
    expect(h.realizedPnL.equals(new Decimal(0))).toBe(true);
    expect(h.totalDividends.equals(new Decimal(0))).toBe(true);
  });

  test("multiple BUYs → weighted average cost", () => {
    const txs = [
      makeBuy(10, "100"), // cost = 1000
      makeBuy(20, "130"), // cost = 2600
    ];
    const [h] = computeHoldings(txs);
    // totalShares = 30
    expect(h.shares.equals(new Decimal(30))).toBe(true);
    // averageCost = (10×100 + 20×130) / 30 = 3600 / 30 = 120
    expect(h.averageCost.equals(new Decimal(120))).toBe(true);
    // totalCostBasis = 1000 + 2600 = 3600
    expect(h.totalCostBasis.equals(new Decimal("3600"))).toBe(true);
  });

  test("BUY + SELL → realized PnL calculated correctly", () => {
    const txs = [
      makeBuy(100, "50"), // Buy 100 @ $50, avgCost = 50
      makeSell(40, "70"), // Sell 40 @ $70, profit = 40 × (70-50) = 800
    ];
    const [h] = computeHoldings(txs);
    expect(h.shares.equals(new Decimal(60))).toBe(true);
    expect(h.averageCost.equals(new Decimal(50))).toBe(true);
    expect(h.realizedPnL.equals(new Decimal(800))).toBe(true);
    // totalCostBasis = 5000 - 40×50 = 5000 - 2000 = 3000
    expect(h.totalCostBasis.equals(new Decimal(3000))).toBe(true);
  });

  test("BUY + SELL at loss → negative realized PnL", () => {
    const txs = [
      makeBuy(50, "200"), // Buy 50 @ $200
      makeSell(20, "150"), // Sell 20 @ $150, loss = 20 × (150-200) = -1000
    ];
    const [h] = computeHoldings(txs);
    expect(h.shares.equals(new Decimal(30))).toBe(true);
    expect(h.realizedPnL.equals(new Decimal(-1000))).toBe(true);
  });

  test("SPLIT → shares multiply, averageCost divides", () => {
    const txs = [
      makeBuy(100, "200"), // 100 shares @ $200, totalCost = $20000
      makeSplit(2), // 1:2 split
    ];
    const [h] = computeHoldings(txs);
    // shares doubled
    expect(h.shares.equals(new Decimal(200))).toBe(true);
    // averageCost halved
    expect(h.averageCost.equals(new Decimal(100))).toBe(true);
    // totalCostBasis unchanged
    expect(h.totalCostBasis.equals(new Decimal("20000"))).toBe(true);
  });

  test("DIVIDEND → accumulates totalDividends without affecting shares", () => {
    const txs = [
      makeBuy(100, "50"), // 100 shares @ $50
      makeDividend(100, "0.50"), // $0.50/share × 100 = $50
      makeDividend(100, "0.75"), // $0.75/share × 100 = $75
    ];
    const [h] = computeHoldings(txs);
    // shares unaffected
    expect(h.shares.equals(new Decimal(100))).toBe(true);
    // totalDividends = 50 + 75 = 125
    expect(h.totalDividends.equals(new Decimal(125))).toBe(true);
    // averageCost unchanged
    expect(h.averageCost.equals(new Decimal(50))).toBe(true);
  });

  test("SELL exceeding holding → throws clear error", () => {
    const txs = [makeBuy(10, "100"), makeSell(20, "120")];
    expect(() => computeHoldings(txs)).toThrow(/exceeds current holding/);
  });

  test("complete sell (shares → 0) removes from results", () => {
    const txs = [makeBuy(50, "100"), makeSell(50, "120")];
    const result = computeHoldings(txs);
    expect(result.length).toBe(0);
  });

  test("BUY with fee → totalCostBasis includes fee", () => {
    const txs = [makeBuy(10, "100", { fee: new Decimal("9.99") })];
    const [h] = computeHoldings(txs);
    // totalCostBasis = 10×100 + 9.99 = 1009.99
    expect(h.totalCostBasis.equals(new Decimal("1009.99"))).toBe(true);
    // averageCost doesn't include fee (it's pure price average)
    expect(h.averageCost.equals(new Decimal(100))).toBe(true);
  });

  test("multiple BUY accumulates cost basis (ADR 016 extreme example)", () => {
    const txs = [
      {
        ...makeBuy(1000, "2"),
        tradeDate: "2026-05-01T10:00:00Z",
      },
      makeBuy(5000, "2.5", { tradeDate: "2026-05-15T10:00:00Z" }),
    ];
    const [h] = computeHoldings(txs);
    expect(h.shares.equals(new Decimal(6000))).toBe(true);
    expect(h.totalCostBasis.equals(new Decimal("14500"))).toBe(true);
    expect(h.averageCost.equals(new Decimal("14500").div(6000))).toBe(true);
  });

  test("multiple assets in one portfolio", () => {
    const txs = [
      makeBuy(10, "150", { assetId: "US:AAPL" }),
      makeBuy(5, "2800", { assetId: "US:GOOG" }),
    ];
    const result = computeHoldings(txs);
    expect(result.length).toBe(2);

    const aapl = result.find((h) => h.assetId === "US:AAPL")!;
    const goog = result.find((h) => h.assetId === "US:GOOG")!;
    expect(aapl.shares.equals(new Decimal(10))).toBe(true);
    expect(goog.shares.equals(new Decimal(5))).toBe(true);
  });
});
