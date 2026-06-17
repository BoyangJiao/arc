/**
 * insights/benchmark property + example tests.
 * Maps to .specify/feature-specs/stage-3/benchmark-comparison-stage-3.md (#9).
 */

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import Decimal from "decimal.js";

import { bucketReturn, calendarBuckets, type IndexClose } from "../src/insights/benchmark";

const dec = (n: number | string): Decimal => new Decimal(n);
const closes = (rows: ReadonlyArray<[string, number | string]>): IndexClose[] =>
  rows.map(([date, c]) => ({ date, close: dec(c) }));

const SERIES = closes([
  ["2026-01-05", 100],
  ["2026-01-12", 110],
  ["2026-01-19", 105],
  ["2026-01-26", 120],
]);

describe("bucketReturn", () => {
  it("end/start − 1 over the window (price return)", () => {
    // first on/after 2026-01-01 = 100; last on/before 2026-01-31 = 120 → +20%
    expect(bucketReturn(SERIES, "2026-01-01", "2026-01-31")!.equals(dec("0.2"))).toBe(true);
  });

  it("aligns to first/last close inside the window", () => {
    // window 01-10..01-20 → start 110 (01-12), end 105 (01-19) → 105/110 − 1
    const r = bucketReturn(SERIES, "2026-01-10", "2026-01-20")!;
    expect(r.equals(dec(105).div(110).minus(1))).toBe(true);
  });

  it("flat series → 0", () => {
    const flat = closes([
      ["2026-02-02", 50],
      ["2026-02-09", 50],
    ]);
    expect(bucketReturn(flat, "2026-02-01", "2026-02-28")!.isZero()).toBe(true);
  });

  it("< 2 closes in window → null", () => {
    expect(bucketReturn(SERIES, "2026-01-05", "2026-01-05")).toBeNull(); // single point
    expect(bucketReturn(SERIES, "2026-03-01", "2026-03-31")).toBeNull(); // no overlap
    expect(bucketReturn([], "2026-01-01", "2026-12-31")).toBeNull();
  });

  it("non-positive start close → null", () => {
    const bad = closes([
      ["2026-01-05", 0],
      ["2026-01-12", 110],
    ]);
    expect(bucketReturn(bad, "2026-01-01", "2026-01-31")).toBeNull();
  });

  it("integrates with calendarBuckets: per-bucket window slices the series", () => {
    const now = new Date("2026-06-18T00:00:00Z");
    const months = calendarBuckets("month", 2, now); // [2026-4 (May), 2026-5 (Jun)]
    const may = months[0]!;
    const r = bucketReturn(
      SERIES,
      may.from.toISOString().slice(0, 10),
      may.to.toISOString().slice(0, 10)
    );
    expect(r).toBeNull(); // SERIES is all January → no May data
  });

  it("property: result = end/start − 1 for any positive ascending pair", () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1, max: 1e4, noNaN: true }),
        fc.float({ min: 1, max: 1e4, noNaN: true }),
        (a, b) => {
          const series = closes([
            ["2026-01-01", a],
            ["2026-01-02", b],
          ]);
          const r = bucketReturn(series, "2026-01-01", "2026-01-31")!;
          expect(r.equals(dec(b).div(dec(a)).minus(1))).toBe(true);
        }
      )
    );
  });
});

describe("calendarBuckets", () => {
  const now = new Date("2026-06-18T12:00:00Z"); // June 2026 = Q2 (q index 1), month index 5

  it("year: last N calendar years, current ends at now", () => {
    const b = calendarBuckets("year", 3, now);
    expect(b.map((x) => x.key)).toEqual(["2024", "2025", "2026"]);
    expect(b[0]!.from.toISOString().slice(0, 10)).toBe("2024-01-01");
    expect(b[0]!.to.toISOString().slice(0, 10)).toBe("2024-12-31");
    expect(b[2]!.to.getTime()).toBe(now.getTime()); // current bucket ends now
  });

  it("quarter: keys are 0-based, current ends at now", () => {
    const b = calendarBuckets("quarter", 2, now);
    expect(b.map((x) => x.key)).toEqual(["2026-Q0", "2026-Q1"]);
    expect(b[0]!.from.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(b[0]!.to.toISOString().slice(0, 10)).toBe("2026-03-31");
    expect(b[1]!.to.getTime()).toBe(now.getTime());
  });

  it("month: wraps across year boundary", () => {
    const jan = new Date("2026-01-10T00:00:00Z");
    const b = calendarBuckets("month", 2, jan); // Dec 2025, Jan 2026
    expect(b.map((x) => x.key)).toEqual(["2025-11", "2026-0"]);
    expect(b[0]!.from.toISOString().slice(0, 10)).toBe("2025-12-01");
    expect(b[0]!.to.toISOString().slice(0, 10)).toBe("2025-12-31");
  });
});
