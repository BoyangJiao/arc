/**
 * XIRR (MWR) unit tests (Stage 3 Block D — TWR spec commit #3).
 *
 * Maps to .specify/feature-specs/stage-3/twr-stage-3.md §S3-AC-D.1.7
 * (convergence within 100 iterations) + §S3-AC-D.1.8 (degenerate input
 * throws ConvergenceError, not NaN). Property tests live in commit #4.
 */

import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";

import { ConvergenceError } from "../src/returns/errors";
import { computeMwr } from "../src/returns/xirr";

const dec = (n: number | string): Decimal => new Decimal(n);
const d = (iso: string): Date => new Date(iso);

describe("computeMwr", () => {
  it("closed-form two-flow: -1000 @ Y0, +1100 @ Y1 → IRR = 10%", () => {
    const result = computeMwr([
      { date: d("2026-01-01T00:00:00.000Z"), amount: dec(-1000) },
      { date: d("2027-01-01T00:00:00.000Z"), amount: dec(1100) },
    ]);
    expect(result.converged).toBe(true);
    expect(result.iterations).toBeLessThan(100);
    expect(result.value.minus("0.1").abs().lt("1e-6")).toBe(true);
  });

  it("three-flow scenario converges to a positive IRR in the expected band", () => {
    // -10000 @ Y0; +3000 @ Y1; +8000 @ Y2 — closed-form IRR is around 4.4%.
    const result = computeMwr([
      { date: d("2026-01-01T00:00:00.000Z"), amount: dec(-10000) },
      { date: d("2027-01-01T00:00:00.000Z"), amount: dec(3000) },
      { date: d("2028-01-01T00:00:00.000Z"), amount: dec(8000) },
    ]);
    expect(result.converged).toBe(true);
    expect(result.iterations).toBeLessThan(100);
    // Sanity: -10000 + 3000/(1.044) + 8000/(1.044^2) ≈ 0
    expect(result.value.gt("0.03")).toBe(true);
    expect(result.value.lt("0.06")).toBe(true);
  });

  it("S3-AC-D.1.7: Newton-Raphson converges within ≤ 100 iterations for realistic input", () => {
    // Mixed deposit + withdrawal + terminal liquidation, ~3 years.
    const result = computeMwr([
      { date: d("2024-01-01T00:00:00.000Z"), amount: dec(-5000) },
      { date: d("2024-07-15T00:00:00.000Z"), amount: dec(-2500) },
      { date: d("2025-03-10T00:00:00.000Z"), amount: dec(1500) },
      { date: d("2025-12-20T00:00:00.000Z"), amount: dec(-1000) },
      { date: d("2026-12-31T00:00:00.000Z"), amount: dec(8500) },
    ]);
    expect(result.converged).toBe(true);
    expect(result.iterations).toBeLessThanOrEqual(100);
    // IRR exists and is finite (won't bother nailing the exact value here —
    // the property tests in commit #4 will hit invariants on this class).
    expect(result.value.isFinite()).toBe(true);
  });

  it("S3-AC-D.1.8: all cash flows on the same day throws ConvergenceError (no NaN escape)", () => {
    expect(() =>
      computeMwr([
        { date: d("2026-06-15T00:00:00.000Z"), amount: dec(-1000) },
        { date: d("2026-06-15T00:00:00.000Z"), amount: dec(500) },
        { date: d("2026-06-15T00:00:00.000Z"), amount: dec(500) },
      ])
    ).toThrow(ConvergenceError);
  });

  it("empty cash flows throws ConvergenceError (input validation)", () => {
    expect(() => computeMwr([])).toThrow(ConvergenceError);
  });
});
