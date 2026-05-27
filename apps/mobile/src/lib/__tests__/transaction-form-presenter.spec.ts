import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";

import { resolveSharesAndUnitPrice } from "../transaction-form-presenter";

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
