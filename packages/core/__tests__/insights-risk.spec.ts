/**
 * insights/risk property + example tests.
 * Maps to .specify/feature-specs/stage-3/insights-enrichment-stage-3.md (#11 + 回撤).
 */

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import Decimal from "decimal.js";

import {
  maxDrawdown,
  annualizedVolatility,
  volatilityFromReturns,
  flowFreeReturns,
  flowFreeGrowthIndex,
  beta,
  type ReturnPair,
} from "../src/insights/risk";

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

describe("flowFreeReturns", () => {
  it("drops the funding-day observation that annualizedVolatility treats as a return", () => {
    // Flat 100, then a +900 deposit lands (value 1000), then flat. The jump day is
    // a flow → dropped; remaining days are flat → zero volatility.
    const values = series([100, 100, 1000, 1000]);
    const flows = series([0, 0, 900, 0]);
    const r = flowFreeReturns(values, flows);
    expect(r.every((x) => x.isZero())).toBe(true);
    expect(volatilityFromReturns(r, 252).isZero()).toBe(true);
    // The contaminated raw path is wildly larger.
    expect(annualizedVolatility(values, 252).greaterThan(0)).toBe(true);
  });

  it("drops a SELL day too (does not register as a market loss)", () => {
    // 1000 → withdraw 400 (600) → +10% market. Only the last day survives.
    const r = flowFreeReturns(series([1000, 600, 660]), series([0, -400, 0]));
    expect(r).toHaveLength(1);
    expect(r[0]!.minus(dec("0.1")).abs().lessThan("1e-18")).toBe(true);
  });

  it("keeps flow-free market moves", () => {
    const r = flowFreeReturns(series([100, 110, 121]), series([0, 0, 0]));
    expect(r.map((x) => x.toFixed(2))).toEqual(["0.10", "0.10"]);
  });

  it("skips non-positive prior-value bases", () => {
    expect(flowFreeReturns(series([0, 100, 110]), series([0, 0, 0]))).toHaveLength(1);
  });
});

describe("flowFreeGrowthIndex", () => {
  it("holds flat across a flow day so drawdown ignores the funding spike", () => {
    // 100 → +100 deposit (200) → −30% market (140). The deposit day is flat (×1);
    // only the real 30% fall shows in the drawdown.
    const idx = flowFreeGrowthIndex(series([100, 200, 140]), series([0, 100, 0]));
    expect(idx).toHaveLength(3);
    expect(maxDrawdown(idx).minus(dec("0.3")).abs().lessThan("1e-12")).toBe(true);
  });

  it("compounds flow-free returns into a growth-of-1 series", () => {
    const idx = flowFreeGrowthIndex(series([100, 110, 99]), series([0, 0, 0]));
    expect(idx[0]!.equals(1)).toBe(true);
    expect(idx[2]!.minus(dec("0.99")).abs().lessThan("1e-12")).toBe(true); // 1×1.1×0.9
  });
});

describe("beta", () => {
  const pair = (p: number, b: number): ReturnPair => ({ portfolio: dec(p), benchmark: dec(b) });

  it("null for < 2 pairs or zero benchmark variance", () => {
    expect(beta([])).toBeNull();
    expect(beta([pair(0.01, 0.02)])).toBeNull();
    expect(beta([pair(0.01, 0.05), pair(0.02, 0.05)])).toBeNull(); // benchmark constant
  });

  it("β = 1 when portfolio tracks the benchmark exactly", () => {
    const pairs = [pair(0.01, 0.01), pair(-0.02, -0.02), pair(0.03, 0.03)];
    expect(beta(pairs)!.minus(1).abs().lessThan("1e-18")).toBe(true);
  });

  it("β = 2 when the portfolio amplifies the benchmark 2×", () => {
    const pairs = [pair(0.02, 0.01), pair(-0.04, -0.02), pair(0.06, 0.03)];
    expect(beta(pairs)!.minus(2).abs().lessThan("1e-12")).toBe(true);
  });

  it("negative β for inverse co-movement", () => {
    const pairs = [pair(-0.01, 0.01), pair(0.02, -0.02), pair(-0.03, 0.03)];
    expect(beta(pairs)!.lessThan(0)).toBe(true);
  });
});
