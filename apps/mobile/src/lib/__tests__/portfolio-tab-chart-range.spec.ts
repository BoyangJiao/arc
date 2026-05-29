/**
 * Portfolio Tab — market filter scopes smart-default chart range (P1 polish).
 */

import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import type { Transaction } from "@arc/core";

import { pickDefaultRangeForTransactions } from "../default-chart-range";
import { filterTransactionsByMarket } from "../portfolio-market-filter";

const tx = (assetId: string, tradeDate: string): Transaction => ({
  id: `tx-${assetId}`,
  portfolioId: "p1",
  assetId,
  type: "BUY",
  shares: new Decimal(1),
  pricePerShare: new Decimal(100),
  currency: "CNY",
  fee: new Decimal(0),
  tradeDate,
});

describe("smart default chart range with market filter", () => {
  const now = new Date("2026-05-28T12:00:00.000Z");

  it("full portfolio uses earliest trade across markets", () => {
    const txs = [
      tx("CN:600519", "2026-05-03T12:00:00.000Z"),
      tx("US:AAPL", "2026-05-22T12:00:00.000Z"),
    ];
    expect(pickDefaultRangeForTransactions(txs, now)).toBe("1M");
  });

  it("US-only filter narrows default to 1W when US trades are recent", () => {
    const txs = [
      tx("CN:600519", "2026-05-03T12:00:00.000Z"),
      tx("US:AAPL", "2026-05-22T12:00:00.000Z"),
    ];
    const scoped = filterTransactionsByMarket(txs, new Set(["US"]));
    expect(pickDefaultRangeForTransactions(scoped, now)).toBe("1W");
  });
});
