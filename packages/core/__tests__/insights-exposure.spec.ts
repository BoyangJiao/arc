/**
 * insights/exposure property + example tests.
 *
 * Maps to .specify/feature-specs/stage-3/insights-enrichment-stage-3.md (#4/#5, Test plan).
 *
 * Discipline:
 *   - All Decimal — never `number` (constitution §3.1)
 *   - Property tests for invariants (weight sum ≈ 1, ordering, empty handling)
 */

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import Decimal from "decimal.js";

import {
  aggregateExposure,
  marketExposure,
  currencyExposure,
  accountExposureBreakdown,
  ACCOUNT_UNASSIGNED,
} from "../src/insights/exposure";
import type { Currency, MarketValuation, Transaction } from "../src/domain/types";

const dec = (n: number | string): Decimal => new Decimal(n);

const mkVal = (
  assetId: string,
  valueReporting: number | string,
  nativeCurrency: Currency
): MarketValuation => ({
  assetId,
  shares: dec(1),
  priceNative: dec(valueReporting),
  valueNative: dec(valueReporting),
  nativeCurrency,
  valueReporting: dec(valueReporting),
  costBasisReporting: dec(valueReporting),
  unrealizedPnL: dec(0),
  unrealizedPnLPercent: dec(0),
  dailyChangePercent: null,
  reportingCurrency: "CNY",
  fxRateUsed: dec(1),
  priceAsOf: "2026-06-15T00:00:00Z",
  fxAsOf: "2026-06-15T00:00:00Z",
});

let txSeq = 0;
const mkTx = (over: Partial<Transaction> & { assetId: string }): Transaction => ({
  id: `tx-${++txSeq}`,
  portfolioId: "p1",
  type: "BUY",
  shares: dec(1),
  pricePerShare: dec(1),
  currency: "CNY",
  fee: dec(0),
  tradeDate: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("accountExposureBreakdown (#12)", () => {
  it("splits an asset's value across accounts by net-share fraction", () => {
    // 100 shares total, value ¥1000 → 60 in 支付宝, 40 in IBKR → ¥600 / ¥400.
    const perAsset = [mkVal("CN:600519", 1000, "CNY")];
    const txs = [
      mkTx({ assetId: "CN:600519", shares: dec(60), account: "支付宝" }),
      mkTx({ assetId: "CN:600519", shares: dec(40), account: "IBKR" }),
    ];
    const groups = accountExposureBreakdown(perAsset, txs);
    const byAccount = Object.fromEntries(groups.map((g) => [g.group, g.value.toString()]));
    expect(byAccount["支付宝"]).toBe("600");
    expect(byAccount["IBKR"]).toBe("400");
  });

  it("a SELL reduces that account's share fraction", () => {
    const perAsset = [mkVal("CN:600519", 1000, "CNY")];
    const txs = [
      mkTx({ assetId: "CN:600519", shares: dec(100), account: "支付宝" }),
      mkTx({ assetId: "CN:600519", type: "SELL", shares: dec(50), account: "支付宝" }),
    ]; // net 50 → all value in 支付宝
    const groups = accountExposureBreakdown(perAsset, txs);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.group).toBe("支付宝");
    expect(groups[0]!.value.toString()).toBe("1000");
  });

  it("untagged transactions fall into ACCOUNT_UNASSIGNED", () => {
    const perAsset = [mkVal("CN:600519", 500, "CNY")];
    const groups = accountExposureBreakdown(perAsset, [
      mkTx({ assetId: "CN:600519", shares: dec(10) }),
    ]);
    expect(groups[0]!.group).toBe(ACCOUNT_UNASSIGNED);
    expect(groups[0]!.value.toString()).toBe("500");
  });

  it("a net-negative account does not over-allocate the positive accounts", () => {
    // Import artifact: IBKR over-sold to net −20, 支付宝 net +100 → net total 80.
    // Proration must use the positive-share total (100), not net total (80), so
    // 支付宝 gets the full ¥1000 (not ¥1250) and the asset reconciles exactly.
    const perAsset = [mkVal("CN:600519", 1000, "CNY")];
    const txs = [
      mkTx({ assetId: "CN:600519", shares: dec(100), account: "支付宝" }),
      mkTx({ assetId: "CN:600519", type: "SELL", shares: dec(20), account: "IBKR" }),
    ];
    const groups = accountExposureBreakdown(perAsset, txs);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.group).toBe("支付宝");
    expect(groups[0]!.value.toString()).toBe("1000");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// aggregateExposure — properties

describe("aggregateExposure", () => {
  it("empty input → empty output", () => {
    expect(aggregateExposure([])).toEqual([]);
  });

  it("single positive row → weight = 1", () => {
    const out = aggregateExposure([{ group: "A", value: dec(42) }]);
    expect(out).toHaveLength(1);
    expect(out[0].weight.equals(1)).toBe(true);
  });

  it("all non-positive values → empty output (avoids div-by-zero)", () => {
    expect(
      aggregateExposure([
        { group: "A", value: dec(0) },
        { group: "B", value: dec(-5) },
      ])
    ).toEqual([]);
  });

  it("same group accumulates", () => {
    const out = aggregateExposure([
      { group: "X", value: dec(10) },
      { group: "X", value: dec(30) },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].value.equals(40)).toBe(true);
  });

  it("Decimal precision: 0.1 + 0.2 = 0.3 exactly in accumulation", () => {
    const out = aggregateExposure([
      { group: "X", value: dec("0.1") },
      { group: "X", value: dec("0.2") },
    ]);
    expect(out[0].value.equals(dec("0.3"))).toBe(true);
  });

  it("property: weights sum to 1 (within rounding tolerance) and descending by value", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            group: fc.constantFrom("A", "B", "C", "D"),
            value: fc.integer({ min: 1, max: 1_000_000 }),
          }),
          { minLength: 1, maxLength: 30 }
        ),
        (rows) => {
          const out = aggregateExposure(rows.map((r) => ({ group: r.group, value: dec(r.value) })));
          // weights sum ≈ 1
          const sum = out.reduce((acc, s) => acc.plus(s.weight), new Decimal(0));
          expect(sum.minus(1).abs().lessThan("1e-18")).toBe(true);
          // descending by value
          for (let i = 1; i < out.length; i++) {
            expect(out[i - 1].value.greaterThanOrEqualTo(out[i].value)).toBe(true);
          }
          // each weight in [0, 1]
          for (const s of out) {
            expect(s.weight.greaterThanOrEqualTo(0) && s.weight.lessThanOrEqualTo(1)).toBe(true);
          }
        }
      )
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// marketExposure / currencyExposure — examples

describe("marketExposure", () => {
  it("groups by market derived from assetId, descending", () => {
    const out = marketExposure([
      mkVal("US:AAPL", 100, "USD"),
      mkVal("CN:600519", 300, "CNY"),
      mkVal("US:MSFT", 100, "USD"),
    ]);
    expect(out[0].group).toBe("CN"); // 300 largest
    expect(out[0].value.equals(300)).toBe(true);
    const us = out.find((s) => s.group === "US")!;
    expect(us.value.equals(200)).toBe(true); // AAPL + MSFT
    expect(us.weight.equals(dec("0.4"))).toBe(true); // 200 / 500
  });
});

describe("currencyExposure", () => {
  it("groups by native currency regardless of reporting currency", () => {
    const out = currencyExposure([mkVal("US:AAPL", 200, "USD"), mkVal("HK:0700", 300, "HKD")]);
    expect(out.map((s) => s.group)).toEqual(["HKD", "USD"]);
  });
});
