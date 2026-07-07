/**
 * holdings-presenter — cost-basis period change (ADR 016).
 */

import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import type { Holding, MarketValuation } from "@arc/core";

import { buildHoldingsTableRows } from "../holdings-presenter";

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

  it("includes cumulative cash dividends in return — 支付宝 持有收益 semantic", () => {
    // 506002 scenario: 持有成本 ¥30,055, 当前市值 ¥71,260, 累计分红 ¥3,920.31
    // → 支付宝 持有收益 = ¥45,125.11 / +150.14%
    const rows = buildHoldingsTableRows({
      holdings: [{ ...holding, totalDividends: new Decimal("3920.31") }],
      perAsset: [
        {
          ...perAsset[0]!,
          valueReporting: new Decimal("71260"),
          costBasisReporting: new Decimal("30055"),
        },
      ],
      catalog: undefined,
      reportingCurrency: "CNY",
      quoteLoading: false,
      formatPeriodChangeLine: (d, p) => `${d.toString()} (${p?.toString() ?? "—"}%)`,
      positionLabel: () => "29699.30 份",
      marketLabel: () => "基金",
      newPositionLabel: "新持仓",
      formatAccessibilityLabel: ({ symbol }) => symbol,
    });
    const change = rows[0]!.periodChange;
    expect(change.kind).toBe("ok");
    if (change.kind !== "ok") return;
    // delta = (71260 - 30055) + 3920.31 = 45125.31
    expect(change.delta.toFixed(2)).toBe("45125.31");
    // percent = 45125.31 / 30055 × 100 ≈ 150.14%
    expect(change.percent?.toFixed(2)).toBe("150.14");
  });
});
