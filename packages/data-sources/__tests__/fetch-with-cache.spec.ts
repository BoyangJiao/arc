/**
 * fetch-with-cache facade tests — verify read-first + write-back behaviour.
 *
 * Uses fake adapter + fake cache implementations (no fetch, no DB).
 */

import { describe, expect, test, vi } from "vitest";
import Decimal from "decimal.js";

import { fetchPriceWithCache, fetchFxWithCache } from "../src/fetch-with-cache";
import type { FxAdapter, FxCache, PriceAdapter, PriceCache } from "../src/interfaces";
import type { FxRate, PriceQuote } from "@arc/core";

const makePriceQuote = (overrides: Partial<PriceQuote> = {}): PriceQuote => ({
  assetId: "US:AAPL",
  price: new Decimal("180.50"),
  currency: "USD",
  asOf: new Date().toISOString(),
  source: "test",
  ...overrides,
});

const makeFxRate = (overrides: Partial<FxRate> = {}): FxRate => ({
  from: "USD",
  to: "CNY",
  rate: new Decimal("7.2"),
  asOf: new Date().toISOString(),
  source: "test",
  ...overrides,
});

const makePriceAdapter = (fetchLatestImpl?: PriceAdapter["fetchLatest"]): PriceAdapter => ({
  market: "US",
  source: "test",
  fetchLatest: fetchLatestImpl ?? vi.fn(async () => makePriceQuote()),
});

const makePriceCache = (getImpl?: PriceCache["get"], setImpl?: PriceCache["set"]): PriceCache => ({
  get: getImpl ?? vi.fn(async () => null),
  set: setImpl ?? vi.fn(async () => undefined),
});

const makeFxAdapter = (fetchRateImpl?: FxAdapter["fetchRate"]): FxAdapter => ({
  source: "test",
  fetchRate: fetchRateImpl ?? vi.fn(async () => makeFxRate()),
});

const makeFxCache = (getImpl?: FxCache["get"], setImpl?: FxCache["set"]): FxCache => ({
  get: getImpl ?? vi.fn(async () => null),
  set: setImpl ?? vi.fn(async () => undefined),
});

describe("fetchPriceWithCache", () => {
  test("cache hit: skips adapter call and returns cached quote", async () => {
    const cached = makePriceQuote({ price: new Decimal("999") });
    const cacheGet = vi.fn(async () => cached);
    const adapterFetch = vi.fn(async () => makePriceQuote());

    const cache = makePriceCache(cacheGet);
    const adapter = makePriceAdapter(adapterFetch);

    const out = await fetchPriceWithCache({ adapter, symbol: "AAPL", cache });

    expect(out).toBe(cached);
    expect(adapterFetch).not.toHaveBeenCalled();
  });

  test("cache miss: calls adapter and writes back to cache", async () => {
    const fresh = makePriceQuote({ price: new Decimal("500") });
    const adapterFetch = vi.fn(async () => fresh);
    const cacheSet = vi.fn(async () => undefined);

    const cache = makePriceCache(undefined, cacheSet);
    const adapter = makePriceAdapter(adapterFetch);

    const out = await fetchPriceWithCache({ adapter, symbol: "AAPL", cache });

    expect(out).toBe(fresh);
    expect(adapterFetch).toHaveBeenCalledOnce();
    // set is fire-and-forget; await microtask
    await new Promise((r) => setTimeout(r, 0));
    expect(cacheSet).toHaveBeenCalledWith(fresh);
  });

  test("freshnessMs=0 bypasses cache even if hit available", async () => {
    const cacheGet = vi.fn(async () => makePriceQuote({ price: new Decimal("999") }));
    const adapterFetch = vi.fn(async () => makePriceQuote({ price: new Decimal("500") }));

    const cache = makePriceCache(cacheGet);
    const adapter = makePriceAdapter(adapterFetch);

    const out = await fetchPriceWithCache({
      adapter,
      symbol: "AAPL",
      cache,
      freshnessMs: 0,
    });

    expect(out.price.equals(new Decimal("500"))).toBe(true);
    expect(cacheGet).not.toHaveBeenCalled();
    expect(adapterFetch).toHaveBeenCalledOnce();
  });

  test("dedupes concurrent fetches for the same symbol", async () => {
    let resolveFetch!: (value: PriceQuote) => void;
    const fetchPromise = new Promise<PriceQuote>((resolve) => {
      resolveFetch = resolve;
    });
    const adapterFetch = vi.fn(async () => fetchPromise);
    const adapter = makePriceAdapter(adapterFetch);
    const cache = makePriceCache();

    const p1 = fetchPriceWithCache({ adapter, symbol: "AAPL", cache });
    const p2 = fetchPriceWithCache({ adapter, symbol: "AAPL", cache });

    const fresh = makePriceQuote();
    resolveFetch(fresh);

    const [a, b] = await Promise.all([p1, p2]);
    expect(a).toBe(fresh);
    expect(b).toBe(fresh);
    expect(adapterFetch).toHaveBeenCalledOnce();
  });

  test("no cache provided: just calls adapter", async () => {
    const fresh = makePriceQuote();
    const adapter = makePriceAdapter(vi.fn(async () => fresh));
    const out = await fetchPriceWithCache({ adapter, symbol: "AAPL" });
    expect(out).toBe(fresh);
  });

  test("constructs assetId with market prefix from adapter.market", async () => {
    const cacheGet = vi.fn(async () => null);
    const cache = makePriceCache(cacheGet);
    const adapter = makePriceAdapter();

    await fetchPriceWithCache({ adapter, symbol: "aapl", cache });
    expect(cacheGet).toHaveBeenCalledWith("US:AAPL", expect.any(Number));
  });
});

describe("fetchFxWithCache", () => {
  test("cache hit: skips adapter call", async () => {
    const cached = makeFxRate({ rate: new Decimal("99") });
    const adapterFetch = vi.fn(async () => makeFxRate());

    const cache = makeFxCache(vi.fn(async () => cached));
    const adapter = makeFxAdapter(adapterFetch);

    const out = await fetchFxWithCache({ adapter, from: "USD", to: "CNY", cache });
    expect(out).toBe(cached);
    expect(adapterFetch).not.toHaveBeenCalled();
  });

  test("cache miss: calls adapter and writes back", async () => {
    const fresh = makeFxRate({ rate: new Decimal("7.5") });
    const cacheSet = vi.fn(async () => undefined);
    const cache = makeFxCache(undefined, cacheSet);
    const adapter = makeFxAdapter(vi.fn(async () => fresh));

    const out = await fetchFxWithCache({ adapter, from: "USD", to: "CNY", cache });
    expect(out).toBe(fresh);
    await new Promise((r) => setTimeout(r, 0));
    expect(cacheSet).toHaveBeenCalledWith(fresh);
  });

  test("no cache: calls adapter directly", async () => {
    const fresh = makeFxRate();
    const adapter = makeFxAdapter(vi.fn(async () => fresh));
    const out = await fetchFxWithCache({ adapter, from: "USD", to: "CNY" });
    expect(out).toBe(fresh);
  });
});
