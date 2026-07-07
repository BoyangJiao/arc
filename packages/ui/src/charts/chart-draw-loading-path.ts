/** Inner padding — roughly matches victory chart bounds in hero. */
const CHART_PADDING = { left: 6, right: 6, top: 14, bottom: 14 };

/**
 * Sparse-ish polyline — irregular bull walk (Coinbase chartFallbackPositive).
 * @see https://cds.coinbase.com/components/animation/Lottie/
 */
const PLACEHOLDER_POINT_COUNT = 52;

/** Body scale — chart polyline drawn at 80% and centered in the plot area. */
export const CHART_DRAW_BODY_SCALE = 0.8;

/** Shift normalized Y upward (subtract) so the front leg sits off the bottom edge. */
const CHART_DRAW_Y_LIFT = 0.09;

/** Last N points forced to slope upward (normalized Y decreases). */
const FINISH_UPWARD_TAIL = 4;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** Deterministic [0, 1) — stable noise without Math.random(). */
export const hash01 = (seed: number): number => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
};

export interface ChartDrawBounds {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

export interface ChartDrawPoint {
  readonly x: number;
  readonly y: number;
}

export const chartDrawBoundsFor = (width: number, height: number): ChartDrawBounds => ({
  left: CHART_PADDING.left,
  right: width - CHART_PADDING.right,
  top: CHART_PADDING.top,
  bottom: height - CHART_PADDING.bottom,
});

export const scalePointsToCenter = (
  points: readonly ChartDrawPoint[],
  width: number,
  height: number
): ChartDrawPoint[] => {
  const bounds = chartDrawBoundsFor(width, height);
  const cx = (bounds.left + bounds.right) / 2;
  const cy = (bounds.top + bounds.bottom) / 2;
  const s = CHART_DRAW_BODY_SCALE;
  return points.map((p) => ({
    x: cx + (p.x - cx) * s,
    y: cy + (p.y - cy) * s,
  }));
};

/** Plot bounds after 80% center scale — used for gradient mapping. */
export const scaledChartDrawBoundsFor = (width: number, height: number): ChartDrawBounds => {
  const bounds = chartDrawBoundsFor(width, height);
  const cx = (bounds.left + bounds.right) / 2;
  const cy = (bounds.top + bounds.bottom) / 2;
  const s = CHART_DRAW_BODY_SCALE;
  return {
    left: cx + (bounds.left - cx) * s,
    right: cx + (bounds.right - cx) * s,
    top: cy + (bounds.top - cy) * s,
    bottom: cy + (bounds.bottom - cy) * s,
  };
};

/** Irregular horizontal spacing — segments vary in length like tick gaps. */
export const buildNormalizedLoadingXs = (count: number, left: number, innerW: number): number[] => {
  if (count <= 1) return [left];
  const weights = Array.from({ length: count - 1 }, (_, i) => 0.4 + hash01(i * 31 + 2) * 1.25);
  const total = weights.reduce((sum, w) => sum + w, 0);
  const xs = [left];
  let acc = 0;
  for (const w of weights) {
    acc += w / total;
    xs.push(left + acc * innerW);
  }
  return xs;
};

/**
 * Sequential random-walk Y (0 = top, 1 = bottom): bull drift + uneven shocks + hero spikes.
 */
export const buildNormalizedLoadingYs = (count: number): number[] => {
  if (count <= 0) return [];
  if (count === 1) return [clamp01(0.72 - CHART_DRAW_Y_LIFT)];

  const ys: number[] = [0.72];
  const endTarget = 0.12;
  const netDrift = (endTarget - ys[0]!) / (count - 1);

  for (let i = 1; i < count; i++) {
    const t = i / (count - 1);
    const r = hash01(i * 17 + 3);
    const r2 = hash01(i * 43 + 11);
    const r3 = hash01(i * 67 + 19);
    const r4 = hash01(i * 91 + 23);

    let shock: number;
    if (r2 > 0.88) {
      shock = (r - 0.5) * 0.42;
    } else if (r > 0.68) {
      shock = (r - 0.5) * 0.22;
    } else if (r > 0.32) {
      shock = (r - 0.5) * 0.11;
    } else {
      shock = (r - 0.5) * 0.035;
    }

    if (t < 0.36) {
      shock *= 1.55;
      shock += (r4 - 0.5) * 0.09 * (1 - t / 0.36);
    } else if (t > 0.72) {
      shock *= 1.4;
    }

    const earlyDip = t < 0.14 ? 0.03 * (1 - t / 0.14) : 0;

    const heroPeak = Math.exp(-Math.pow((t - 0.64) / 0.055, 2)) * -0.1;

    const midPullback = Math.exp(-Math.pow((t - 0.42) / 0.085, 2)) * 0.12 * (0.65 + r3 * 0.7);

    const lateRally =
      t > 0.7 && t <= 0.86
        ? -0.018 * Math.pow((t - 0.7) / 0.16, 0.75) + (r4 - 0.5) * 0.035 * (t - 0.7)
        : t > 0.86
          ? -0.032 * Math.pow((t - 0.86) / 0.14, 0.85)
          : 0;

    const next = ys[i - 1]! + netDrift + shock + earlyDip + heroPeak + midPullback + lateRally;
    ys.push(clamp01(next));
  }

  for (let i = Math.max(1, count - FINISH_UPWARD_TAIL); i < count; i++) {
    const minStepUp = 0.008 + (i - (count - FINISH_UPWARD_TAIL)) * 0.005;
    if (ys[i]! >= ys[i - 1]! - minStepUp) {
      ys[i] = clamp01(ys[i - 1]! - minStepUp);
    }
  }

  return ys.map((y) => clamp01(y - CHART_DRAW_Y_LIFT));
};

/** @deprecated Prefer buildNormalizedLoadingYs — kept for tests. */
export const normalizedLoadingY = (i: number, count: number): number => {
  const ys = buildNormalizedLoadingYs(count);
  return ys[i] ?? ys[0] ?? 0.5;
};

export const buildChartDrawLoadingPoints = (width: number, height: number): ChartDrawPoint[] => {
  const bounds = chartDrawBoundsFor(width, height);
  const innerW = bounds.right - bounds.left;
  const innerH = bounds.bottom - bounds.top;
  const count = PLACEHOLDER_POINT_COUNT;

  const xs = buildNormalizedLoadingXs(count, bounds.left, innerW);
  const ys = buildNormalizedLoadingYs(count);

  const raw = xs.map((x, index) => ({
    x,
    y: bounds.top + ys[index]! * innerH,
  }));

  return scalePointsToCenter(raw, width, height);
};
