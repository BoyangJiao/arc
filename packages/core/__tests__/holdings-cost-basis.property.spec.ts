/**
 * Property tests — cost-basis return (ADR 016 appendix A).
 */

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import Decimal from "decimal.js";

import { computeHoldings } from "../src/domain/holdings";
import type { Currency, Transaction } from "../src/domain/types";

const dec = (n: number): Decimal => new Decimal(n);

const mkBuy = (
  shares: number,
  price: number,
  dayOffset: number,
  currency: Currency = "CNY"
): Transaction => ({
  id: `tx-buy-${dayOffset}-${shares}`,
  portfolioId: "p-1",
  assetId: "FUND:TEST",
  type: "BUY",
  shares: dec(shares),
  pricePerShare: dec(price),
  currency,
  fee: dec(0),
  tradeDate: new Date(Date.UTC(2026, 0, 1 + dayOffset)).toISOString(),
});

describe("cost-basis return property (ADR 016 appendix A)", () => {
  it("return = (shares × currentPrice - Σ buy cost) / Σ buy cost", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            shares: fc.double({ min: 0.01, max: 500, noNaN: true }),
            price: fc.double({ min: 0.01, max: 500, noNaN: true }),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        fc.double({ min: 0.01, max: 500, noNaN: true }),
        (buys, currentPrice) => {
          const txs = buys.map((b, i) => mkBuy(b.shares, b.price, i));
          const [h] = computeHoldings(txs);
          const expectedCost = buys.reduce(
            (acc, b) => acc.plus(dec(b.shares).times(b.price)),
            dec(0)
          );
          const expectedShares = buys.reduce((acc, b) => acc.plus(b.shares), dec(0));
          const currentValue = expectedShares.times(currentPrice);
          const expectedReturn = currentValue.minus(expectedCost).dividedBy(expectedCost);
          const actualReturn = currentValue.minus(h.totalCostBasis).dividedBy(h.totalCostBasis);
          expect(actualReturn.minus(expectedReturn).abs().toNumber()).toBeLessThan(1e-8);
        }
      )
    );
  });
});
