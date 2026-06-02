import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";

import {
  DECIMAL_TAG,
  decodeDecimals,
  deserialize,
  encodeDecimals,
  serialize,
} from "../decimal-safe-json";

describe("decimal-safe-json — primitives & structure", () => {
  it("passes through primitives unchanged", () => {
    for (const v of ["s", 42, true, false, null]) {
      expect(deserialize(serialize(v))).toEqual(v);
    }
  });

  it("preserves plain nested objects and arrays without Decimals", () => {
    const v = { a: 1, b: ["x", { c: true, d: null }], e: { f: "g" } };
    expect(deserialize(serialize(v))).toEqual(v);
  });

  it("encodes a Decimal as a tagged marker", () => {
    const encoded = encodeDecimals(new Decimal("1.5")) as Record<string, string>;
    expect(encoded[DECIMAL_TAG]).toBe("1.5");
  });
});

describe("decimal-safe-json — Decimal round-trip", () => {
  it("round-trips a top-level Decimal to an equal Decimal instance", () => {
    const out = deserialize(serialize(new Decimal("123.456789")));
    expect(Decimal.isDecimal(out)).toBe(true);
    expect((out as Decimal).equals(new Decimal("123.456789"))).toBe(true);
  });

  it("preserves high precision (no float rounding)", () => {
    // A value that would lose precision if it ever passed through a JS number.
    const raw = "0.1234567890123456789012345678";
    const out = deserialize(serialize(new Decimal(raw))) as Decimal;
    expect(out.toString()).toBe(raw);
    // The classic 0.1 + 0.2 trap stays exact through the round-trip.
    const sum = (deserialize(serialize(new Decimal("0.1"))) as Decimal).plus(
      deserialize(serialize(new Decimal("0.2"))) as Decimal
    );
    expect(sum.equals(new Decimal("0.3"))).toBe(true);
  });

  it("revived Decimals are usable (arithmetic does not throw)", () => {
    const out = deserialize(serialize({ price: new Decimal("10"), qty: new Decimal("3") })) as {
      price: Decimal;
      qty: Decimal;
    };
    expect(out.price.times(out.qty).toString()).toBe("30");
  });

  it("handles Decimals nested in arrays and objects", () => {
    const v = {
      total: new Decimal("999.99"),
      legs: [
        { id: "a", value: new Decimal("1.1") },
        { id: "b", value: new Decimal("2.2") },
      ],
      meta: { nested: { deep: new Decimal("-0.0001") } },
      nullable: null,
    };
    const out = deserialize(serialize(v)) as typeof v;
    expect(out.total.equals(new Decimal("999.99"))).toBe(true);
    expect(out.legs[1]!.value.equals(new Decimal("2.2"))).toBe(true);
    expect(out.legs[0]!.id).toBe("a");
    expect(out.meta.nested.deep.equals(new Decimal("-0.0001"))).toBe(true);
    expect(out.nullable).toBeNull();
  });
});

describe("decimal-safe-json — realistic PortfolioValuation shape (AC.OF.6)", () => {
  // Mirrors @arc/core MarketValuation / PortfolioValuation: nearly every numeric
  // field is a Decimal. This is the real risk surface — the persister must
  // revive ALL of them, not just top-level ones.
  const makeValuation = () => ({
    portfolioId: "pf-1",
    reportingCurrency: "CNY",
    totalValueReporting: new Decimal("1234567.89"),
    totalCostReporting: new Decimal("1000000"),
    perAsset: [
      {
        assetId: "CN:600519",
        shares: new Decimal("100"),
        priceNative: new Decimal("1688.88"),
        valueNative: new Decimal("168888"),
        nativeCurrency: "CNY",
        valueReporting: new Decimal("168888"),
        costBasisReporting: new Decimal("150000"),
        unrealizedPnL: new Decimal("18888"),
        unrealizedPnLPercent: new Decimal("12.592"),
        dailyChangePercent: new Decimal("-0.85"),
        reportingCurrency: "CNY",
        fxRateUsed: new Decimal("1"),
        priceAsOf: "2026-06-02T08:00:00.000Z",
        fxAsOf: "2026-06-02T08:00:00.000Z",
      },
      {
        assetId: "US:NVDA",
        shares: new Decimal("10"),
        priceNative: new Decimal("120.50"),
        valueNative: new Decimal("1205"),
        nativeCurrency: "USD",
        valueReporting: new Decimal("8675.36"),
        costBasisReporting: new Decimal("8000"),
        unrealizedPnL: new Decimal("675.36"),
        unrealizedPnLPercent: new Decimal("8.442"),
        dailyChangePercent: null,
        reportingCurrency: "CNY",
        fxRateUsed: new Decimal("7.2"),
        priceAsOf: "2026-06-02T08:00:00.000Z",
        fxAsOf: "2026-06-02T08:00:00.000Z",
      },
    ],
  });

  it("revives every Decimal field across the whole valuation", () => {
    const original = makeValuation();
    const out = deserialize(serialize(original)) as ReturnType<typeof makeValuation>;

    expect(out.totalValueReporting.equals(original.totalValueReporting)).toBe(true);
    expect(out.perAsset).toHaveLength(2);

    for (let i = 0; i < out.perAsset.length; i++) {
      const a = out.perAsset[i]!;
      const o = original.perAsset[i]!;
      // All numeric fields must be live Decimals with equal value.
      for (const key of [
        "shares",
        "priceNative",
        "valueNative",
        "valueReporting",
        "costBasisReporting",
        "unrealizedPnL",
        "unrealizedPnLPercent",
        "fxRateUsed",
      ] as const) {
        expect(Decimal.isDecimal(a[key])).toBe(true);
        expect((a[key] as Decimal).equals(o[key] as Decimal)).toBe(true);
      }
      // Non-Decimal fields unchanged.
      expect(a.assetId).toBe(o.assetId);
      expect(a.nativeCurrency).toBe(o.nativeCurrency);
      expect(a.priceAsOf).toBe(o.priceAsOf);
    }

    // Nullable Decimal stays null (not revived into Decimal(NaN)).
    expect(out.perAsset[1]!.dailyChangePercent).toBeNull();
    // Live arithmetic on a revived field.
    expect(out.perAsset[0]!.valueNative.dividedBy(out.perAsset[0]!.shares).toString()).toBe(
      "1688.88"
    );
  });
});

describe("decimal-safe-json — edge cases", () => {
  it("does not mutate the input value", () => {
    const d = new Decimal("5");
    const v = { d, arr: [d] };
    encodeDecimals(v);
    expect(Decimal.isDecimal(v.d)).toBe(true);
    expect(Decimal.isDecimal(v.arr[0])).toBe(true);
  });

  it("decodeDecimals is a no-op on already-decoded plain data", () => {
    const v = { a: 1, b: "x" };
    expect(decodeDecimals(v)).toEqual(v);
  });

  it("revives a marker that appears at the top level", () => {
    const out = decodeDecimals({ [DECIMAL_TAG]: "7.7" });
    expect(Decimal.isDecimal(out)).toBe(true);
    expect((out as Decimal).toString()).toBe("7.7");
  });
});
