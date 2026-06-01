import { describe, expect, it } from "vitest";
import fc from "fast-check";
import Decimal from "decimal.js";

import { computeDailyDelta } from "../src/snapshot/compute-daily-delta";
import type {
  AssetDelta,
  Currency,
  MarketValuation,
  PortfolioDailySnapshot,
  PortfolioValuation,
  SnapshotAsset,
} from "../src/domain/types";

// ──────────────────────────────────────────────────────────────────────────
// Builders

const dec = (n: number | string): Decimal => new Decimal(n);

const mkAssetVal = (
  assetId: string,
  valueReporting: number | string,
  opts: { shares?: number; priceNative?: number; currency?: Currency } = {}
): MarketValuation => {
  const shares = dec(opts.shares ?? 1);
  const priceNative = dec(opts.priceNative ?? valueReporting);
  return {
    assetId,
    shares,
    priceNative,
    valueNative: shares.times(priceNative),
    nativeCurrency: opts.currency ?? "USD",
    valueReporting: dec(valueReporting),
    costBasisReporting: dec(valueReporting),
    unrealizedPnL: dec(0),
    unrealizedPnLPercent: dec(0),
    dailyChangePercent: null,
    reportingCurrency: "CNY",
    fxRateUsed: dec(1),
    priceAsOf: "2026-05-17T00:00:00.000Z",
    fxAsOf: "2026-05-17T00:00:00.000Z",
  };
};

const mkCurrent = (
  perAsset: MarketValuation[],
  totalValue: number | string
): PortfolioValuation => ({
  portfolioId: "portfolio-1",
  reportingCurrency: "CNY",
  totalValue: dec(totalValue),
  totalCostBasis: dec(totalValue),
  totalUnrealizedPnL: dec(0),
  totalUnrealizedPnLPercent: dec(0),
  perAsset,
  computedAt: "2026-05-17T01:00:00.000Z",
});

const mkSnapshotAsset = (
  assetId: string,
  valueReporting: number | string,
  opts: { shares?: number; currency?: Currency } = {}
): SnapshotAsset => ({
  assetId,
  shares: dec(opts.shares ?? 1),
  valueNative: dec(valueReporting),
  currency: opts.currency ?? "USD",
  valueReporting: dec(valueReporting),
});

const mkBaseline = (
  perAsset: SnapshotAsset[],
  totalValue: number | string
): PortfolioDailySnapshot => ({
  portfolioId: "portfolio-1",
  asOf: "2026-05-16T23:00:00.000Z",
  reportingCurrency: "CNY",
  totalValue: dec(totalValue),
  totalCostBasis: dec(totalValue),
  perAsset,
  source: "edge-function",
  createdAt: "2026-05-16T23:00:01.000Z",
});

// ──────────────────────────────────────────────────────────────────────────
// Status branches

