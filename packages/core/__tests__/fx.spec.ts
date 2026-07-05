/**
 * fx.spec — findRate / convert 单元测试
 *
 * 关键契约：查不到汇率必须返回 null（禁止静默 1:1），
 * 反向汇率取倒数，同 pair 多条取 asOf 最新。
 */

import Decimal from "decimal.js";
import { describe, expect, test } from "vitest";

import { convert, findRate } from "../src/fx";
import type { FxRate } from "../src/domain/types";

const rate = (
  from: FxRate["from"],
  to: FxRate["to"],
  value: string,
  asOf = "2026-07-01T00:00:00.000Z"
): FxRate => ({ from, to, rate: new Decimal(value), asOf, source: "test" });

describe("findRate", () => {
  test("same currency → identity rate 1", () => {
    const r = findRate("USD", "USD", []);
    expect(r).not.toBeNull();
    expect(r!.rate.equals(1)).toBe(true);
    expect(r!.source).toBe("identity");
  });

  test("direct match wins", () => {
    const r = findRate("USD", "CNY", [rate("USD", "CNY", "7.2")]);
    expect(r!.rate.equals(new Decimal("7.2"))).toBe(true);
  });

  test("multiple direct matches → latest asOf wins", () => {
    const r = findRate("USD", "CNY", [
      rate("USD", "CNY", "7.1", "2026-06-01T00:00:00.000Z"),
      rate("USD", "CNY", "7.3", "2026-07-01T00:00:00.000Z"),
      rate("USD", "CNY", "7.2", "2026-06-15T00:00:00.000Z"),
    ]);
    expect(r!.rate.equals(new Decimal("7.3"))).toBe(true);
  });

  test("inverse fallback → reciprocal with :inverse source", () => {
    const r = findRate("CNY", "USD", [rate("USD", "CNY", "8")]);
    expect(r).not.toBeNull();
    expect(r!.rate.equals(new Decimal("0.125"))).toBe(true);
    expect(r!.source).toBe("test:inverse");
    expect(r!.from).toBe("CNY");
    expect(r!.to).toBe("USD");
  });

  test("direct match preferred over inverse", () => {
    const r = findRate("USD", "CNY", [
      rate("CNY", "USD", "0.125"), // inverse would give 8
      rate("USD", "CNY", "7.2"),
    ]);
    expect(r!.rate.equals(new Decimal("7.2"))).toBe(true);
  });

  test("no rate at all → null (NEVER silent 1:1)", () => {
    expect(findRate("USD", "CNY", [])).toBeNull();
    expect(findRate("USD", "CNY", [rate("HKD", "CNY", "0.92")])).toBeNull();
  });

  test("zero inverse rate → null (no division by zero)", () => {
    expect(findRate("CNY", "USD", [rate("USD", "CNY", "0")])).toBeNull();
  });
});

describe("convert", () => {
  test("converts through direct rate", () => {
    const out = convert(new Decimal(100), "USD", "CNY", [rate("USD", "CNY", "7.2")]);
    expect(out!.equals(new Decimal(720))).toBe(true);
  });

  test("missing rate → null", () => {
    expect(convert(new Decimal(100), "USD", "CNY", [])).toBeNull();
  });

  test("same currency → unchanged amount", () => {
    const out = convert(new Decimal("123.45"), "USD", "USD", []);
    expect(out!.equals(new Decimal("123.45"))).toBe(true);
  });
});
