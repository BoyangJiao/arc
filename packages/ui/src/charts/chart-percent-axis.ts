/**
 * chart-percent-axis — L2 helper for the cumulative-return % chart.
 *
 * Spec: .specify/feature-specs/stage-3/pnl-analysis-insights.md §UI (Commit 4).
 *
 * Anchors the cost-basis cumulative-return curve so its FIRST sample reads 0%
 * (visual Y-axis anchor, AC.1.5) and derives reference-line ticks (max / 0 /
 * min) with a top-down position fraction so the screen can overlay gridline
 * labels over a fixed-height chart. Pure + number-based (no Decimal) — the
 * mobile layer converts `ratio` (a fraction) before calling.
 */

import type { ChartPoint } from "./types";

export interface PercentAxisInput {
  /** Cumulative cost-basis return as a fraction (0.1 = +10%). */
  readonly ratio: number;
  readonly asOf?: string;
  readonly label?: string;
}

export interface PercentAxisTick {
  /** Tick value in percent (e.g. 0, 20, -12.5). */
  readonly pct: number;
  /** Vertical position from the top of the plot area, 0 (top) … 1 (bottom). */
  readonly topFraction: number;
}

export interface PercentAxisModel {
  /** Chart series anchored so the first point is 0%, y in percent. */
  readonly points: ReadonlyArray<ChartPoint>;
  /** Reference-line ticks, sorted high → low (max, 0, min — deduped). */
  readonly ticks: ReadonlyArray<PercentAxisTick>;
  /** False when there is too little data to draw a meaningful curve. */
  readonly hasData: boolean;
}

const EMPTY: PercentAxisModel = { points: [], ticks: [], hasData: false };

export const buildPercentAxisModel = (curve: ReadonlyArray<PercentAxisInput>): PercentAxisModel => {
  if (curve.length < 2) return EMPTY;

  const base = curve[0]!.ratio;
  const points: ChartPoint[] = curve.map((p, index) => ({
    x: index,
    y: (p.ratio - base) * 100,
    asOf: p.asOf,
    label: p.label,
  }));

  let min = 0;
  let max = 0;
  for (const pt of points) {
    if (pt.y < min) min = pt.y;
    if (pt.y > max) max = pt.y;
  }

  const span = max - min;
  const topFraction = (v: number): number => (span === 0 ? 0.5 : (max - v) / span);

  const ticks = Array.from(new Set([max, 0, min]))
    .sort((a, b) => b - a)
    .map((pct) => ({ pct, topFraction: topFraction(pct) }));

  return { points, ticks, hasData: true };
};