describe("computeDailyDelta — status branches", () => {
  it("empty-portfolio when current has no holdings", () => {
    const result = computeDailyDelta(mkCurrent([], 0), null);
    expect(result.status).toBe("empty-portfolio");
    expect(result.movers).toHaveLength(0);
    expect(result.totalDeltaReporting.toString()).toBe("0");
    expect(result.baselineAsOf).toBeNull();
  });

  it("no-baseline when current has holdings but snapshot is null", () => {
    const current = mkCurrent([mkAssetVal("US:AAPL", 1000)], 1000);
    const result = computeDailyDelta(current, null);
    expect(result.status).toBe("no-baseline");
    expect(result.totalDeltaReporting.toString()).toBe("0");
    expect(result.movers).toHaveLength(0);
    expect(result.baselineAsOf).toBeNull();
  });

  it("ok when both current and baseline have holdings", () => {
    const current = mkCurrent([mkAssetVal("US:AAPL", 1100)], 1100);
    const baseline = mkBaseline([mkSnapshotAsset("US:AAPL", 1000)], 1000);
    const result = computeDailyDelta(current, baseline);
    expect(result.status).toBe("ok");
    expect(result.baselineAsOf).toBe("2026-05-16T23:00:00.000Z");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Totals math (S2-AC-1.1)

describe("computeDailyDelta — totals", () => {
  it("totalDeltaReporting = sum of per-asset deltas for overnight-held assets", () => {
    const current = mkCurrent([mkAssetVal("US:AAPL", 10500)], 10500);
    const baseline = mkBaseline([mkSnapshotAsset("US:AAPL", 10000)], 10000);
    const result = computeDailyDelta(current, baseline);
    expect(result.totalDeltaReporting.toString()).toBe("500");
    expect(result.totalDeltaPercent.toString()).toBe("5");
  });

  it("handles fractional moves without floating-point error", () => {
    // 0.1 + 0.2 problem: any Number-based impl would show 5.0000000000004 or similar
    const current = mkCurrent([mkAssetVal("US:AAPL", "10010.5")], "10010.5");
    const baseline = mkBaseline([mkSnapshotAsset("US:AAPL", "10000.4")], "10000.4");
    const result = computeDailyDelta(current, baseline);
    expect(result.totalDeltaReporting.toString()).toBe("10.1");
  });

  it("totalDeltaReporting = 0 when no current asset had a baseline row (empty per_asset)", () => {
    const current = mkCurrent([mkAssetVal("US:AAPL", 1000)], 1000);
    const baseline = mkBaseline([], 0);
    const result = computeDailyDelta(current, baseline);
    expect(result.totalDeltaPercent.toString()).toBe("0");
    expect(result.totalDeltaReporting.toString()).toBe("0");
  });

  it("negative deltas pass through with sign preserved", () => {
    const current = mkCurrent([mkAssetVal("US:AAPL", 800)], 800);
    const baseline = mkBaseline([mkSnapshotAsset("US:AAPL", 1000)], 1000);
    const result = computeDailyDelta(current, baseline);
    expect(result.totalDeltaReporting.toString()).toBe("-200");
    expect(result.totalDeltaPercent.toString()).toBe("-20");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Mover sort (S2-AC-1.4)

describe("computeDailyDelta — mover sort", () => {
  it("sorts by absolute percentage descending", () => {
    // AAPL +0.5%, MSFT -3%, NVDA +8%, HOOD -1%, TSLA +0.2%
    const current = mkCurrent(
      [
        mkAssetVal("US:AAPL", "100.5"), // +0.5%
        mkAssetVal("US:MSFT", "97"), // -3%
        mkAssetVal("US:NVDA", "108"), // +8%
        mkAssetVal("US:HOOD", "99"), // -1%
        mkAssetVal("US:TSLA", "100.2"), // +0.2%
      ],
      100.5 + 97 + 108 + 99 + 100.2
    );
    const baseline = mkBaseline(
      [
        mkSnapshotAsset("US:AAPL", 100),
        mkSnapshotAsset("US:MSFT", 100),
        mkSnapshotAsset("US:NVDA", 100),
        mkSnapshotAsset("US:HOOD", 100),
        mkSnapshotAsset("US:TSLA", 100),
      ],
      500
    );
    const result = computeDailyDelta(current, baseline);
    const order = result.movers.map((m: AssetDelta) => m.assetId);
    // expect: NVDA (8) > MSFT (3) > HOOD (1) > AAPL (0.5) > TSLA (0.2)
    expect(order).toEqual(["US:NVDA", "US:MSFT", "US:HOOD", "US:AAPL", "US:TSLA"]);
  });

  it("breaks percentage ties deterministically by assetId", () => {
    // Both ±5%: ordered alphabetically so render output is reproducible
    const current = mkCurrent([mkAssetVal("US:MSFT", 105), mkAssetVal("US:AAPL", 95)], 200);
    const baseline = mkBaseline(
      [mkSnapshotAsset("US:MSFT", 100), mkSnapshotAsset("US:AAPL", 100)],
      200
    );
    const result = computeDailyDelta(current, baseline);
    const order = result.movers.map((m: AssetDelta) => m.assetId);
    // |MSFT delta%| = |AAPL delta%| = 5; alphabetical tiebreak
    expect(order).toEqual(["US:AAPL", "US:MSFT"]);
  });

  it("new position absent from baseline → deltaReporting and deltaPercent are 0", () => {
    const current = mkCurrent([mkAssetVal("US:NVDA", 32034.4)], 32034.4);
    const baseline = mkBaseline([mkSnapshotAsset("US:AAPL", 1000)], 1000);
    const result = computeDailyDelta(current, baseline);
    const nvda = result.movers.find((m: AssetDelta) => m.assetId === "US:NVDA")!;
    expect(nvda.deltaReporting.toString()).toBe("0");
    expect(nvda.deltaPercent.toString()).toBe("0");
    expect(nvda.currentValueReporting.toString()).toBe("32034.4");
  });

  it("includes new buys in movers but excludes them from headline total", () => {
    const current = mkCurrent([mkAssetVal("US:AAPL", 1100), mkAssetVal("US:HOOD", 500)], 1600);
    const baseline = mkBaseline([mkSnapshotAsset("US:AAPL", 1000)], 1000);
    const result = computeDailyDelta(current, baseline);
    const hood = result.movers.find((m: AssetDelta) => m.assetId === "US:HOOD")!;
    expect(hood).toBeDefined();
    expect(hood.deltaReporting.toString()).toBe("0");
    expect(hood.deltaPercent.toString()).toBe("0");
    expect(result.totalDeltaReporting.toString()).toBe("100"); // AAPL only
    expect(result.totalDeltaPercent.toString()).toBe("10");
  });

  it("excludes sold/deleted assets from headline total (not portfolio value delta)", () => {
    const current = mkCurrent([mkAssetVal("US:AAPL", 1000)], 1000);
    const baseline = mkBaseline(
      [mkSnapshotAsset("US:AAPL", 1000), mkSnapshotAsset("US:MSFT", 500)],
      1500
    );
    const result = computeDailyDelta(current, baseline);
    const msft = result.movers.find((m: AssetDelta) => m.assetId === "US:MSFT");
    expect(msft).toBeUndefined();
    expect(result.totalDeltaReporting.toString()).toBe("0");
    expect(result.totalDeltaPercent.toString()).toBe("0");
  });

  it("headline total matches sum of mover deltas when holdings were deleted overnight", () => {
    // Repro: user deleted ~¥187k of assets; movers ≈ -¥919, old total showed -¥187k.
    const current = mkCurrent(
      [
        mkAssetVal("US:UBER", 4771.21 - 109.18),
        mkAssetVal("FUND:007346", 23800 - 338.57),
        mkAssetVal("FUND:000216", 70400 - 678.79),
        mkAssetVal("US:IEF", 3843 + 157.59),
        mkAssetVal("FUND:012831", 17900 + 50.13),
      ],
      154940.21
    );
    const baseline = mkBaseline(
      [
        mkSnapshotAsset("US:UBER", 4771.21),
        mkSnapshotAsset("FUND:007346", 23800),
        mkSnapshotAsset("FUND:000216", 70400),
        mkSnapshotAsset("US:IEF", 3843),
        mkSnapshotAsset("FUND:012831", 17900),
        mkSnapshotAsset("US:REMOVED", 187000), // deleted — must not hit headline total
      ],
      342940.21
    );
    const result = computeDailyDelta(current, baseline);
    const sumMovers = result.movers.reduce((acc, m) => acc.plus(m.deltaReporting), dec(0));
    expect(sumMovers.toString()).toBe(result.totalDeltaReporting.toString());
    expect(result.totalDeltaReporting.toFixed(2)).toBe("-918.82");
    expect(result.totalDeltaReporting.toString()).not.toBe(
      current.totalValue.minus(baseline.totalValue).toString()
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Cross-currency baseline (regression: baseline frozen in CNY, current in USD)
//
// Repro: portfolio snapshot written by the Edge Function in the portfolio's
// reporting currency (CNY), then viewed after the user's *global* reporting
// currency switched to USD. The old impl subtracted current.valueReporting (USD)
// from baseline.valueReporting (CNY) → ~-85% on every asset + a garbage headline
// that scaled with the FX rate. Fix compares in native currency.

describe("computeDailyDelta — cross-currency baseline", () => {
  // A single US asset held overnight: yesterday 100 shares @ $100 = $10,000 native.
  // Baseline snapshot was stored with the portfolio in CNY (valueReporting in CNY),
  // today the user views in USD (fxRateUsed = 1 for a USD asset → USD reporting).
  const usAssetTodayUsd = (): MarketValuation => ({
    ...mkAssetVal("US:AAPL", 11000, { shares: 100, priceNative: 110, currency: "USD" }),
    // 100 sh × $110 = $11,000 native; viewing in USD so fx = 1, reporting = 11000
    valueReporting: dec(11000),
    reportingCurrency: "USD",
    fxRateUsed: dec(1),
  });

  const usAssetBaselineCny = (): SnapshotAsset => ({
    assetId: "US:AAPL",
    shares: dec(100),
    valueNative: dec(10000), // $10,000 native (currency-stable)
    currency: "USD",
    valueReporting: dec(72000), // frozen in CNY @ 7.2 — must be ignored
  });

  it("uses native delta, not the frozen cross-currency reporting value", () => {
    const current = mkCurrent([usAssetTodayUsd()], 11000);
    const baseline = mkBaseline([usAssetBaselineCny()], 72000);
    const result = computeDailyDelta(current, baseline);

    // Native overnight move: $10,000 → $11,000 = +$1,000 (+10%), NOT -85%.
    expect(result.movers[0].deltaReporting.toString()).toBe("1000");
    expect(result.movers[0].deltaPercent.toString()).toBe("10");
    expect(result.totalDeltaReporting.toString()).toBe("1000");
    expect(result.totalDeltaPercent.toString()).toBe("10");
  });

  it("deltaPercent is invariant to the reporting currency the user is viewing", () => {
    // Same native move, now viewed in CNY (fx 7.2). Percent must match the USD view.
    const currentCny = mkCurrent(
      [
        {
          ...usAssetTodayUsd(),
          valueReporting: dec(79200), // $11,000 × 7.2
          reportingCurrency: "CNY",
          fxRateUsed: dec("7.2"),
        },
      ],
      79200
    );
    const baseline = mkBaseline([usAssetBaselineCny()], 72000);
    const result = computeDailyDelta(currentCny, baseline);

    expect(result.movers[0].deltaPercent.toString()).toBe("10"); // same % as USD view
    // Reporting amount scales with FX: $1,000 native × 7.2 = ¥7,200.
    expect(result.movers[0].deltaReporting.toString()).toBe("7200");
    expect(result.totalDeltaPercent.toString()).toBe("10");
  });

  it("currency mismatch on the same assetId is treated as unreconcilable (no overnight delta)", () => {
    const current = mkCurrent([usAssetTodayUsd()], 11000);
    // Corrupt/legacy row: assetId matches but currency differs from today's native.
    const baseline = mkBaseline([{ ...usAssetBaselineCny(), currency: "HKD" as Currency }], 72000);
    const result = computeDailyDelta(current, baseline);

    expect(result.movers[0].deltaReporting.toString()).toBe("0");
    expect(result.movers[0].deltaPercent.toString()).toBe("0");
    expect(result.totalDeltaReporting.toString()).toBe("0");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Per-asset deltas

describe("computeDailyDelta — per-asset deltas", () => {
  it("currentValueReporting on the AssetDelta matches the current valuation", () => {
    const current = mkCurrent([mkAssetVal("US:AAPL", 1234.56)], 1234.56);
    const baseline = mkBaseline([mkSnapshotAsset("US:AAPL", 1000)], 1000);
    const result = computeDailyDelta(current, baseline);
    expect(result.movers[0].currentValueReporting.toString()).toBe("1234.56");
  });

  it("AssetDelta values are Decimal instances (not number)", () => {
    const current = mkCurrent([mkAssetVal("US:AAPL", 1100)], 1100);
    const baseline = mkBaseline([mkSnapshotAsset("US:AAPL", 1000)], 1000);
    const result = computeDailyDelta(current, baseline);
    expect(result.movers[0].deltaReporting).toBeInstanceOf(Decimal);
    expect(result.movers[0].deltaPercent).toBeInstanceOf(Decimal);
    expect(result.movers[0].currentValueReporting).toBeInstanceOf(Decimal);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Property-based invariants

describe("computeDailyDelta — property invariants", () => {
  it("sum of overnight-held mover deltas always equals headline totalDelta", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            assetId: fc.constantFrom("US:AAPL", "US:MSFT", "US:NVDA", "US:HOOD", "US:TSLA"),
            currentValue: fc.integer({ min: 1, max: 100_000 }),
            baselineValue: fc.integer({ min: 1, max: 100_000 }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (rows) => {
          // dedupe by assetId for safety; we want each asset to appear once
          const seen = new Set<string>();
          const deduped = rows.filter((r) => {
            if (seen.has(r.assetId)) return false;
            seen.add(r.assetId);
            return true;
          });

          const currentTotal = deduped.reduce((acc, r) => acc.plus(r.currentValue), dec(0));
          const baselineTotal = deduped.reduce((acc, r) => acc.plus(r.baselineValue), dec(0));

          const current = mkCurrent(
            deduped.map((r) => mkAssetVal(r.assetId, r.currentValue)),
            currentTotal.toString()
          );
          const baseline = mkBaseline(
            deduped.map((r) => mkSnapshotAsset(r.assetId, r.baselineValue)),
            baselineTotal.toString()
          );

          const result = computeDailyDelta(current, baseline);
          const sumOfMovers = result.movers.reduce((acc, m) => {
            const baselineValue = deduped.find((r) => r.assetId === m.assetId)!.baselineValue;
            if (baselineValue <= 0) return acc;
            return acc.plus(m.deltaReporting);
          }, dec(0));
          expect(sumOfMovers.toString()).toBe(result.totalDeltaReporting.toString());
        }
      )
    );
  });

  it("mover array is sorted: each |deltaPercent| ≥ the next one's", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            assetId: fc.string({ minLength: 3, maxLength: 8 }).map((s) => `US:${s.toUpperCase()}`),
            currentValue: fc.integer({ min: 1, max: 100_000 }),
            baselineValue: fc.integer({ min: 1, max: 100_000 }),
          }),
          { minLength: 2, maxLength: 8 }
        ),
        (rows) => {
          const seen = new Set<string>();
          const deduped = rows.filter((r) => {
            if (seen.has(r.assetId)) return false;
            seen.add(r.assetId);
            return true;
          });
          if (deduped.length < 2) return;

          const current = mkCurrent(
            deduped.map((r) => mkAssetVal(r.assetId, r.currentValue)),
            deduped.reduce((acc, r) => acc.plus(r.currentValue), dec(0)).toString()
          );
          const baseline = mkBaseline(
            deduped.map((r) => mkSnapshotAsset(r.assetId, r.baselineValue)),
            deduped.reduce((acc, r) => acc.plus(r.baselineValue), dec(0)).toString()
          );

          const result = computeDailyDelta(current, baseline);
          for (let i = 0; i < result.movers.length - 1; i++) {
            const a = result.movers[i].deltaPercent.abs();
            const b = result.movers[i + 1].deltaPercent.abs();
            expect(a.gte(b)).toBe(true);
          }
        }
      )
    );
  });

  it("currentReportingCurrency is always echoed back unchanged", () => {
    fc.assert(
      fc.property(fc.constantFrom("CNY", "USD", "HKD", "JPY", "BTC", "ETH"), (cur) => {
        const current = {
          ...mkCurrent([mkAssetVal("US:AAPL", 1000)], 1000),
          reportingCurrency: cur as Currency,
        };
        const baseline = mkBaseline([mkSnapshotAsset("US:AAPL", 900)], 900);
        const result = computeDailyDelta(current, baseline);
        expect(result.currentReportingCurrency).toBe(cur);
      })
    );
  });
});
