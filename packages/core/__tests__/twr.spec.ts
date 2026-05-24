/**
 * TWR unit tests (Stage 3 Block D — TWR spec commit #2).
 *
 * Maps to .specify/feature-specs/stage-3/twr-stage-3.md §S3-AC-D.1.1, .1.2,
 * .1.3, .1.4 + boundary-semantic edge cases. Property tests (≥ 20) live in
 * commit #4 (twr.property.spec.ts).
 *
 * Discipline: Decimal everywhere; readonly inputs; pure core under test.
 */

import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";

import { computeAssetTwr, computePortfolioTwr } from "../src/returns/twr";
import type { Currency, Transaction, TransactionType } from "../src/domain/types";

// ────────────────────────────────────────────────────────────────────────────
// Builders

const dec = (n: number | string): Decimal => new Decimal(n);
const d = (iso: string): Date => new Date(iso);

let txSeq = 0;
const mkTx = (opts: {
  type: TransactionType;
  assetId: string;
  shares: number | string;
  pricePerShare: number | string;
  currency?: Currency;
  tradeDate: string;
  notes?: string;
}): Transaction => ({
  id: `tx-${++txSeq}`,
  portfolioId: "p1",
  assetId: opts.assetId,
  type: opts.type,
  shares: dec(opts.shares),
  pricePerShare: dec(opts.pricePerShare),
  currency: opts.currency ?? "USD",
  fee: dec(0),
  tradeDate: opts.tradeDate,
  notes: opts.notes,
});

/** Build a valueAt mock from a date→value table; throws if asked for an unmapped date. */
const mockValueAt =
  (table: ReadonlyArray<readonly [string, number | string]>) =>
  (date: Date): Decimal => {
    const ms = date.getTime();
    for (const [iso, val] of table) {
      if (d(iso).getTime() === ms) return dec(val);
    }
    throw new Error(`mockValueAt: unmapped date ${date.toISOString()}`);
  };

/** Build a priceAt mock for a single asset. */
const mockPriceAt =
  (table: ReadonlyArray<readonly [string, number | string]>) =>
  (date: Date): Decimal => {
    const ms = date.getTime();
    for (const [iso, val] of table) {
      if (d(iso).getTime() === ms) return dec(val);
    }
    throw new Error(`mockPriceAt: unmapped date ${date.toISOString()}`);
  };

// ────────────────────────────────────────────────────────────────────────────
// computePortfolioTwr — 6 cases

