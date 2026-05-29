import { describe, expect, it } from "vitest";

import {
  buildChartDrawLoadingPoints,
  buildNormalizedLoadingXs,
  buildNormalizedLoadingYs,
  chartDrawBoundsFor,
  hash01,
} from "../src/charts/chart-draw-loading-path";

describe("chart-draw-loading-path", () => {
  it("places points in bounds with large vertical swing", () => {
    const width = 320;
    const height = 208;
    const bounds = chartDrawBoundsFor(width, height);
    const points = buildChartDrawLoadingPoints(width, height);

    expect(points.length).toBe(52);
    let minY = Infinity;
    let maxY = -Infinity;
    let maxStep = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i]!;
      expect(p.x).toBeGreaterThanOrEqual(bounds.left - 1e-6);
      expect(p.x).toBeLessThanOrEqual(bounds.right + 1e-6);
      expect(p.y).toBeGreaterThanOrEqual(bounds.top - 1e-6);
      expect(p.y).toBeLessThanOrEqual(bounds.bottom + 1e-6);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
      if (i > 0) maxStep = Math.max(maxStep, Math.abs(p.y - points[i - 1]!.y));
    }
    expect(maxY - minY).toBeGreaterThan((bounds.bottom - bounds.top) * 0.22);
    expect(maxStep).toBeGreaterThan((bounds.bottom - bounds.top) * 0.04);
  });

  it("random-walk Y is net bull with moderate reversals and big steps", () => {
    const count = 52;
    const ys = buildNormalizedLoadingYs(count);

    expect(ys[0]! - ys[count - 1]!).toBeGreaterThan(0.28);
    expect(ys[0]!).toBeLessThan(0.72);

    let reversals = 0;
    const steps: number[] = [];
    for (let i = 2; i < ys.length; i++) {
      const d0 = ys[i - 1]! - ys[i - 2]!;
      const d1 = ys[i]! - ys[i - 1]!;
      steps.push(Math.abs(d1));
      if (d0 !== 0 && d1 !== 0 && d0 * d1 < 0) reversals++;
    }
    expect(reversals).toBeGreaterThan(6);
    expect(reversals).toBeLessThan(28);

    expect(ys[count - 1]!).toBeLessThan(ys[count - 2]!);
    expect(ys[count - 2]!).toBeLessThan(ys[count - 3]!);

    const maxStep = Math.max(...steps);
    const minStep = Math.min(...steps.filter((s) => s > 0));
    expect(maxStep / minStep).toBeGreaterThan(2.5);
  });

  it("x spacing is irregular but spans full width", () => {
    const xs = buildNormalizedLoadingXs(52, 6, 300);
    expect(xs[0]).toBe(6);
    expect(xs.at(-1)).toBeCloseTo(306, 4);
    const gaps = xs.slice(1).map((x, i) => x - xs[i]!);
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const varied = gaps.some((g) => g > avg * 1.35) && gaps.some((g) => g < avg * 0.75);
    expect(varied).toBe(true);
  });

  it("scales polyline to 80% centered in plot area", () => {
    const width = 320;
    const height = 208;
    const bounds = chartDrawBoundsFor(width, height);
    const points = buildChartDrawLoadingPoints(width, height);

    const cx = (bounds.left + bounds.right) / 2;
    const cy = (bounds.top + bounds.bottom) / 2;
    const innerW = bounds.right - bounds.left;
    const innerH = bounds.bottom - bounds.top;

    expect(points[0]!.x).toBeCloseTo(cx - (innerW / 2) * 0.8, 0);
    expect(points.at(-1)!.x).toBeCloseTo(cx + (innerW / 2) * 0.8, 0);
    expect(points[0]!.y).toBeGreaterThan(bounds.top + innerH * 0.08);
    expect(points.at(-1)!.y).toBeLessThan(bounds.top + innerH * 0.92);
  });

  it("hash01 is deterministic in [0, 1)", () => {
    expect(hash01(42)).toBe(hash01(42));
    expect(hash01(42)).toBeGreaterThanOrEqual(0);
    expect(hash01(42)).toBeLessThan(1);
  });
});
