/**
 * Rebalance engine property + example tests (Stage 2 J9).
 *
 * Maps to .specify/feature-specs/rebalance-stage-2.md §S2-AC-3.3, 3.5, 3.8.
 *
 * Discipline:
 *   - All Decimal — never `number` for money / shares (constitution §3.1)
 *   - Property tests for invariants that must hold across random inputs
 *   - Example tests for spec acceptance walkthroughs
 */

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import Decimal from "decimal.js";

import { computeRebalance, validateTargetAllocations, type DeviationItem } from "../src/rebalance";
import { decimalsForRounding, roundShares } from "../src/rebalance/rounding";
import type {
  Currency,
  Holding,
  Market,
  MarketValuation,
  TargetAllocation,
} from "../src/domain/types";

// ────────────────────────────────────────────────────────────────────────────
// Builders

const dec = (n: number | string): Decimal => new Decimal(n);

const mkVal = (
  assetId: string,
  opts: {
    shares: number | string;
    priceNative: number | string;
    nativeCurrency: Currency;
    fxRate?: number | string;
    reportingCurrency?: Currency;
  }
): MarketValuation => {
  const shares = dec(opts.shares);
  const priceNative = dec(opts.priceNative);
  const fxRateUsed = dec(opts.fxRate ?? 1);
  const valueNative = shares.times(priceNative);
  const valueReporting = valueNative.times(fxRateUsed);
  return {
    assetId,
    shares,
    priceNative,
    valueNative,
    nativeCurrency: opts.nativeCurrency,
    valueReporting,
    costBasisReporting: valueReporting,
    unrealizedPnL: new Decimal(0),
    unrealizedPnLPercent: new Decimal(0),
    reportingCurrency: opts.reportingCurrency ?? opts.nativeCurrency,
    fxRateUsed,
    priceAsOf: "2026-05-18T00:00:00Z",
    fxAsOf: "2026-05-18T00:00:00Z",
  };
};

const mkTarget = (assetId: string, percent: number | string): TargetAllocation => ({
  assetId,
  targetPercent: dec(percent),
});

// computeRebalance accepts holdings but ignores them in Stage 2 — supply empty for tests
const NO_HOLDINGS: ReadonlyArray<Holding> = [];

// ────────────────────────────────────────────────────────────────────────────
// validateTargetAllocations — 7 tests

