import { describe, expect, test } from "vitest";

import { createDefaultPriceAdapters, createDefaultRegistry } from "../src/registry";
import { createFrankfurterAdapter } from "../src/adapters/frankfurter";
import { NotFoundError } from "../src/errors";

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

describe("createDefaultPriceAdapters — Tushare / AKShare", () => {
  test("no tushare token — CN throws NotFoundError (S3-AC-A1.11)", () => {
    const adapters = createDefaultPriceAdapters({ finnhubApiKey: "k" });
    const registry = createDefaultRegistry({
      priceAdapters: adapters,
      fxAdapter: createFrankfurterAdapter(),
    });
    expect(() => registry.resolvePriceAdapter("CN")).toThrow(NotFoundError);
  });

  test("tushare token only — CN resolves; HK/FUND still missing (Phase 1A)", () => {
    const adapters = createDefaultPriceAdapters({
      finnhubApiKey: "k",
      tushareToken: "t",
    });
    const registry = createDefaultRegistry({
      priceAdapters: adapters,
      fxAdapter: createFrankfurterAdapter(),
    });
    expect(registry.resolvePriceAdapter("CN").source).toBe("tushare-cn");
    expect(() => registry.resolvePriceAdapter("HK")).toThrow(NotFoundError);
    expect(() => registry.resolvePriceAdapter("FUND")).toThrow(NotFoundError);
  });

  test("akshare wrapper configured — HK/FUND resolve; CN withFallback when tushare present", () => {
    const adapters = createDefaultPriceAdapters({
      finnhubApiKey: "k",
      tushareToken: "t",
      akshareWrapperUrl: "https://wrapper.example",
      akshareWrapperToken: "arc",
    });
    const registry = createDefaultRegistry({
      priceAdapters: adapters,
      fxAdapter: createFrankfurterAdapter(),
    });
    expect(registry.resolvePriceAdapter("CN").source).toBe("tushare-cn");
    expect(registry.resolvePriceAdapter("HK").source).toBe("akshare-hk");
    expect(registry.resolvePriceAdapter("FUND").source).toBe("akshare-fund");
  });

  test("akshare only (no tushare) — CN uses akshare primary", () => {
    const adapters = createDefaultPriceAdapters({
      finnhubApiKey: "k",
      akshareWrapperUrl: "https://wrapper.example",
      akshareWrapperToken: "arc",
    });
    const registry = createDefaultRegistry({
      priceAdapters: adapters,
      fxAdapter: createFrankfurterAdapter(),
    });
    expect(registry.resolvePriceAdapter("CN").source).toBe("akshare-cn");
  });
});
