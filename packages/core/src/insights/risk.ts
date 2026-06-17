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
 * annualizedVolatility — annualized standard deviation of period returns, as a
 * fraction (0.18 = 18%). Uses sample variance (n−1). `periodsPerYear` is the
 * annualization factor (≈252 for daily EOD snapshots). Returns 0 if < 2 returns.
 */
export const annualizedVolatility = (
  values: ReadonlyArray<Decimal>,
  periodsPerYear: number
): Decimal => {
  const returns = periodReturns(values);
  if (returns.length < 2) return new Decimal(0);
  const mean = returns.reduce((s, r) => s.plus(r), new Decimal(0)).dividedBy(returns.length);
  const variance = returns
    .reduce((s, r) => s.plus(r.minus(mean).pow(2)), new Decimal(0))
    .dividedBy(returns.length - 1);
  return variance.sqrt().times(new Decimal(periodsPerYear).sqrt());
};
