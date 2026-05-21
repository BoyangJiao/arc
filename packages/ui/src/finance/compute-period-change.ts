import Decimal from "decimal.js";

export interface PeriodChange {
  readonly delta: Decimal;
  readonly percent: Decimal | null;
}

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
