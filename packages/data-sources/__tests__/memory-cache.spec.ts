import { describe, expect, test, vi } from "vitest";
import Decimal from "decimal.js";

import { createMemoryPriceCache } from "../src/cache/memory-cache";
import type { PriceCache } from "../src/interfaces";
import type { PriceQuote } from "@arc/core";

const makeQuote = (assetId: string): PriceQuote => ({
  assetId,
  price: new Decimal("100"),
  currency: "USD",
  asOf: new Date().toISOString(),
  source: "test",
});

describe("createMemoryPriceCache", () => {
  test("returns memory hit without calling backend", async () => {
    const backendGet = vi.fn(async () => null);
    const backend: PriceCache = {
      get: backendGet,
      set: vi.fn(async () => undefined),
    };
    const cache = createMemoryPriceCache(backend);

    await cache.set(makeQuote("US:AAPL"));
    const hit = await cache.get("US:AAPL", 60_000);

    expect(hit?.assetId).toBe("US:AAPL");
    expect(backendGet).not.toHaveBeenCalled();
  });

  test("populates memory from backend read", async () => {
    const quote = makeQuote("US:MSFT");
    const backendGet = vi.fn(async () => quote);
    const backend: PriceCache = {
      get: backendGet,
      set: vi.fn(async () => undefined),
    };
    const cache = createMemoryPriceCache(backend);

    const first = await cache.get("US:MSFT", 60_000);
    const second = await cache.get("US:MSFT", 60_000);

    expect(first).toBe(quote);
    expect(second).toBe(quote);
    expect(backendGet).toHaveBeenCalledOnce();
  });
});
