import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";

import {
  resolveTotalInvestedAmount,
  resolveSharesAndUnitPrice,
} from "../transaction-form-presenter";

describe("resolveSharesAndUnitPrice", () => {
  it("total mode derives shares from invested / unit price", () => {
    const r = resolveSharesAndUnitPrice(
      "total",
      null,
      new Decimal("2.913"),
      new Decimal("59909.47")
    );
    expect(r?.shares.times(r!.pricePerShare).toFixed(2)).toBe("59909.47");
    expect(r?.pricePerShare.toString()).toBe("2.913");
  });
});

describe("resolveTotalInvestedAmount", () => {
  it("uses explicit shares + total invested (ADR 016 v2)", () => {
    const r = resolveTotalInvestedAmount(new Decimal("20569.48"), new Decimal("59909.47"));
    expect(r?.shares.toString()).toBe("20569.48");
    expect(r?.pricePerShare.toNumber()).toBeCloseTo(59909.47 / 20569.48, 6);
    expect(r?.shares.times(r!.pricePerShare).toFixed(2)).toBe("59909.47");
  });
});
