/**
 * holdings-presenter — cost-basis period change (ADR 016).
 */

import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import type { Holding, MarketValuation } from "@arc/core";

import { buildHoldingsTableRows, openingSnapshotDateByAsset } from "../holdings-presenter";
import type { Transaction } from "@arc/core";

const holding: Holding = {
  assetId: "FUND:000216",
  shares: new Decimal(6000),
  averageCost: new Decimal("14500").div(6000),
  totalCostBasis: new Decimal("14500"),
  realizedPnL: new Decimal(0),
  totalDividends: new Decimal(0),
  portfolioId: "p-1",
  currency: "CNY",
};

const perAsset: MarketValuation[] = [
  {
    assetId: "FUND:000216",
    shares: holding.shares,
    priceNative: new Decimal(3),
    valueNative: new Decimal(18000),
    nativeCurrency: "CNY",
    valueReporting: new Decimal(18000),
    costBasisReporting: new Decimal(14500),
    unrealizedPnL: new Decimal(3500),
    unrealizedPnLPercent: new Decimal("24.137931034482758620689655172"),
    dailyChangePercent: null,
    reportingCurrency: "CNY",
    fxRateUsed: new Decimal(1),
    priceAsOf: "2026-05-27T00:00:00Z",
    fxAsOf: "2026-05-27T00:00:00Z",
  },
];

describe("openingSnapshotDateByAsset", () => {
  it("returns earliest snapshot date per asset", () => {
    const txs = [
      {
        id: "1",
        portfolioId: "p",
        assetId: "FUND:X",
        type: "OPENING_SNAPSHOT",
        shares: new Decimal(1),
        pricePerShare: new Decimal(1),
        currency: "CNY",
        fee: new Decimal(0),
        tradeDate: "2025-09-19T00:00:00Z",
      },
      {
        id: "2",
        portfolioId: "p",
        assetId: "FUND:X",
        type: "OPENING_SNAPSHOT",
        shares: new Decimal(1),
        pricePerShare: new Decimal(1),
        currency: "CNY",
        fee: new Decimal(0),
        tradeDate: "2025-08-01T00:00:00Z",
      },
    ] as Transaction[];
    const map = openingSnapshotDateByAsset(txs);
    expect(map.get("FUND:X")).toBe("2025-08-01");
  });
});

describe("buildHoldingsTableRows / resolvePeriodChange", () => {
  it("uses cost-basis since open — ADR 016 extreme example +24.1%", () => {
    const rows = buildHoldingsTableRows({
      holdings: [holding],
      perAsset,
      catalog: undefined,
      reportingCurrency: "CNY",
      quoteLoading: false,
      formatPeriodChangeLine: (d, p) => `${d.toString()} (${p?.toString() ?? "—"}%)`,
      positionLabel: () => "6000 份",
      marketLabel: () => "基金",
      newPositionLabel: "新持仓",
      formatAccessibilityLabel: ({ symbol }) => symbol,
    });
    const change = rows[0]!.periodChange;
    expect(change.kind).toBe("ok");
    if (change.kind !== "ok") return;
    expect(change.delta.toString()).toBe("3500");
    expect(change.percent?.toFixed(1)).toBe("24.1");
  });
});
