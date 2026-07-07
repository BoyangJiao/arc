/**
 * buildPortfolioRiskSeries — ledger-gated value reconstruction + flow alignment.
 *
 * Guards the 风险/回撤 data-quality fix: (1) the transaction ledger gates which
 * snapshot values count (持仓 = Σ交易), repairing partial / anachronistic snapshot
 * caches; (2) trade days are tagged with a flow so risk metrics can drop them.
 */

import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { insights, type Currency, type Transaction } from "@arc/core";

import { buildPortfolioRiskSeries } from "../portfolio-risk-series";
import type { PortfolioSnapshotPoint } from "../queries/use-portfolio-value-snapshots";

const dec = (n: number | string): Decimal => new Decimal(n);

const snap = (asOf: string, perAsset: Record<string, number>): PortfolioSnapshotPoint => ({
  asOf,
  totalValue: dec(Object.values(perAsset).reduce((a, b) => a + b, 0)),
  reportingCurrency: "CNY",
  perAssetReporting: new Map(Object.entries(perAsset).map(([k, v]) => [k, dec(v)])),
});

const tx = (over: Partial<Transaction> & { assetId: string }): Transaction => ({
  id: Math.random().toString(36),
  portfolioId: "p1",
  type: "BUY",
  shares: dec(1),
  pricePerShare: dec(100),
  currency: "CNY",
  fee: dec(0),
  tradeDate: "2025-01-02T00:00:00.000Z",
  ...over,
});

const idFx = (): Decimal => dec(1);
const nums = (xs: Decimal[]): number[] => xs.map((x) => x.toNumber());

describe("buildPortfolioRiskSeries", () => {
  it("aligns a trade flow to the snapshot period ending on/after its day", () => {
    const snapshots = [
      snap("2025-01-01T23:00:00.000Z", { "CN:A": 1000 }),
      snap("2025-01-02T23:00:00.000Z", { "CN:A": 1000, "CN:B": 1000 }), // bought B
      snap("2025-01-03T23:00:00.000Z", { "CN:A": 1000, "CN:B": 1000 }),
    ];
    const txs = [
      tx({ assetId: "CN:A", tradeDate: "2024-12-01T00:00:00.000Z" }), // pre-window holding
      tx({ assetId: "CN:B", shares: dec(10), pricePerShare: dec(100) }), // 1000 on 01-02
    ];
    const series = buildPortfolioRiskSeries(snapshots, txs, idFx);
    // index 0 is never read downstream; the in-window B buy lands at index 1.
    expect(nums(series.flows).slice(1)).toEqual([1000, 0]);
    // The B-buy day is dropped → only the flat A/B days remain → no volatility.
    expect(
      insights
        .volatilityFromReturns(insights.flowFreeReturns(series.values, series.flows), 252)
        .isZero()
    ).toBe(true);
  });

  it("SELL is a negative flow", () => {
    const snapshots = [
      snap("2025-01-01T23:00:00.000Z", { "CN:A": 2000 }),
      snap("2025-01-02T23:00:00.000Z", { "CN:A": 1500 }),
    ];
    const txs = [
      tx({ assetId: "CN:A", tradeDate: "2024-12-01T00:00:00.000Z" }),
      tx({ assetId: "CN:A", type: "SELL", shares: dec(5), pricePerShare: dec(100) }),
    ];
    expect(nums(buildPortfolioRiskSeries(snapshots, txs, idFx).flows).slice(1)).toEqual([-500]);
  });

  it("applies trade-date FX to the flow (USD trade → reporting CNY)", () => {
    const snapshots = [
      snap("2025-01-01T23:00:00.000Z", { "US:X": 1000 }),
      snap("2025-01-02T23:00:00.000Z", { "US:X": 1700 }),
    ];
    const txs = [
      tx({ assetId: "US:X", tradeDate: "2024-12-01T00:00:00.000Z", currency: "USD" }),
      tx({ assetId: "US:X", currency: "USD", shares: dec(1), pricePerShare: dec(100) }), // 100 USD
    ];
    const fx = (c: Currency): Decimal => (c === "USD" ? dec(7) : dec(1));
    expect(nums(buildPortfolioRiskSeries(snapshots, txs, fx).flows).slice(1)).toEqual([700]);
  });

  it("ledger-gates anachronistic snapshot rows (asset listed before its buy date)", () => {
    // Snapshot cache wrongly lists CN:B on day 1, but the ledger buys it on day 2.
    const snapshots = [
      snap("2025-01-01T23:00:00.000Z", { "CN:A": 1000, "CN:B": 500 }), // B anachronistic
      snap("2025-01-02T23:00:00.000Z", { "CN:A": 1000, "CN:B": 500 }),
    ];
    const txs = [
      tx({ assetId: "CN:A", tradeDate: "2024-12-01T00:00:00.000Z" }),
      tx({ assetId: "CN:B", shares: dec(5), pricePerShare: dec(100) }), // buy 01-02
    ];
    const series = buildPortfolioRiskSeries(snapshots, txs, idFx);
    // B is 0 on day 1 (ledger: not yet held), 500 on day 2.
    expect(nums(series.perAsset.get("CN:B")!.values)).toEqual([0, 500]);
    // Portfolio value = A only on day1, A+B on day2.
    expect(nums(series.values)).toEqual([1000, 1500]);
  });

  it("forward-fills a held asset that a snapshot failed to price that day", () => {
    const snapshots = [
      snap("2025-01-01T23:00:00.000Z", { "CN:A": 1000 }),
      snap("2025-01-02T23:00:00.000Z", {}), // price fetch failed — A omitted
      snap("2025-01-03T23:00:00.000Z", { "CN:A": 1100 }),
    ];
    const txs = [tx({ assetId: "CN:A", tradeDate: "2024-12-01T00:00:00.000Z" })];
    const series = buildPortfolioRiskSeries(snapshots, txs, idFx);
    // Day 2 carries the last known 1000 instead of collapsing to 0.
    expect(nums(series.perAsset.get("CN:A")!.values)).toEqual([1000, 1000, 1100]);
    expect(nums(series.values)).toEqual([1000, 1000, 1100]);
  });
});
