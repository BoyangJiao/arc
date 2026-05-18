import { describe, expect, test } from "vitest";

import { createDefaultRegistry } from "../src/registry";
import { createFrankfurterAdapter } from "../src/adapters/frankfurter";

describe("createDefaultRegistry", () => {
  test("always registers CASH price adapter", async () => {
    const registry = createDefaultRegistry({
      priceAdapters: {},
      fxAdapter: createFrankfurterAdapter(),
    });
    const cash = registry.resolvePriceAdapter("CASH");
    expect(cash.market).toBe("CASH");
    expect(cash.source).toBe("cash-constant");
    const quote = await cash.fetchLatest("USD");
    expect(quote.assetId).toBe("CASH:USD");
  });
});
