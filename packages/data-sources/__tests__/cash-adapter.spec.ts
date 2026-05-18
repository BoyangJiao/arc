import { describe, expect, test } from "vitest";
import Decimal from "decimal.js";

import { createCashPriceAdapter } from "../src/adapters/cash-adapter";

describe("Cash price adapter", () => {
  test("fetchLatest(USD) returns price=1 and currency USD", async () => {
    const adapter = createCashPriceAdapter();
    expect(adapter.market).toBe("CASH");
    expect(adapter.source).toBe("cash-constant");

    const quote = await adapter.fetchLatest("USD");
    expect(quote.assetId).toBe("CASH:USD");
    expect(quote.price).toBeInstanceOf(Decimal);
    expect(quote.price.equals(new Decimal(1))).toBe(true);
    expect(quote.currency).toBe("USD");
    expect(quote.source).toBe("cash-constant");
    expect(quote.asOf).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("fetchLatest normalizes symbol case to uppercase", async () => {
    const adapter = createCashPriceAdapter();
    const quote = await adapter.fetchLatest("cny");
    expect(quote.assetId).toBe("CASH:CNY");
    expect(quote.currency).toBe("CNY");
    expect(quote.price.equals(new Decimal(1))).toBe(true);
  });
});
