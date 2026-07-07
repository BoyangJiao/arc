/**
 * Hero period baseline — first non-zero chart point (ADR 016).
 */

import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";

import {
  computePeriodChangeFromBaseline,
  firstNonZeroChartY,
} from "../src/finance/compute-period-change";

describe("firstNonZeroChartY", () => {
  it("skips leading zeros for new-portfolio charts", () => {
    const y = firstNonZeroChartY([{ y: 0 }, { y: 0 }, { y: 50_000 }, { y: 52_000 }]);
    expect(y).toBe(50_000);
  });

  it("returns null when all points are zero", () => {
    expect(firstNonZeroChartY([{ y: 0 }, { y: 0 }])).toBeNull();
  });
});

describe("computePeriodChangeFromBaseline", () => {
  it("default and scrub share the same baseline math", () => {
    const baseline = new Decimal(50_000);
    const live = computePeriodChangeFromBaseline(new Decimal(52_000), baseline);
    const scrub = computePeriodChangeFromBaseline(new Decimal(51_000), baseline);
    expect(live?.delta.toString()).toBe("2000");
    expect(live?.percent?.toFixed(2)).toBe("4.00");
    expect(scrub?.delta.toString()).toBe("1000");
    expect(scrub?.percent?.toFixed(2)).toBe("2.00");
  });
});
