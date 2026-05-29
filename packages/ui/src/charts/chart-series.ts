import type { ChartPoint } from "./types";
import { firstNonZeroChartY } from "../finance/compute-period-change";

/** Map chart points to victory-native series rows (sorted by x). */
export const toChartSeries = (
  data: ReadonlyArray<ChartPoint>
): ReadonlyArray<{ index: number; value: number }> => {
  const sorted = [...data].sort((a, b) => a.x - b.x);
  return sorted.map((p, i) => ({
    index: i,
    value: p.y,
  }));
};

/**
 * Period return sign for stroke / dot fill — matches PortfolioHeroSection headline.
 *
 * Baseline = first non-zero Y (not data[0]; bootstrap charts may lead with totalValue = 0).
 * Industry default: sign(last − periodStart) tints the whole line for the selected range.
 */
export const chartPeriodSign = (data: ReadonlyArray<ChartPoint>): "gain" | "loss" | "neutral" => {
  if (data.length < 2) return "neutral";
  const periodStart = firstNonZeroChartY(data);
  const last = data[data.length - 1]!.y;
  if (periodStart === null) return "neutral";
  if (last > periodStart) return "gain";
  if (last < periodStart) return "loss";
  return "neutral";
};

/** Min / max Y in chart data — for reference labels and range display. */
export const chartPeakTrough = (
  data: ReadonlyArray<ChartPoint>
): { peak: ChartPoint | null; trough: ChartPoint | null } => {
  if (data.length === 0) return { peak: null, trough: null };
  let peak = data[0]!;
  let trough = data[0]!;
  for (const point of data) {
    if (point.y > peak.y) peak = point;
    if (point.y < trough.y) trough = point;
  }
  return { peak, trough };
};

/**
 * Victory needs ≥2 samples to draw a visible segment.
 * Duplicate a lone point so a flat baseline renders instead of a blank canvas.
 */
export const ensureRenderableChartPoints = (
  data: ReadonlyArray<ChartPoint>
): ReadonlyArray<ChartPoint> => {
  if (data.length === 0) return data;
  if (data.length >= 2) return data;
  const only = data[0]!;
  return [
    { ...only, x: 0 },
    { ...only, x: 1 },
  ];
};
