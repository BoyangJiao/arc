/**
 * TWR window resolution tests — locks down spec §决策 8 ALL-range semantics
 * and the asset-boundary parity with @arc/core/returns/cash-flow.ts.
 */

import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import type { Transaction, TransactionType } from "@arc/core";

import {
  collectAssetBoundaryTimestamps,
  earliestPortfolioTradeDate,
  extendWindowForTwrPrices,
  resolveAssetTwrWindow,
  resolvePortfolioTwrWindow,
  TWR_PRICE_LOOKBACK_DAYS,
} from "../twr-window";

let seq = 0;
const mkTx = (opts: {
  type: TransactionType;
  assetId: string;
  tradeDate: string;
}): Transaction => ({
  id: `tx-${++seq}`,
  portfolioId: "p1",
  assetId: opts.assetId,
  type: opts.type,
  shares: new Decimal(1),
  pricePerShare: new Decimal(100),
  currency: "USD",
  fee: new Decimal(0),
  tradeDate: opts.tradeDate,
});

const NOW = new Date("2026-05-25T00:00:00.000Z");
const dayKey = (d: Date): string => d.toISOString().slice(0, 10);

describe("extendWindowForTwrPrices", () => {
  it("extends `from` by TWR_PRICE_LOOKBACK_DAYS for forward-fill at window start", () => {
    const window = { from: new Date("2026-04-25T00:00:00.000Z"), to: NOW };
    const extended = extendWindowForTwrPrices(window);
    expect(TWR_PRICE_LOOKBACK_DAYS).toBe(30);
    expect(dayKey(extended.from)).toBe("2026-03-26");
    expect(extended.to).toBe(window.to);
  });
});

describe("resolveAssetTwrWindow", () => {
  it("ALL with no transactions for the asset → rangeToWindow base unchanged (no clamp)", () => {
    const w = resolveAssetTwrWindow("ALL", [], "US:AAPL", NOW);
    // Empty txs → getAssetFirstBuyDate returns null → window untouched.
    // We don't assert a specific from date (depends on rangeToWindow ALL semantics);
    // we assert the function returns and to === today's end-of-UTC-day.
    expect(w.to.toISOString().slice(0, 10)).toBe("2026-05-25");
  });

  it("ALL clamps `from` to earliest BUY of this asset (NOT earliest SELL or DIVIDEND)", () => {
    const txs = [
      mkTx({ type: "DIVIDEND", assetId: "US:AAPL", tradeDate: "2023-12-01T00:00:00.000Z" }),
      mkTx({ type: "SELL", assetId: "US:AAPL", tradeDate: "2024-01-10T00:00:00.000Z" }),
      mkTx({ type: "BUY", assetId: "US:AAPL", tradeDate: "2024-06-15T00:00:00.000Z" }),
      mkTx({ type: "BUY", assetId: "US:AAPL", tradeDate: "2024-09-01T00:00:00.000Z" }),
    ];
    const w = resolveAssetTwrWindow("ALL", txs, "US:AAPL", NOW);
    expect(dayKey(w.from)).toBe("2024-06-15");
  });

  it("ALL ignores transactions for other assets (per-asset window)", () => {
    const txs = [
      mkTx({ type: "BUY", assetId: "US:MSFT", tradeDate: "2023-01-10T00:00:00.000Z" }),
      mkTx({ type: "BUY", assetId: "US:AAPL", tradeDate: "2024-06-15T00:00:00.000Z" }),
    ];
    const w = resolveAssetTwrWindow("ALL", txs, "US:AAPL", NOW);
    expect(dayKey(w.from)).toBe("2024-06-15");
  });

  it("non-ALL range passes through rangeToWindow unchanged (e.g. 1Y = -365 days from now)", () => {
    const txs = [mkTx({ type: "BUY", assetId: "US:AAPL", tradeDate: "2024-06-15T00:00:00.000Z" })];
    const w = resolveAssetTwrWindow("1Y", txs, "US:AAPL", NOW);
    // 1Y = 365 days back from NOW (2026-05-25). Should NOT clamp to 2024-06-15 even though
    // first BUY is later (i.e., ALL semantics do not bleed into 1Y).
    expect(dayKey(w.from)).toBe("2025-05-25");
  });
});

describe("resolvePortfolioTwrWindow", () => {
  it("ALL clamps `from` to earliest tradeDate of ANY type (BUY / SELL / DIVIDEND all qualify)", () => {
    // Portfolio-level ALL is broader than asset-level: any transaction counts as
    // "portfolio existed" because even a DIVIDEND received presupposes a holding.
    const txs = [
      mkTx({ type: "DIVIDEND", assetId: "US:AAPL", tradeDate: "2024-01-10T00:00:00.000Z" }),
      mkTx({ type: "BUY", assetId: "US:AAPL", tradeDate: "2024-06-15T00:00:00.000Z" }),
    ];
    const w = resolvePortfolioTwrWindow("ALL", txs, NOW);
    expect(dayKey(w.from)).toBe("2024-01-10");
  });
});

describe("collectAssetBoundaryTimestamps (parity with @arc/core/returns/cash-flow.ts strict bounds)", () => {
  it("excludes tx at from + at to; excludes wrong-type + wrong-asset; sorts/contains only inside-window BUY/SELL", () => {
    const from = new Date("2024-01-01T00:00:00.000Z");
    const to = new Date("2024-12-31T00:00:00.000Z");
    const inside = "2024-06-15T00:00:00.000Z";
    const txs = [
      mkTx({ type: "BUY", assetId: "US:AAPL", tradeDate: from.toISOString() }), // at from — excluded
      mkTx({ type: "BUY", assetId: "US:AAPL", tradeDate: inside }), // inside — INCLUDED
      mkTx({ type: "SELL", assetId: "US:AAPL", tradeDate: to.toISOString() }), // at to — excluded
      mkTx({ type: "DIVIDEND", assetId: "US:AAPL", tradeDate: "2024-08-15T00:00:00.000Z" }), // wrong type
      mkTx({ type: "BUY", assetId: "US:MSFT", tradeDate: "2024-09-15T00:00:00.000Z" }), // wrong asset
    ];
    const result = collectAssetBoundaryTimestamps(txs, "US:AAPL", from, to);
    expect(result).toHaveLength(1);
    expect(new Date(result[0]!).toISOString()).toBe(inside);
  });

  it("earliestPortfolioTradeDate returns null on empty (sanity)", () => {
    expect(earliestPortfolioTradeDate([])).toBeNull();
  });
});