describe("computePortfolioTwr", () => {
  it("S3-AC-D.1.1: no cash flow → TWR equals simple PnL (single sub-period)", () => {
    const result = computePortfolioTwr({
      portfolioId: "p1",
      reportingCurrency: "CNY",
      from: d("2026-01-01T00:00:00.000Z"),
      to: d("2026-12-31T00:00:00.000Z"),
      transactions: [],
      valueAt: mockValueAt([
        ["2026-01-01T00:00:00.000Z", 100000],
        ["2026-12-31T00:00:00.000Z", 120000],
      ]),
    });
    expect(result.subPeriods).toBe(1);
    expect(result.value.toString()).toBe("0.2");
    expect(result.startValue.toString()).toBe("100000");
    expect(result.endValue.toString()).toBe("120000");
    expect(result.netCashFlow.toString()).toBe("0");
  });

  it("S3-AC-D.1.3: mid-period cash injection isolated to its sub-period", () => {
    // ¥100k @ Jan 1 → ¥120k @ Jun 30 (no CF) → +¥50k CF @ Jul 1 → ¥180k @ Dec 31
    // sub1: (170k - 50k - 100k) / 100k = 0.20
    // sub2: (180k - 170k) / 170k ≈ 0.058823...
    // TWR = (1.20)(1.0588...) - 1 ≈ 0.27058...
    const txs = [
      mkTx({
        type: "BUY",
        assetId: "CASH:CNY",
        shares: 50000,
        pricePerShare: 1,
        currency: "CNY",
        tradeDate: "2026-07-01T00:00:00.000Z",
      }),
    ];
    const result = computePortfolioTwr({
      portfolioId: "p1",
      reportingCurrency: "CNY",
      from: d("2026-01-01T00:00:00.000Z"),
      to: d("2026-12-31T00:00:00.000Z"),
      transactions: txs,
      valueAt: mockValueAt([
        ["2026-01-01T00:00:00.000Z", 100000],
        ["2026-07-01T00:00:00.000Z", 170000],
        ["2026-12-31T00:00:00.000Z", 180000],
      ]),
    });
    expect(result.subPeriods).toBe(2);
    // exact: 1.20 × (180000/170000) - 1 = 0.270588235...
    expect(result.value.minus("0.270588235").abs().lt("0.000001")).toBe(true);
    expect(result.netCashFlow.toString()).toBe("50000");
    // Critical: simple PnL = (180k - 150k) / 150k = 0.20 — TWR (~27%) ≠ simple PnL (20%)
    expect(result.value.minus("0.20").abs().gt("0.05")).toBe(true);
  });

  it("S3-AC-D.1.4: DIVIDEND and SPLIT in transactions are NOT cash flows (single sub-period)", () => {
    const txs = [
      mkTx({
        type: "DIVIDEND",
        assetId: "US:AAPL",
        shares: 0,
        pricePerShare: 50,
        currency: "USD",
        tradeDate: "2026-05-01T00:00:00.000Z",
      }),
      mkTx({
        type: "SPLIT",
        assetId: "US:AAPL",
        shares: 0,
        pricePerShare: 0,
        currency: "USD",
        tradeDate: "2026-08-30T00:00:00.000Z",
      }),
    ];
    const result = computePortfolioTwr({
      portfolioId: "p1",
      reportingCurrency: "USD",
      from: d("2026-01-01T00:00:00.000Z"),
      to: d("2026-12-31T00:00:00.000Z"),
      transactions: txs,
      valueAt: mockValueAt([
        ["2026-01-01T00:00:00.000Z", 10000],
        ["2026-12-31T00:00:00.000Z", 11500],
      ]),
    });
    expect(result.subPeriods).toBe(1);
    expect(result.value.toString()).toBe("0.15");
  });

  it("multiple cash flows on the same day are consolidated into one boundary", () => {
    // Two BUY CASH:CNY on Jul 1 → consolidated into one Jul 1 boundary → 2 sub-periods (not 3).
    const txs = [
      mkTx({
        type: "BUY",
        assetId: "CASH:CNY",
        shares: 30000,
        pricePerShare: 1,
        currency: "CNY",
        tradeDate: "2026-07-01T00:00:00.000Z",
      }),
      mkTx({
        type: "BUY",
        assetId: "CASH:CNY",
        shares: 20000,
        pricePerShare: 1,
        currency: "CNY",
        tradeDate: "2026-07-01T00:00:00.000Z",
      }),
    ];
    const result = computePortfolioTwr({
      portfolioId: "p1",
      reportingCurrency: "CNY",
      from: d("2026-01-01T00:00:00.000Z"),
      to: d("2026-12-31T00:00:00.000Z"),
      transactions: txs,
      valueAt: mockValueAt([
        ["2026-01-01T00:00:00.000Z", 100000],
        ["2026-07-01T00:00:00.000Z", 170000],
        ["2026-12-31T00:00:00.000Z", 180000],
      ]),
    });
    expect(result.subPeriods).toBe(2);
    expect(result.netCashFlow.toString()).toBe("50000");
    expect(result.value.minus("0.270588235").abs().lt("0.000001")).toBe(true);
  });

  it("currency filter: BUY CASH:USD in CNY-reporting portfolio is NOT a cash flow", () => {
    // User holds CASH:USD as a position inside a CNY portfolio; buying more is an
    // internal conversion, not external funding.
    const txs = [
      mkTx({
        type: "BUY",
        assetId: "CASH:USD",
        shares: 1000,
        pricePerShare: 1,
        currency: "USD",
        tradeDate: "2026-07-01T00:00:00.000Z",
      }),
    ];
    const result = computePortfolioTwr({
      portfolioId: "p1",
      reportingCurrency: "CNY",
      from: d("2026-01-01T00:00:00.000Z"),
      to: d("2026-12-31T00:00:00.000Z"),
      transactions: txs,
      valueAt: mockValueAt([
        ["2026-01-01T00:00:00.000Z", 100000],
        ["2026-12-31T00:00:00.000Z", 115000],
      ]),
    });
    expect(result.subPeriods).toBe(1);
    expect(result.value.toString()).toBe("0.15");
    expect(result.netCashFlow.toString()).toBe("0");
  });

  it("negative return: portfolio drops without cash flow → TWR is negative", () => {
    const result = computePortfolioTwr({
      portfolioId: "p1",
      reportingCurrency: "USD",
      from: d("2026-01-01T00:00:00.000Z"),
      to: d("2026-12-31T00:00:00.000Z"),
      transactions: [],
      valueAt: mockValueAt([
        ["2026-01-01T00:00:00.000Z", 100000],
        ["2026-12-31T00:00:00.000Z", 80000],
      ]),
    });
    expect(result.value.toString()).toBe("-0.2");
    expect(result.subPeriods).toBe(1);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// computeAssetTwr — 4 cases

describe("computeAssetTwr", () => {
  it("S3-AC-D.1.1 asset: single BUY then hold — TWR equals price PnL", () => {
    // BUY 100 NVDA @ $400 on Jan 1; price $480 at year end → TWR = 20%.
    const txs = [
      mkTx({
        type: "BUY",
        assetId: "US:NVDA",
        shares: 100,
        pricePerShare: 400,
        currency: "USD",
        tradeDate: "2026-01-01T00:00:00.000Z",
      }),
    ];
    const result = computeAssetTwr({
      assetId: "US:NVDA",
      portfolioId: "p1",
      from: d("2026-01-02T00:00:00.000Z"), // after the BUY → no CF inside window
      to: d("2026-12-31T00:00:00.000Z"),
      transactions: txs,
      priceAt: mockPriceAt([
        ["2026-01-02T00:00:00.000Z", 400],
        ["2026-12-31T00:00:00.000Z", 480],
      ]),
    });
    expect(result.subPeriods).toBe(1);
    expect(result.value.toString()).toBe("0.2");
    expect(result.startValue.toString()).toBe("40000"); // 100 × 400
    expect(result.endValue.toString()).toBe("48000"); // 100 × 480
  });

  it("S3-AC-D.1.2: mid-period top-up isolated — TWR = (1.25)(1.20) - 1 = 50%", () => {
    // 2026-01-01 BUY 100 NVDA @ $400
    // 2026-04-01 price $500 → BUY 50 more @ $500
    // 2026-12-31 price $600
    // sub1: ($500 - $400) / $400 = 25%; sub2: ($600 - $500) / $500 = 20%
    // TWR = (1.25)(1.20) - 1 = 0.50
    const txs = [
      mkTx({
        type: "BUY",
        assetId: "US:NVDA",
        shares: 100,
        pricePerShare: 400,
        currency: "USD",
        tradeDate: "2026-01-01T00:00:00.000Z",
      }),
      mkTx({
        type: "BUY",
        assetId: "US:NVDA",
        shares: 50,
        pricePerShare: 500,
        currency: "USD",
        tradeDate: "2026-04-01T00:00:00.000Z",
      }),
    ];
    const result = computeAssetTwr({
      assetId: "US:NVDA",
      portfolioId: "p1",
      from: d("2026-01-02T00:00:00.000Z"),
      to: d("2026-12-31T00:00:00.000Z"),
      transactions: txs,
      priceAt: mockPriceAt([
        ["2026-01-02T00:00:00.000Z", 400],
        ["2026-04-01T00:00:00.000Z", 500],
        ["2026-12-31T00:00:00.000Z", 600],
      ]),
    });
    expect(result.subPeriods).toBe(2);
    expect(result.value.toString()).toBe("0.5");
    // Simple PnL = (150×600 - (100×400 + 50×500)) / (100×400 + 50×500)
    //            = (90000 - 65000) / 65000 ≈ 38.46% — TWR (50%) ≠ simple PnL.
    const simplePnl = dec(90000).minus(65000).div(65000);
    expect(result.value.minus(simplePnl).abs().gt("0.1")).toBe(true);
  });

  it("SELL mid-period creates a cash-outflow boundary", () => {
    // 2026-01-01 BUY 100 @ $400 → 2026-06-01 price $500, SELL 30 → 2026-12-31 price $450
    // sub1: ($500 - $400) / $400 = 25%
    // After sell: 70 shares. Value just after sell = 70 × $500 = $35,000
    // sub2: ($31,500 - $35,000) / $35,000 = -10%
    // TWR = (1.25)(0.90) - 1 = 0.125 = 12.5%
    const txs = [
      mkTx({
        type: "BUY",
        assetId: "US:AAPL",
        shares: 100,
        pricePerShare: 400,
        currency: "USD",
        tradeDate: "2026-01-01T00:00:00.000Z",
      }),
      mkTx({
        type: "SELL",
        assetId: "US:AAPL",
        shares: 30,
        pricePerShare: 500,
        currency: "USD",
        tradeDate: "2026-06-01T00:00:00.000Z",
      }),
    ];
    const result = computeAssetTwr({
      assetId: "US:AAPL",
      portfolioId: "p1",
      from: d("2026-01-02T00:00:00.000Z"),
      to: d("2026-12-31T00:00:00.000Z"),
      transactions: txs,
      priceAt: mockPriceAt([
        ["2026-01-02T00:00:00.000Z", 400],
        ["2026-06-01T00:00:00.000Z", 500],
        ["2026-12-31T00:00:00.000Z", 450],
      ]),
    });
    expect(result.subPeriods).toBe(2);
    // 1.25 × 0.90 - 1 = 0.125
    expect(result.value.minus("0.125").abs().lt("0.000001")).toBe(true);
    expect(result.netCashFlow.toString()).toBe("-15000"); // -30 × 500
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Edge case shared by both signatures

describe("degenerate window", () => {
  it("from == to → subPeriods=0, value=0 (no math run, no throw)", () => {
    const sameDate = d("2026-06-15T00:00:00.000Z");
    const result = computePortfolioTwr({
      portfolioId: "p1",
      reportingCurrency: "USD",
      from: sameDate,
      to: sameDate,
      transactions: [],
      valueAt: mockValueAt([["2026-06-15T00:00:00.000Z", 50000]]),
    });
    expect(result.subPeriods).toBe(0);
    expect(result.value.toString()).toBe("0");
    expect(result.startValue.toString()).toBe("50000");
    expect(result.endValue.toString()).toBe("50000");
  });
});
