import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import type { Transaction } from "@arc/core";

import {
  countNonZeroMarketSlicePoints,
  dbSnapshotsUsableForMarketFilter,
  expectedBootstrapPointCount,
  needsChartBootstrap,
  resolveMarketFilteredChartSeries,
} from "../portfolio-chart-density";
import type { PortfolioSnapshotPoint } from "../queries/use-portfolio-value-snapshots";

const tx = (tradeDate: string): Transaction => ({
  id: "tx-1",
  portfolioId: "p1",
  assetId: "US:AAPL",
  type: "BUY",
  shares: new Decimal(1),
  pricePerShare: new Decimal(100),
  currency: "USD",
  fee: new Decimal(0),
  tradeDate,
});

const snapshot = (
  asOf: string,
  perAssetReporting: ReadonlyMap<string, Decimal> = new Map()
): PortfolioSnapshotPoint => ({
  asOf,
  totalValue: new Decimal(1000),
  reportingCurrency: "CNY",
  perAssetReporting,
});

describe("expectedBootstrapPointCount", () => {
  const now = new Date("2026-05-27T12:00:00.000Z");
  const transactions = [tx("2025-01-01T00:00:00.000Z")];

  it("1D expects 2 day keys", () => {
    expect(expectedBootstrapPointCount("1D", transactions, now)).toBe(2);
  });

  it("1W expects 8 day keys", () => {
    expect(expectedBootstrapPointCount("1W", transactions, now)).toBe(8);
  });
});

describe("needsChartBootstrap", () => {
  const transactions = [tx("2026-06-01T00:00:00.000Z")];

  it("requires bootstrap when DB has fewer points than range density", () => {
    const sparse = [snapshot("2026-05-25T23:00:00.000Z"), snapshot("2026-05-26T23:00:00.000Z")];
    expect(needsChartBootstrap(sparse, "1W", transactions)).toBe(true);
  });

  it("skips bootstrap when DB meets 1D density", () => {
    const two = [snapshot("2026-05-26T23:00:00.000Z"), snapshot("2026-05-27T23:00:00.000Z")];
    expect(needsChartBootstrap(two, "1D", transactions)).toBe(false);
  });

  it("returns false without transactions", () => {
    expect(needsChartBootstrap([], "1W", [])).toBe(false);
  });
});

describe("dbSnapshotsUsableForMarketFilter", () => {
  const transactions = [tx("2025-01-01T00:00:00.000Z")];
  const markets = new Set(["US"] as const);
  const now = new Date("2026-05-27T12:00:00.000Z");

  it("rejects sparse DB rows without per_asset US history", () => {
    const sparse = [snapshot("2026-05-25"), snapshot("2026-05-26")];
    expect(dbSnapshotsUsableForMarketFilter(sparse, "1W", transactions, markets, now)).toBe(false);
  });

  it("accepts dense DB with non-zero US slices", () => {
    const us = new Map([["US:AAPL", new Decimal(500)]]);
    const dense = Array.from({ length: 8 }, (_, i) =>
      snapshot(`2026-05-${20 + i}T12:00:00.000Z`, us)
    );
    expect(dbSnapshotsUsableForMarketFilter(dense, "1W", transactions, markets, now)).toBe(true);
  });
});

describe("countNonZeroMarketSlicePoints", () => {
  it("counts only rows with non-zero filtered value", () => {
    const points = [
      snapshot("a", new Map()),
      snapshot("b", new Map([["US:UBER", new Decimal(100)]])),
      snapshot("c", new Map([["FUND:000216", new Decimal(200)]])),
    ];
    expect(countNonZeroMarketSlicePoints(points, new Set(["US"]))).toBe(1);
  });
});

describe("resolveMarketFilteredChartSeries", () => {
  const transactions = [tx("2025-01-01T00:00:00.000Z")];
  const markets = new Set(["US"] as const);
  const now = new Date("2026-05-27T12:00:00.000Z");
  const base = {
    range: "1W" as const,
    transactions,
    markets,
    bootstrapPending: false,
    now,
  };

  it("prefers bootstrap when it meets range density", () => {
    const boot = Array.from({ length: 8 }, (_, i) => snapshot(`2026-05-${20 + i}`));
    const db = [snapshot("2026-05-20"), snapshot("2026-05-21")];
    expect(resolveMarketFilteredChartSeries({ ...base, boot, dbSnapshots: db })).toBe(boot);
  });

  it("does not fall back to sparse 2-row DB for 1W", () => {
    const boot = [snapshot("2026-05-26")];
    const db = [snapshot("2026-05-25"), snapshot("2026-05-26")];
    expect(resolveMarketFilteredChartSeries({ ...base, boot, dbSnapshots: db })).toEqual([]);
  });

  it("returns empty while bootstrap pending instead of sparse DB", () => {
    const db = [snapshot("2026-05-25"), snapshot("2026-05-26")];
    expect(
      resolveMarketFilteredChartSeries({
        ...base,
        boot: undefined,
        dbSnapshots: db,
        bootstrapPending: true,
      })
    ).toEqual([]);
  });
});
