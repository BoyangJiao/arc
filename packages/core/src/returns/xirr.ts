/**
 * @arc/core/returns/xirr — Money-Weighted Return via Newton-Raphson XIRR
 * (Stage 3 Block D — TWR spec commit #3).
 *
 * Spec: .specify/feature-specs/stage-3/twr-stage-3.md §决策 1, 7.
 *
 * NPV at rate r:
 *     NPV(r) = Σ CF_i × (1 + r) ^ (-d_i / 365)
 * where d_i is the day offset of CF_i from the reference date (the first
 * cash flow). Newton-Raphson:
 *     r_{n+1} = r_n - NPV(r_n) / NPV'(r_n)
 * stops when |NPV(r_n)| < tolerance × max(1, Σ|CF_i|) — the tolerance is
 * scaled by total flow magnitude so convergence is scale-invariant (a
 * ¥10,000,000 portfolio converges as readily as a ¥100 one) — or throws
 * ConvergenceError on iteration cap, derivative collapse, or pathological
 * input.
 *
 * Pure: zero I/O. decimal.js handles fractional exponents via `.pow()`.
 */

import Decimal from "decimal.js";

import { ConvergenceError } from "./errors";
import type { MwrResult } from "./types";

const DAYS_PER_YEAR = 365;
const DEFAULT_INITIAL_GUESS = new Decimal("0.1");
const DEFAULT_MAX_ITERATIONS = 100;
const DEFAULT_TOLERANCE = new Decimal("1e-9");

export interface MwrOptions {
  readonly initialGuess?: Decimal;
  readonly maxIterations?: number;
  readonly tolerance?: Decimal;
}

interface NpvParts {
  readonly npv: Decimal;
  readonly dnpv: Decimal;
}

const npvAndDerivative = (
  flows: ReadonlyArray<{ readonly dayOffset: Decimal; readonly amount: Decimal }>,
  r: Decimal
): NpvParts => {
  // (1 + r). If r ≤ -1, the base is non-positive and Decimal.pow misbehaves
  // for fractional exponents — Newton-Raphson should never visit r ≤ -1 in
  // a well-posed problem; surface this as derivative collapse instead.
  const onePlusR = new Decimal(1).plus(r);
  if (onePlusR.lte(0)) {
    return { npv: new Decimal(0), dnpv: new Decimal(0) };
  }

  let npv = new Decimal(0);
  let dnpv = new Decimal(0);
  for (const flow of flows) {
    const exponent = flow.dayOffset.div(DAYS_PER_YEAR).negated();
    // (1+r) ^ exponent
    const factor = onePlusR.pow(exponent);
    npv = npv.plus(flow.amount.times(factor));
    // d/dr (CF × (1+r)^exponent) = CF × exponent × (1+r)^(exponent - 1)
    const dFactor = factor.times(exponent).div(onePlusR);
    dnpv = dnpv.plus(flow.amount.times(dFactor));
  }
  return { npv, dnpv };
};

export const computeMwr = (
  cashFlows: ReadonlyArray<{ readonly date: Date; readonly amount: Decimal }>,
  options?: MwrOptions
): MwrResult => {
  if (cashFlows.length === 0) {
    throw new ConvergenceError("XIRR requires at least one cash flow", {
      reason: "empty-input",
    });
  }

  const initialGuess = options?.initialGuess ?? DEFAULT_INITIAL_GUESS;
  const maxIterations = options?.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const tolerance = options?.tolerance ?? DEFAULT_TOLERANCE;

  // Normalize: dayOffset relative to earliest cash flow.
  const refMs = cashFlows.reduce(
    (min, cf) => Math.min(min, cf.date.getTime()),
    cashFlows[0]!.date.getTime()
  );
  const flows = cashFlows.map((cf) => ({
    dayOffset: new Decimal(cf.date.getTime() - refMs).div(86_400_000),
    amount: cf.amount,
  }));

  // Spread check: if every CF is on the reference date, no IRR is defined.
  const sameDateOnly = flows.every((f) => f.dayOffset.isZero());
  if (sameDateOnly) {
    throw new ConvergenceError("XIRR undefined: all cash flows fall on the same date", {
      reason: "zero-spread",
      flowCount: flows.length,
    });
  }

  // Damping floor — Newton-Raphson can overshoot to r ≤ -1 (singularity of
  // (1+r)^x for fractional x). When that happens, take a damped step halfway
  // toward DAMP_FLOOR instead, keeping r safely above -1 while still moving
  // in the indicated direction. Discovered by property test X1: counterexample
  // r = -0.45 from initialGuess 0.1 had its first NR step land at r = -1.0
  // exactly, falsely triggering "derivative collapsed".
  const DAMP_FLOOR = new Decimal("-0.999");

  // Scale-invariant convergence threshold: tolerance × max(1, Σ|CF|).
  // An absolute 1e-9 on NPV is scale-dependent — needlessly strict for large
  // portfolios (can exhaust iterations on precision noise) and meaninglessly
  // loose for tiny ones.
  const flowMagnitude = flows.reduce((acc, f) => acc.plus(f.amount.abs()), new Decimal(0));
  const threshold = tolerance.times(Decimal.max(1, flowMagnitude));

  let r = initialGuess;
  for (let i = 0; i < maxIterations; i++) {
    const { npv, dnpv } = npvAndDerivative(flows, r);
    if (npv.abs().lt(threshold)) {
      return { value: r, iterations: i, converged: true };
    }
    if (dnpv.isZero()) {
      throw new ConvergenceError("XIRR derivative collapsed to zero — degenerate cash-flow shape", {
        reason: "zero-derivative",
        iteration: i,
        rate: r.toString(),
      });
    }
    let next = r.minus(npv.div(dnpv));
    if (next.lte(-1)) {
      next = r.plus(DAMP_FLOOR).div(2);
    }
    r = next;
  }
  throw new ConvergenceError(`XIRR did not converge within ${maxIterations} iterations`, {
    reason: "iteration-cap",
    maxIterations,
    lastRate: r.toString(),
  });
};
