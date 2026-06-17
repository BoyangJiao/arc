/**
 * insights/risk property + example tests.
 * Maps to .specify/feature-specs/stage-3/insights-enrichment-stage-3.md (#11 + 回撤).
 */

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import Decimal from "decimal.js";

import { maxDrawdown, annualizedVolatility } from "../src/insights/risk";

const dec = (n: number | string): Decimal => new Decimal(n);
const series = (ns: ReadonlyArray<number>): Decimal[] => ns.map(dec);

describe("maxDrawdown", () => {
  it("empty / single → 0", () => {
    expect(maxDrawdown([]).isZero()).toBe(true);
    expect(maxDrawdown(series([100])).isZero()).toBe(true);
  });

  it("monotonic increasing → 0", () => {
    expect(maxDrawdown(series([10, 20, 30, 40])).isZero()).toBe(true);
  });

  it("known peak→trough decline", () => {
    // peak 100 → trough 60 = 40% drawdown (later recovery doesn't reduce it)
    expect(maxDrawdown(series([100, 80, 60, 90])).equals(dec("0.4"))).toBe(true);
  });

  it("uses the highest peak before the trough", () => {
    // 50→100 (peak) →25 = 75%
    expect(maxDrawdown(series([50, 100, 25, 80])).equals(dec("0.75"))).toBe(true);
  });

  it("property: result always in [0, 1] for positive series", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 1_000_000 }), { minLength: 1, maxLength: 50 }),
        (ns) => {
          const dd = maxDrawdown(series(ns));
          expect(dd.greaterThanOrEqualTo(0) && dd.lessThanOrEqualTo(1)).toBe(true);
        }
      )
    );
  });
});

describe("annualizedVolatility", () => {
  it("< 2 returns → 0", () => {
    expect(annualizedVolatility(series([100]), 252).isZero()).toBe(true);
    expect(annualizedVolatility(series([100, 110]), 252).isZero()).toBe(true);
  });

  it("constant series → 0 volatility", () => {
    expect(annualizedVolatility(series([100, 100, 100, 100]), 252).isZero()).toBe(true);
  });

  it("property: non-negative", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 1_000_000 }), { minLength: 1, maxLength: 50 }),
        (ns) => {
          expect(annualizedVolatility(series(ns), 252).greaterThanOrEqualTo(0)).toBe(true);
        }
      )
    );
  });

  it("annualization scales by sqrt(periodsPerYear)", () => {
    const v = series([100, 110, 100, 110, 100, 110]);
    const daily = annualizedVolatility(v, 1);
    const annual = annualizedVolatility(v, 252);
    // annual ≈ daily × sqrt(252)
    expect(annual.dividedBy(daily).minus(new Decimal(252).sqrt()).abs().lessThan("1e-12")).toBe(
      true
    );
  });
});
