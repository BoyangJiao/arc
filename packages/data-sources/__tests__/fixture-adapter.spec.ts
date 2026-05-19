import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";

import {
  createFixtureFxAdapter,
  createFixturePriceAdapter,
  createFixtureRegistry,
  type FixtureData,
} from "../src/adapters/fixture-adapter";
import { NotFoundError } from "../src/errors";

const FIXTURE: FixtureData = {
  quotes: {
    "US:AAPL": { price: "189.50", currency: "USD", asOf: "2026-05-17T00:00:00.000Z" },
    "US:MSFT": { price: "420.30", currency: "USD" },
    "CN:600519": { price: "1680.00", currency: "CNY" },
    "CASH:USD": { price: "1", currency: "USD" },
    "CASH:CNY": { price: "1", currency: "CNY" },
    "CASH:HKD": { price: "1", currency: "HKD" },
    "CASH:JPY": { price: "1", currency: "JPY" },
  },
  fx: {
    "USD->CNY": { rate: "7.20" },
    "HKD->CNY": { rate: "0.92", asOf: "2026-05-17T00:00:00.000Z" },
  },
};

describe("createFixturePriceAdapter", () => {
  it("returns a quote for a known symbol with Decimal price", async () => {
    const adapter = createFixturePriceAdapter("US", FIXTURE);
    const quote = await adapter.fetchLatest("AAPL");
    expect(quote.assetId).toBe("US:AAPL");
    expect(quote.price.toString()).toBe("189.5");
    expect(quote.currency).toBe("USD");
    expect(quote.source).toBe("fixture");
    expect(quote.price).toBeInstanceOf(Decimal);
  });

  it("upper-cases the input symbol", async () => {
    const adapter = createFixturePriceAdapter("US", FIXTURE);
    const quote = await adapter.fetchLatest("aapl");
    expect(quote.assetId).toBe("US:AAPL");
  });

  it("falls back to default asOf when fixture omits it", async () => {
    const adapter = createFixturePriceAdapter("US", FIXTURE);
    const quote = await adapter.fetchLatest("MSFT");
    expect(quote.asOf).toBe("2026-05-17T00:00:00.000Z");
  });

  it("throws NotFoundError for an unknown symbol with educational message", async () => {
    const adapter = createFixturePriceAdapter("US", FIXTURE);
    await expect(adapter.fetchLatest("TSLA")).rejects.toThrow(NotFoundError);
    await expect(adapter.fetchLatest("TSLA")).rejects.toThrow(/FixtureData/);
  });

  it("scoped to its market — does not leak cross-market lookups", async () => {
    // A CN adapter asking for AAPL must NOT find the US:AAPL fixture.
    const cnAdapter = createFixturePriceAdapter("CN", FIXTURE);
    await expect(cnAdapter.fetchLatest("AAPL")).rejects.toThrow(NotFoundError);
  });

  it("fetchHistorical returns the latest quote as a single-point series", async () => {
    const adapter = createFixturePriceAdapter("US", FIXTURE);
    const series = await adapter.fetchHistorical!("AAPL", new Date(), new Date());
    expect(series).toHaveLength(1);
    expect(series[0].assetId).toBe("US:AAPL");
  });
});

describe("createFixtureFxAdapter", () => {
  it("returns rate=1 for same-currency requests without touching the table", async () => {
    const fx = createFixtureFxAdapter({ quotes: {}, fx: {} });
    const rate = await fx.fetchRate("USD", "USD");
    expect(rate.rate.toString()).toBe("1");
    expect(rate.source).toBe("fixture");
  });

  it("returns the direct rate when present", async () => {
    const fx = createFixtureFxAdapter(FIXTURE);
    const rate = await fx.fetchRate("USD", "CNY");
    expect(rate.rate.toString()).toBe("7.2");
  });

  it("derives the reverse rate when only one direction is in the table", async () => {
    const fx = createFixtureFxAdapter(FIXTURE);
    // FIXTURE has USD->CNY; ask for CNY->USD → 1 / 7.20
    const rate = await fx.fetchRate("CNY", "USD");
    expect(rate.rate.toFixed(10)).toBe(new Decimal(1).dividedBy("7.20").toFixed(10));
  });

  it("throws NotFoundError when neither direction is present", async () => {
    const fx = createFixtureFxAdapter(FIXTURE);
    await expect(fx.fetchRate("JPY", "USD")).rejects.toThrow(NotFoundError);
  });
});

describe("createFixtureRegistry", () => {
  it("registers a price adapter for every Arc market", () => {
    const registry = createFixtureRegistry(FIXTURE);
    for (const market of ["US", "CN", "HK", "CRYPTO", "FUND", "CASH"] as const) {
      expect(() => registry.resolvePriceAdapter(market)).not.toThrow();
    }
  });

  it("resolves by assetId across markets", async () => {
    const registry = createFixtureRegistry(FIXTURE);
    const usAdapter = registry.resolvePriceAdapterByAssetId("US:AAPL");
    const cnAdapter = registry.resolvePriceAdapterByAssetId("CN:600519");
    expect(usAdapter.market).toBe("US");
    expect(cnAdapter.market).toBe("CN");
    const cnQuote = await cnAdapter.fetchLatest("600519");
    expect(cnQuote.assetId).toBe("CN:600519");
    expect(cnQuote.currency).toBe("CNY");
  });

  it("exposes a working FxAdapter", async () => {
    const registry = createFixtureRegistry(FIXTURE);
    const rate = await registry.fxAdapter.fetchRate("USD", "CNY");
    expect(rate.rate.toString()).toBe("7.2");
  });
});
