/**
 * Symbol search fallback — static list preferred; AV only on zero static matches.
 */

import { describe, expect, test, vi } from "vitest";

import type { PriceAdapter, SymbolSearchResult } from "../src/interfaces";
import { searchSymbolsWithFallback } from "../src/search-symbols";
import { searchStaticSymbols } from "../src/static-symbols";

const avHit: SymbolSearchResult = {
  assetId: "US:OBSCURE",
  symbol: "OBSCURE",
  name: "Obscure Corp",
  market: "US",
  currency: "USD",
};

const mockAdapter = (results: SymbolSearchResult[]): PriceAdapter => ({
  market: "US",
  source: "mock",
  fetchLatest: vi.fn(),
  searchSymbols: vi.fn(async () => results),
});

describe("searchStaticSymbols", () => {
  test("prefix match on symbol", () => {
    const hits = searchStaticSymbols("NVDA");
    expect(hits.some((h) => h.symbol === "NVDA")).toBe(true);
  });

  test("empty query returns no rows", () => {
    expect(searchStaticSymbols("   ")).toEqual([]);
  });
});

describe("searchSymbolsWithFallback", () => {
  test("returns static hits without calling adapter", async () => {
    const adapter = mockAdapter([avHit]);
    const results = await searchSymbolsWithFallback({ query: "NVDA", adapter });
    expect(results.some((r) => r.symbol === "NVDA")).toBe(true);
    expect(adapter.searchSymbols).not.toHaveBeenCalled();
  });

  test("falls back to adapter when static list has zero matches", async () => {
    const adapter = mockAdapter([avHit]);
    const results = await searchSymbolsWithFallback({
      query: "OBSCUREZZZ",
      adapter,
    });
    expect(results).toEqual([avHit]);
    expect(adapter.searchSymbols).toHaveBeenCalledWith("OBSCUREZZZ");
  });
});
