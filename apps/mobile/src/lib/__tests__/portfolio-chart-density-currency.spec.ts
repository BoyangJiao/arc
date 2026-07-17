import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { snapshotsCurrencyMismatch } from "../portfolio-chart-density";
import type { PortfolioSnapshotPoint } from "../queries/use-portfolio-value-snapshots";

const point = (currency: "CNY" | "USD", total: number): PortfolioSnapshotPoint => ({
  asOf: "2026-07-01T23:00:00.000Z",
  totalValue: new Decimal(total),
  reportingCurrency: currency,
  perAssetReporting: new Map(),
});

describe("snapshotsCurrencyMismatch（铁律 4/5：快照币种 ≠ 显示币种时不可直接上图）", () => {
  it("returns false for empty series", () => {
    expect(snapshotsCurrencyMismatch([], "USD")).toBe(false);
  });

  it("returns false when all snapshots match the display currency", () => {
    expect(snapshotsCurrencyMismatch([point("USD", 100), point("USD", 200)], "USD")).toBe(false);
  });

  it("returns true when snapshots were stored in a different currency", () => {
    // 2026-07-17 基线实测案例：seed 快照 reporting=CNY（¥289,811 起步），
    // 显示币种 USD → 首页 periodChange 出现 $63,907 − ¥289,811 = -$225,903。
    expect(snapshotsCurrencyMismatch([point("CNY", 289811)], "USD")).toBe(true);
  });

  it("returns true when even one row differs (mixed history after currency switch)", () => {
    expect(
      snapshotsCurrencyMismatch([point("USD", 100), point("CNY", 720), point("USD", 110)], "USD")
    ).toBe(true);
  });
});