describe("validateTargetAllocations", () => {
  it("empty array returns { code: 'empty' }", () => {
    const errs = validateTargetAllocations([]);
    expect(errs).toHaveLength(1);
    expect(errs[0].code).toBe("empty");
  });

  it("exact 100 sum returns []", () => {
    const errs = validateTargetAllocations([
      mkTarget("US:AAPL", 40),
      mkTarget("US:MSFT", 30),
      mkTarget("US:NVDA", 30),
    ]);
    expect(errs).toEqual([]);
  });

  it("sum within ±0.01 tolerance returns [] (33.33 / 33.33 / 33.34 = 100.00)", () => {
    const errs = validateTargetAllocations([
      mkTarget("US:AAPL", "33.33"),
      mkTarget("US:MSFT", "33.33"),
      mkTarget("US:NVDA", "33.34"),
    ]);
    expect(errs).toEqual([]);
  });

  it("sum 99.5 returns sum_not_100", () => {
    const errs = validateTargetAllocations([mkTarget("US:AAPL", 50), mkTarget("US:MSFT", "49.5")]);
    expect(errs).toHaveLength(1);
    expect(errs[0].code).toBe("sum_not_100");
    if (errs[0].code === "sum_not_100") {
      expect(errs[0].actual.toString()).toBe("99.5");
    }
  });

  it("duplicate asset id returns duplicate_asset error", () => {
    const errs = validateTargetAllocations([mkTarget("US:AAPL", 50), mkTarget("US:AAPL", 50)]);
    expect(errs.some((e) => e.code === "duplicate_asset")).toBe(true);
  });

  it("percent > 100 returns percent_out_of_range", () => {
    const errs = validateTargetAllocations([mkTarget("US:AAPL", 150)]);
    expect(errs.some((e) => e.code === "percent_out_of_range")).toBe(true);
  });

  it("percent < 0 returns percent_out_of_range", () => {
    const errs = validateTargetAllocations([mkTarget("US:AAPL", 110), mkTarget("US:MSFT", -10)]);
    const ranges = errs.filter((e) => e.code === "percent_out_of_range");
    expect(ranges.length).toBeGreaterThanOrEqual(1);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// roundShares — 5 tests including property

describe("roundShares", () => {
  it("US/CN/HK/FUND → integer floor toward zero", () => {
    expect(roundShares(dec("5.7"), "US", "USD").toString()).toBe("5");
    expect(roundShares(dec("5.7"), "CN", "CNY").toString()).toBe("5");
    expect(roundShares(dec("5.7"), "HK", "HKD").toString()).toBe("5");
    expect(roundShares(dec("5.7"), "FUND", "CNY").toString()).toBe("5");
  });

  it("CRYPTO → 8 decimals truncate toward zero", () => {
    expect(roundShares(dec("0.123456789"), "CRYPTO", "BTC").toString()).toBe("0.12345678");
  });

  it("CASH (non-JPY) → 2 decimals; CASH:JPY → 0 decimals", () => {
    expect(roundShares(dec("1234.567"), "CASH", "USD").toString()).toBe("1234.56");
    expect(roundShares(dec("1234.567"), "CASH", "CNY").toString()).toBe("1234.56");
    expect(roundShares(dec("123456.789"), "CASH", "JPY").toString()).toBe("123456");
  });

  it("negative raw rounds toward zero (not -∞)", () => {
    expect(roundShares(dec("-5.7"), "US", "USD").toString()).toBe("-5");
    expect(roundShares(dec("-0.123456789"), "CRYPTO", "BTC").toString()).toBe("-0.12345678");
  });

  it("property: |rounded| ≤ |raw| (truncation never inflates magnitude)", () => {
    fc.assert(
      fc.property(
        fc.float({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true }),
        fc.constantFrom<Market>("US", "CN", "HK", "CRYPTO", "FUND", "CASH"),
        fc.constantFrom<Currency>("USD", "CNY", "HKD", "JPY", "BTC", "ETH"),
        (n, market, currency) => {
          const raw = dec(n.toString());
          const rounded = roundShares(raw, market, currency);
          // |rounded| should never exceed |raw|
          expect(rounded.abs().lte(raw.abs())).toBe(true);
          // Decimal places ≤ table limit
          const dp = decimalsForRounding(market, currency);
          expect(rounded.decimalPlaces()).toBeLessThanOrEqual(dp);
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// computeRebalance — example walkthroughs

describe("computeRebalance — examples", () => {
  it("empty inputs → empty output", () => {
    const result = computeRebalance(NO_HOLDINGS, [], []);
    expect(result).toEqual([]);
  });

  it("zero total value → empty output (can't divide)", () => {
    const valuations = [mkVal("US:AAPL", { shares: 10, priceNative: 0, nativeCurrency: "USD" })];
    const result = computeRebalance(NO_HOLDINGS, valuations, [mkTarget("US:AAPL", 100)]);
    expect(result).toEqual([]);
  });

  it("perfectly aligned single asset → zero deviation, zero action", () => {
    const valuations = [mkVal("US:AAPL", { shares: 10, priceNative: 100, nativeCurrency: "USD" })];
    const result = computeRebalance(NO_HOLDINGS, valuations, [mkTarget("US:AAPL", 100)]);
    expect(result).toHaveLength(1);
    expect(result[0].deviationPercent.abs().lt("0.0001")).toBe(true);
    expect(result[0].amountNeeded.abs().lt("0.0001")).toBe(true);
    expect(result[0].sharesNeeded.toString()).toBe("0");
  });

  it("two assets — one overweight, one underweight (opposite signs)", () => {
    // Total = $2000; AAPL=$1500 (75%), MSFT=$500 (25%); targets 50/50
    const valuations = [
      mkVal("US:AAPL", { shares: 10, priceNative: 150, nativeCurrency: "USD" }),
      mkVal("US:MSFT", { shares: 5, priceNative: 100, nativeCurrency: "USD" }),
    ];
    const targets = [mkTarget("US:AAPL", 50), mkTarget("US:MSFT", 50)];
    const result = computeRebalance(NO_HOLDINGS, valuations, targets);

    const aapl = result.find((d) => d.assetId === "US:AAPL")!;
    const msft = result.find((d) => d.assetId === "US:MSFT")!;

    expect(aapl.currentPercent.toString()).toBe("75");
    expect(msft.currentPercent.toString()).toBe("25");
    expect(aapl.deviationPercent.toString()).toBe("25"); // overweight +25
    expect(msft.deviationPercent.toString()).toBe("-25"); // underweight -25
    expect(aapl.amountNeeded.isNegative()).toBe(true); // sell AAPL
    expect(msft.amountNeeded.isPositive()).toBe(true); // buy MSFT
    // sharesNeeded follows sign of amountNeeded
    expect(aapl.sharesNeeded.isNegative()).toBe(true);
    expect(msft.sharesNeeded.isPositive()).toBe(true);
  });

  it("S2-AC-3.5 example: 5.7 raw shares → floor to 5 for US equity", () => {
    // Setup so AAPL needs +5.7 raw shares
    // total = $2000, target AAPL = 92.85%, currentAAPL = $1000, priceAAPL = $100 → 10 shares
    // targetValue = 0.9285 × 2000 = 1857; amountNeeded = 857; sharesNeeded raw = 8.57; not 5.7
    // Let me pick numbers to land at exactly 5.7:
    // target 90% AAPL on $1000 total when AAPL is currently $430 at $100/share = 4.3 shares
    // target 90%: targetValue = 900; amountNeeded = 470; sharesNeeded raw = 4.7
    // Use higher precision: total=$2000, AAPL_value=$430, target=78.5% → 0.785×2000=1570; amount=1140; raw=11.4
    // Easier: just craft so raw = 5.7
    // total=$1000, AAPL_value=$100 (1 share @ $100), target=67%: targetValue=$670; amount=$570; raw=5.7
    const valuations = [
      mkVal("US:AAPL", { shares: 1, priceNative: 100, nativeCurrency: "USD" }),
      // 900 in "other" so total is 1000
      mkVal("US:MSFT", { shares: 9, priceNative: 100, nativeCurrency: "USD" }),
    ];
    const targets = [mkTarget("US:AAPL", 67), mkTarget("US:MSFT", 33)];
    const result = computeRebalance(NO_HOLDINGS, valuations, targets);
    const aapl = result.find((d) => d.assetId === "US:AAPL")!;
    // amountNeeded ≈ 570; rawShares = 5.7; floor → 5
    expect(aapl.sharesNeeded.toString()).toBe("5");
  });

  it("S2-AC-3.6: CASH asset participates in rebalance", () => {
    // 1000 USD cash + $1000 AAPL = $2000 total
    // target 50/50; perfectly aligned
    const valuations = [
      mkVal("US:AAPL", { shares: 10, priceNative: 100, nativeCurrency: "USD" }),
      mkVal("CASH:USD", { shares: 1000, priceNative: 1, nativeCurrency: "USD" }),
    ];
    const targets = [mkTarget("US:AAPL", 50), mkTarget("CASH:USD", 50)];
    const result = computeRebalance(NO_HOLDINGS, valuations, targets);
    expect(result).toHaveLength(2);
    expect(result.every((d) => d.deviationPercent.abs().lt("0.0001"))).toBe(true);
    // Now skew: AAPL appreciates to $200/share → AAPL=$2000, CASH=$1000, total=$3000
    // currentPct AAPL = 66.67%; target 50% → overweight +16.67%
    const skewed = [
      mkVal("US:AAPL", { shares: 10, priceNative: 200, nativeCurrency: "USD" }),
      mkVal("CASH:USD", { shares: 1000, priceNative: 1, nativeCurrency: "USD" }),
    ];
    const skewResult = computeRebalance(NO_HOLDINGS, skewed, targets);
    const cashItem = skewResult.find((d) => d.assetId === "CASH:USD")!;
    expect(cashItem.deviationPercent.isNegative()).toBe(true); // underweight
    expect(cashItem.amountNeeded.isPositive()).toBe(true); // need to BUY cash (sell AAPL)
    // sharesNeeded for CASH:USD is 2-decimal precision
    expect(cashItem.sharesNeeded.decimalPlaces()).toBeLessThanOrEqual(2);
  });

  it("S2-AC-3.8: multi-currency portfolio uses reporting currency consistently", () => {
    // AAPL (USD priced) + 600519 (CNY priced) + reporting=CNY
    // AAPL: 10 shares × $100 × 7 (FX USD→CNY) = ¥7000
    // 600519: 5 shares × ¥1500 × 1 = ¥7500
    // total = ¥14500
    // target AAPL=50%, 600519=50%
    const valuations = [
      mkVal("US:AAPL", {
        shares: 10,
        priceNative: 100,
        nativeCurrency: "USD",
        fxRate: 7,
        reportingCurrency: "CNY",
      }),
      mkVal("CN:600519", {
        shares: 5,
        priceNative: 1500,
        nativeCurrency: "CNY",
        fxRate: 1,
        reportingCurrency: "CNY",
      }),
    ];
    const result = computeRebalance(NO_HOLDINGS, valuations, [
      mkTarget("US:AAPL", 50),
      mkTarget("CN:600519", 50),
    ]);
    // Σ currentPercent ≈ 100
    const sumPct = result.reduce((acc, d) => acc.plus(d.currentPercent), new Decimal(0));
    expect(sumPct.minus(100).abs().lt("0.0001")).toBe(true);
    // AAPL currentPercent = 7000/14500 × 100 ≈ 48.275%
    const aapl = result.find((d) => d.assetId === "US:AAPL")!;
    expect(aapl.currentPercent.minus("48.2758").abs().lt("0.01")).toBe(true);
    // amountNeeded is in CNY (reporting currency)
    // amountNeeded AAPL = 0.5 × 14500 - 7000 = 250 CNY
    expect(aapl.amountNeeded.minus(250).abs().lt("0.01")).toBe(true);
    // sharesNeeded is in native AAPL shares; price-per-share-reporting = 100 × 7 = 700 CNY/share
    // raw = 250 / 700 ≈ 0.357; floor for US → 0
    expect(aapl.sharesNeeded.toString()).toBe("0");
  });

  it("target for unowned asset is skipped (Stage 2 simplification)", () => {
    const valuations = [mkVal("US:AAPL", { shares: 10, priceNative: 100, nativeCurrency: "USD" })];
    // Target includes MSFT but we don't hold it
    const result = computeRebalance(NO_HOLDINGS, valuations, [
      mkTarget("US:AAPL", 60),
      mkTarget("US:MSFT", 40),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].assetId).toBe("US:AAPL");
  });

  it("holding without target is also skipped (UI surfaces 'untargeted' separately)", () => {
    const valuations = [
      mkVal("US:AAPL", { shares: 10, priceNative: 100, nativeCurrency: "USD" }),
      mkVal("US:MSFT", { shares: 5, priceNative: 200, nativeCurrency: "USD" }),
    ];
    const result = computeRebalance(NO_HOLDINGS, valuations, [mkTarget("US:AAPL", 100)]);
    expect(result).toHaveLength(1);
    expect(result[0].assetId).toBe("US:AAPL");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// computeRebalance — property tests

describe("computeRebalance — properties", () => {
  // Generator: a fully-targeted portfolio (every holding has a target; targets sum to 100)
  type Scenario = {
    valuations: ReadonlyArray<MarketValuation>;
    targets: ReadonlyArray<TargetAllocation>;
  };

  const arbScenario = (): fc.Arbitrary<Scenario> =>
    fc
      .array(
        fc.record({
          symbol: fc.string({ minLength: 3, maxLength: 5 }).map((s) => s.toUpperCase()),
          shares: fc.integer({ min: 1, max: 100 }),
          priceNative: fc.integer({ min: 1, max: 1000 }),
          targetWeight: fc.integer({ min: 1, max: 100 }), // pre-normalization weight
        }),
        { minLength: 1, maxLength: 6 }
      )
      .map((rows) => {
        // Deduplicate symbols (generator may produce dupes)
        const seen = new Set<string>();
        const unique = rows.filter((r) => {
          const ok = !seen.has(r.symbol);
          seen.add(r.symbol);
          return ok;
        });

        // Normalize targetWeight to sum exactly 100 (with last entry absorbing rounding residual)
        const totalWeight = unique.reduce((acc, r) => acc + r.targetWeight, 0);
        const targets: TargetAllocation[] = unique.map((r, i) => {
          if (i === unique.length - 1) {
            const sumSoFar = unique
              .slice(0, i)
              .reduce(
                (acc, prev) => acc.plus(dec(prev.targetWeight).div(totalWeight).times(100)),
                new Decimal(0)
              );
            return { assetId: `US:${r.symbol}`, targetPercent: dec(100).minus(sumSoFar) };
          }
          return {
            assetId: `US:${r.symbol}`,
            targetPercent: dec(r.targetWeight).div(totalWeight).times(100),
          };
        });

        const valuations = unique.map((r) =>
          mkVal(`US:${r.symbol}`, {
            shares: r.shares,
            priceNative: r.priceNative,
            nativeCurrency: "USD",
          })
        );

        return { valuations, targets };
      });

  it("property: Σ currentPercent ≈ 100 when every holding has a target", () => {
    fc.assert(
      fc.property(arbScenario(), ({ valuations, targets }) => {
        const result = computeRebalance(NO_HOLDINGS, valuations, targets);
        if (result.length === 0) return; // skip degenerate cases
        const sumPct = result.reduce((acc, d) => acc.plus(d.currentPercent), new Decimal(0));
        expect(sumPct.minus(100).abs().lt("0.0001")).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it("property: amountNeeded sign is opposite of deviationPercent sign", () => {
    fc.assert(
      fc.property(arbScenario(), ({ valuations, targets }) => {
        const result = computeRebalance(NO_HOLDINGS, valuations, targets);
        for (const item of result) {
          if (item.deviationPercent.abs().lt("0.0001")) continue; // skip ~zero
          const devSign = item.deviationPercent.isPositive() ? 1 : -1;
          const amtSign = item.amountNeeded.isPositive() ? 1 : -1;
          expect(amtSign).toBe(-devSign);
        }
      }),
      { numRuns: 200 }
    );
  });

  it("property: sharesNeeded respects per-market rounding (US = integer)", () => {
    fc.assert(
      fc.property(arbScenario(), ({ valuations, targets }) => {
        const result = computeRebalance(NO_HOLDINGS, valuations, targets);
        for (const item of result) {
          // All assets in arbScenario use US market
          expect(item.sharesNeeded.decimalPlaces()).toBeLessThanOrEqual(0);
          expect(item.sharesNeeded.isInteger()).toBe(true);
        }
      }),
      { numRuns: 200 }
    );
  });

  it("property: |sharesNeeded × pricePerShare| ≤ |amountNeeded| (rounding never inflates)", () => {
    fc.assert(
      fc.property(arbScenario(), ({ valuations, targets }) => {
        const result = computeRebalance(NO_HOLDINGS, valuations, targets);
        const valByAsset = new Map(valuations.map((v) => [v.assetId, v] as const));
        for (const item of result) {
          const val = valByAsset.get(item.assetId)!;
          if (val.shares.isZero()) continue;
          const pricePerShareReporting = val.valueReporting.div(val.shares);
          const roundedAmount = item.sharesNeeded.times(pricePerShareReporting).abs();
          expect(roundedAmount.lte(item.amountNeeded.abs().plus("0.0001"))).toBe(true);
        }
      }),
      { numRuns: 200 }
    );
  });

  it("property: post-rounding residual = Σ amountNeeded - Σ (sharesNeeded × price) is bounded", () => {
    // Internal rebalance invariant (spec §Risk #1): residual should be small
    // (at most ~price of 1 share per asset across the portfolio)
    fc.assert(
      fc.property(arbScenario(), ({ valuations, targets }) => {
        const result = computeRebalance(NO_HOLDINGS, valuations, targets);
        if (result.length === 0) return;

        const valByAsset = new Map(valuations.map((v) => [v.assetId, v] as const));
        const sumAmount = result.reduce((acc, d) => acc.plus(d.amountNeeded), new Decimal(0));
        const sumExecuted = result.reduce((acc, d) => {
          const val = valByAsset.get(d.assetId)!;
          if (val.shares.isZero()) return acc;
          const price = val.valueReporting.div(val.shares);
          return acc.plus(d.sharesNeeded.times(price));
        }, new Decimal(0));

        // Σ amountNeeded should be ~0 (internal rebalance) before rounding
        expect(sumAmount.abs().lt("0.01")).toBe(true);

        // After rounding, residual is at most ~max(price) per asset (1 share floor each)
        // Use 2× safety factor on max single-share price as the bound
        const maxPricePerShare = valuations.reduce((acc, v) => {
          if (v.shares.isZero()) return acc;
          const p = v.valueReporting.div(v.shares);
          return p.gt(acc) ? p : acc;
        }, new Decimal(0));
        const bound = maxPricePerShare.times(result.length).times(2);
        expect(sumExecuted.abs().lte(bound.plus("0.01"))).toBe(true);
      }),
      { numRuns: 200 }
    );
  });
});
