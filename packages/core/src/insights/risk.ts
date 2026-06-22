/**
 * insights/risk — portfolio risk metrics from the value series (Insights #11 + 回撤).
 *
 * Pure functions, Decimal everywhere (宪法 §3.1). Inputs are the ordered
 * portfolio total-value snapshots (EOD). These are point-in-time *historical*
 * measures — "仅供参考，基于历史波动" (宪法 §二, no forward-looking claims).
 *
 * Beta (vs a benchmark) is intentionally NOT here yet — it needs a benchmark
 * index series (data-source adapter), tracked separately.
 */

import Decimal from "decimal.js";

/** Simple period-over-period returns from an ordered value series (skips zero pivots). */
const periodReturns = (values: ReadonlyArray<Decimal>): Decimal[] => {
  const out: Decimal[] = [];
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1]!;
    if (prev.isZero()) continue;
    out.push(values[i]!.dividedBy(prev).minus(1));
  }
  return out;
};

/**
 * maxDrawdown — largest peak-to-trough decline over the series, as a POSITIVE
 * fraction (0.25 = a 25% drawdown). Returns 0 for empty / monotonic-up series.
 */
export const maxDrawdown = (values: ReadonlyArray<Decimal>): Decimal => {
  let peak: Decimal | null = null;
  let maxDd = new Decimal(0);
  for (const v of values) {
    if (peak === null || v.greaterThan(peak)) peak = v;
    if (peak.greaterThan(0)) {
      const dd = peak.minus(v).dividedBy(peak);
      if (dd.greaterThan(maxDd)) maxDd = dd;
    }
  }
  return maxDd;
};

/**
 * volatilityFromReturns — annualized standard deviation of an ALREADY-COMPUTED
 * return series, as a fraction (0.18 = 18%). Sample variance (n−1), scaled by
 * √periodsPerYear (≈252 for daily). Returns 0 if < 2 returns.
 *
 * Use this when the returns are cash-flow-adjusted (see cashFlowAdjustedReturns)
 * so deposits/buys/sells don't masquerade as market moves; raw totalValue ratios
 * (annualizedVolatility) inflate volatility by every funding event.
 */
export const volatilityFromReturns = (
  returns: ReadonlyArray<Decimal>,
  periodsPerYear: number
): Decimal => {
  if (returns.length < 2) return new Decimal(0);
  const mean = returns.reduce((s, r) => s.plus(r), new Decimal(0)).dividedBy(returns.length);
  const variance = returns
    .reduce((s, r) => s.plus(r.minus(mean).pow(2)), new Decimal(0))
    .dividedBy(returns.length - 1);
  return variance.sqrt().times(new Decimal(periodsPerYear).sqrt());
};

/**
 * annualizedVolatility — annualized standard deviation of the period returns of
 * a raw value series. NOTE: contaminated by external cash flows (a buy/deposit
 * looks like a one-day return). Prefer cashFlowAdjustedReturns + volatilityFromReturns
 * for portfolio/asset value series that include trading activity.
 */
export const annualizedVolatility = (
  values: ReadonlyArray<Decimal>,
  periodsPerYear: number
): Decimal => volatilityFromReturns(periodReturns(values), periodsPerYear);

const hasFlow = (flow: Decimal | undefined): boolean => flow !== undefined && !flow.isZero();

/**
 * flowFreeReturns — daily market returns, EXCLUDING any day with an external
 * cash flow (a buy/sell/deposit), so only price movement feeds risk metrics
 * (volatility, beta — 宪法 §3.1 / §二 no false signals).
 *
 * `values[i]` = EOD total value at point i (reporting currency). `flows[i]` =
 * net trade flow during the period ending at point i; a non-zero flow drops that
 * day's observation. We DROP rather than strip (`value − flow`) because Arc
 * allows back-dated / imported / duplicate transactions (Block C decision 8), so
 * the value series may not jump by exactly the recorded flow — stripping a flow
 * the value never reflected reintroduces a spike. Days with a non-positive prior
 * value are also skipped. Returns length ≤ values.length − 1.
 */
export const flowFreeReturns = (
  values: ReadonlyArray<Decimal>,
  flows: ReadonlyArray<Decimal>
): Decimal[] => {
  const out: Decimal[] = [];
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1]!;
    if (prev.lessThanOrEqualTo(0)) continue;
    if (hasFlow(flows[i])) continue;
    out.push(values[i]!.dividedBy(prev).minus(1));
  }
  return out;
};

/**
 * flowFreeGrowthIndex — "growth of 1" series for drawdown, compounding the
 * flow-free daily returns and holding flat (× 1) across flow days / non-positive
 * bases so the curve stays continuous (a funding event neither helps nor hurts
 * the drawdown). Length === values.length, index-aligned with the value series.
 */
export const flowFreeGrowthIndex = (
  values: ReadonlyArray<Decimal>,
  flows: ReadonlyArray<Decimal>
): Decimal[] => {
  const out: Decimal[] = [new Decimal(1)];
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1]!;
    const r =
      prev.greaterThan(0) && !hasFlow(flows[i])
        ? values[i]!.dividedBy(prev).minus(1)
        : new Decimal(0);
    out.push(out[out.length - 1]!.times(new Decimal(1).plus(r)));
  }
  return out;
};

/** A same-period portfolio return paired with a benchmark return (for beta). */
export interface ReturnPair {
  readonly portfolio: Decimal;
  readonly benchmark: Decimal;
}

/**
 * beta — sensitivity of the portfolio's returns to a benchmark's returns,
 * `Cov(rp, rb) / Var(rb)` over same-period paired returns (sample n−1). β = 1
 * moves with the benchmark, < 1 dampened, > 1 amplified, < 0 inverse. Historical,
 * for-reference (宪法 §二 — not a forecast).
 *
 * Returns `null` when there are < 2 pairs or the benchmark has zero variance
 * (β undefined). Pair the portfolio's flow-free returns (flowFreeReturns) with
 * the benchmark's price returns over the SAME windows; per #9 the portfolio side
 * is reporting-currency and the benchmark side is its own-currency price return.
 */
export const beta = (pairs: ReadonlyArray<ReturnPair>): Decimal | null => {
  if (pairs.length < 2) return null;
  const n = pairs.length;
  const zero = new Decimal(0);
  const meanP = pairs.reduce((s, p) => s.plus(p.portfolio), zero).dividedBy(n);
  const meanB = pairs.reduce((s, p) => s.plus(p.benchmark), zero).dividedBy(n);
  let cov = zero;
  let varB = zero;
  for (const p of pairs) {
    const db = p.benchmark.minus(meanB);
    cov = cov.plus(p.portfolio.minus(meanP).times(db));
    varB = varB.plus(db.pow(2));
  }
  if (varB.isZero()) return null;
  return cov.dividedBy(varB); // (n−1) cancels in the ratio
};
