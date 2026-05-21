/**
 * Downsample chart series for Skia/Victory rendering (ADR 013 L2).
 *
 * Storage keeps full daily EOD rows; display caps at maxPoints for perf.
 * Always preserves first and last points so period range stays accurate.
 */

import type { ChartPoint } from "./types";

export const DEFAULT_CHART_DISPLAY_MAX_POINTS = 120;

export const decimateChartPoints = (
  data: ReadonlyArray<ChartPoint>,
  maxPoints: number = DEFAULT_CHART_DISPLAY_MAX_POINTS
): ReadonlyArray<ChartPoint> => {
  if (data.length <= maxPoints) {
    return data.map((p, index) => ({ ...p, x: index }));
  }

  const picked: ChartPoint[] = [];
  const lastIndex = data.length - 1;
  const step = lastIndex / (maxPoints - 1);
  let lastSrcIndex = -1;

  for (let i = 0; i < maxPoints; i++) {
    let srcIndex = i === maxPoints - 1 ? lastIndex : Math.round(i * step);
    while (srcIndex <= lastSrcIndex && srcIndex < lastIndex) {
      srcIndex += 1;
    }
    lastSrcIndex = srcIndex;
    const src = data[srcIndex]!;
    picked.push({ ...src, x: picked.length });
  }

  return picked;
};
