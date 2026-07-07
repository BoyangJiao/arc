import Decimal from "decimal.js";

export interface PeriodChange {
  readonly delta: Decimal;
  readonly percent: Decimal | null;
}

/** First non-zero chart Y — hero/scrub shared baseline (ADR 016 §决策 1). */
export const firstNonZeroChartY = (
  chartData: ReadonlyArray<{ readonly y: number }>
): number | null => {
  for (const point of chartData) {
    if (point.y !== 0) return point.y;
  }
  return null;
};

/** Period change vs an explicit baseline (reporting currency). */
export const computePeriodChangeFromBaseline = (
  value: Decimal,
  baseline: Decimal | null
): PeriodChange | null => {
  if (baseline === null || baseline.isZero()) return null;
  const delta = value.minus(baseline);
  return { delta, percent: delta.div(baseline).mul(100) };
};

/** Period change vs range start — used when scrubbing portfolio NAV chart. */
export const computePeriodChange = (value: number, periodStart: number): PeriodChange => {
  const v = new Decimal(value);
  const start = new Decimal(periodStart);
  const delta = v.minus(start);
  if (start.isZero()) {
    return { delta, percent: null };
  }
  return { delta, percent: delta.div(start).mul(100) };
};
