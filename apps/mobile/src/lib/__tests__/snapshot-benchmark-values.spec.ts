import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";

import { findEffectiveBucketFrom } from "../portfolio-snapshot-values";
import {
  buildForwardFilledAssetSeries,
  forwardFilledAssetValueSeries,
  trimSnapshotsLeadingZeroTotals,
} from "../snapshot-asset-series";
import type { PortfolioSnapshotPoint } from "../queries/use-portfolio-value-snapshots";

const snap = (
  day: string,
  total: number,
  perAsset: ReadonlyArray<[string, number]> = []
): PortfolioSnapshotPoint => ({
  asOf: `${day}T23:00:00.000Z`,
  totalValue: new Decimal(total),
  reportingCurrency: "CNY",
  perAssetReporting: new Map(perAsset.map(([id, v]) => [id, new Decimal(v)])),
});

describe("findEffectiveBucketFrom", () => {
  it("returns null when bucket has no snapshots or transactions", () => {
    const bucket = {
      from: new Date("2026-01-01T00:00:00.000Z"),
      to: new Date("2026-12-31T23:59:59.999Z"),
    };
    expect(findEffectiveBucketFrom(bucket, [], [])).toBeNull();
  });

  it("uses calendar from when a prior snapshot forward-fills the bucket start", () => {
    const bucket = {
      from: new Date("2026-01-01T00:00:00.000Z"),
      to: new Date("2026-06-18T12:00:00.000Z"),
    };
    const snaps = [snap("2025-12-31", 100_000), snap("2026-03-01", 110_000)];
    expect(findEffectiveBucketFrom(bucket, snaps, [])?.toISOString()).toBe(
      bucket.from.toISOString()
    );
  });

  it("shifts to first in-bucket snapshot when calendar start predates history", () => {
    const bucket = {
      from: new Date("2026-01-01T00:00:00.000Z"),
      to: new Date("2026-06-18T12:00:00.000Z"),
    };
    const snaps = [snap("2026-03-15", 50_000)];
    expect(findEffectiveBucketFrom(bucket, snaps, [])?.toISOString().slice(0, 10)).toBe(
      "2026-03-15"
    );
  });
});

describe("snapshot asset series helpers", () => {
  it("forward-fills missing per-asset rows instead of dropping to zero", () => {
    const snaps = [
      snap("2026-01-01", 100, [["FUND:000216", 100]]),
      snap("2026-01-02", 100, []),
      snap("2026-01-03", 105, [["FUND:000216", 105]]),
    ];
    expect(forwardFilledAssetValueSeries(snaps, "FUND:000216").map((v) => v.toNumber())).toEqual([
      100, 100, 105,
    ]);
  });

  it("buildForwardFilledAssetSeries produces chart rows", () => {
    const snaps = [snap("2026-01-01", 100, [["FUND:000216", 100]]), snap("2026-01-02", 100, [])];
    const rows = buildForwardFilledAssetSeries(snaps, ["FUND:000216"], (id) => id);
    expect(rows).toHaveLength(2);
    expect(rows[1]!["FUND:000216"]).toBe(100);
  });

  it("trimSnapshotsLeadingZeroTotals drops pre-inception zeros", () => {
    const snaps = [snap("2026-01-01", 0), snap("2026-01-02", 100)];
    expect(trimSnapshotsLeadingZeroTotals(snaps)).toHaveLength(1);
  });
});
