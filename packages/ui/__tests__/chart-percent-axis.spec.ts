/**
 * chart-percent-axis — cumulative-return % anchoring + reference ticks.
 *
 * Maps to pnl-analysis-insights §UI / AC.1.5 (curve anchored to 0% at start).
 */

import { describe, expect, it } from "vitest";

import { buildPercentAxisModel } from "../src/charts/chart-percent-axis";

describe("buildPercentAxisModel", () => {
  it("anchors the first sample to 0% and converts ratios to percent", () => {
    const model = buildPercentAxisModel([
      { ratio: 0.1 }, // base
      { ratio: 0.2 },
      { ratio: 0.05 },
    ]);
    expect(model.hasData).toBe(true);
    expect(model.points.map((p) => p.y)).toEqual([0, 10, -5]);
    expect(model.points.map((p) => p.x)).toEqual([0, 1, 2]);
  });

  it("emits max / 0 / min ticks sorted high → low with top-down positions", () => {
    const model = buildPercentAxisModel([{ ratio: 0 }, { ratio: 0.2 }, { ratio: -0.1 }]);
    // anchored y: [0, 20, -10] → max 20, min -10, span 30
    expect(model.ticks.map((t) => t.pct)).toEqual([20, 0, -10]);
    expect(model.ticks[0]!.topFraction).toBeCloseTo(0); // max at top
    expect(model.ticks[1]!.topFraction).toBeCloseTo(20 / 30); // 0% two-thirds down
    expect(model.ticks[2]!.topFraction).toBeCloseTo(1); // min at bottom
  });

  it("dedupes ticks when the curve never goes negative (min == 0)", () => {
    const model = buildPercentAxisModel([{ ratio: 0 }, { ratio: 0.3 }]);
    // y: [0, 30] → {30, 0} only (0 == min)
    expect(model.ticks.map((t) => t.pct)).toEqual([30, 0]);
  });

  it("centers ticks when the curve is flat (span 0)", () => {
    const model = buildPercentAxisModel([{ ratio: 0.4 }, { ratio: 0.4 }]);
    expect(model.points.map((p) => p.y)).toEqual([0, 0]);
    expect(model.ticks).toHaveLength(1);
    expect(model.ticks[0]!.topFraction).toBe(0.5);
  });

  it("returns no data for fewer than two points (首日 (C) 用户)", () => {
    expect(buildPercentAxisModel([]).hasData).toBe(false);
    expect(buildPercentAxisModel([{ ratio: 0.1 }]).hasData).toBe(false);
  });

  it("preserves asOf/label passthrough for the chart series", () => {
    const model = buildPercentAxisModel([
      { ratio: 0, asOf: "2026-02-01T23:00:00.000Z", label: "02-01" },
      { ratio: 0.1, asOf: "2026-03-01T23:00:00.000Z", label: "03-01" },
    ]);
    expect(model.points[1]!.asOf).toBe("2026-03-01T23:00:00.000Z");
    expect(model.points[0]!.label).toBe("02-01");
  });
});
