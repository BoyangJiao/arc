import { describe, expect, it } from "vitest";

import { chartPeriodSign } from "../src/charts/chart-series";
import type { ChartPoint } from "../src/charts/types";

const pt = (y: number, x = 0): ChartPoint => ({ x, y, label: "d" });

describe("chartPeriodSign", () => {
  it("uses first non-zero Y as baseline (matches hero period change)", () => {
    const data = [pt(0, 0), pt(0, 1), pt(112_000, 2), pt(111_734, 3)];
    expect(chartPeriodSign(data)).toBe("loss");
  });

  it("returns gain when last exceeds first non-zero baseline", () => {
    const data = [pt(0), pt(100_000), pt(100_500)];
    expect(chartPeriodSign(data)).toBe("gain");
  });

  it("returns neutral when fewer than 2 points", () => {
    expect(chartPeriodSign([pt(100)])).toBe("neutral");
    expect(chartPeriodSign([])).toBe("neutral");
  });

  it("returns neutral when all points are zero", () => {
    expect(chartPeriodSign([pt(0), pt(0)])).toBe("neutral");
  });

  it("period up with tail down still counts as gain (industry period sign)", () => {
    const data = [pt(100_000, 0), pt(112_000, 1), pt(111_734, 2)];
    expect(chartPeriodSign(data)).toBe("gain");
  });

  it("period down with tail up still counts as loss", () => {
    const data = [pt(120_000, 0), pt(110_000, 1), pt(111_734, 2)];
    expect(chartPeriodSign(data)).toBe("loss");
  });
});
