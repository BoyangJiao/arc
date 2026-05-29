import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import type { Holding, Transaction } from "@arc/core";

import {
  filterHoldingsByMarket,
  filterTransactionsByMarket,
  parseMarketFiltersParam,
  serializeMarketFilters,
  sumPerAssetReportingMap,
} from "../portfolio-market-filter";

const tx = (assetId: string): Transaction => ({
  id: "tx-1",
  portfolioId: "p1",
  assetId,
  type: "BUY",
  shares: new Decimal(1),
  pricePerShare: new Decimal(100),
  currency: "USD",
  fee: new Decimal(0),
  tradeDate: "2025-01-01T00:00:00.000Z",
});

const holding = (assetId: string): Holding => ({
  assetId,
  shares: new Decimal(1),
  averageCost: new Decimal(100),
  totalCostBasis: new Decimal(100),
  realizedPnL: new Decimal(0),
  totalDividends: new Decimal(0),
  portfolioId: "p1",
  currency: "USD",
});

describe("serializeMarketFilters / parseMarketFiltersParam", () => {
  it("round-trips selected markets for route params", () => {
    const serialized = serializeMarketFilters(new Set(["US", "FUND"]));
    expect(serialized).toBe("FUND,US");
    expect(parseMarketFiltersParam(serialized)).toEqual(new Set(["FUND", "US"]));
  });

  it("ignores unknown market codes", () => {
    expect(parseMarketFiltersParam("US,INVALID,HK")).toEqual(new Set(["US", "HK"]));
  });

  it("returns empty set when param is absent", () => {
    expect(parseMarketFiltersParam(undefined)).toEqual(new Set());
  });
});

describe("filterTransactionsByMarket", () => {
  it("keeps only transactions in selected markets", () => {
    const filtered = filterTransactionsByMarket(
      [tx("US:AAPL"), tx("FUND:000216")],
      new Set(["US"])
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.assetId).toBe("US:AAPL");
  });
});

describe("filterHoldingsByMarket", () => {
  it("keeps only holdings in selected markets", () => {
    const filtered = filterHoldingsByMarket(
      [holding("US:UBER"), holding("FUND:000216")],
      new Set(["US"])
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.assetId).toBe("US:UBER");
  });
});

describe("sumPerAssetReportingMap", () => {
  it("sums only assets in selected markets", () => {
    const map = new Map<string, Decimal>([
      ["US:UBER", new Decimal(1000)],
      ["FUND:000216", new Decimal(5000)],
    ]);
    expect(sumPerAssetReportingMap(map, new Set(["US"])).toString()).toBe("1000");
  });
});
