/**
 * Cash-flow detection tests (Stage 3 Block D — TWR spec commit #1).
 *
 * Maps to:
 *   - .specify/feature-specs/stage-3/twr-stage-3.md §决策 2 (cash-flow table)
 *   - S3-AC-D.1.4 (DIVIDEND/SPLIT excluded)
 *   - S3-AC-D.1.5 (transfer-tagged CASH tx still counts per-portfolio)
 *
 * Discipline: Decimal everywhere; readonly inputs; pure module under test.
 */

import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";

import { detectCashFlowEvents, isCashFlowTransaction } from "../src/returns/cash-flow";
import type { Currency, Transaction, TransactionType } from "../src/domain/types";

// ────────────────────────────────────────────────────────────────────────────
// Builder

const dec = (n: number | string): Decimal => new Decimal(n);

let txSeq = 0;
const mkTx = (opts: {
  type: TransactionType;
  assetId: string;
  shares: number | string;
  pricePerShare: number | string;
  currency?: Currency;
  tradeDate: string;
  notes?: string;
}): Transaction => ({
  id: `tx-${++txSeq}`,
  portfolioId: "p1",
  assetId: opts.assetId,
  type: opts.type,
  shares: dec(opts.shares),
  pricePerShare: dec(opts.pricePerShare),
  currency: opts.currency ?? "USD",
  fee: dec(0),
  tradeDate: opts.tradeDate,
  notes: opts.notes,
});

// ────────────────────────────────────────────────────────────────────────────
// isCashFlowTransaction — table-driven row predicate

describe("isCashFlowTransaction", () => {
  it.each<[string, Pick<Transaction, "type" | "assetId">, boolean]>([
    ["BUY US:AAPL → not cash flow", { type: "BUY", assetId: "US:AAPL" }, false],
    ["SELL US:AAPL → not cash flow", { type: "SELL", assetId: "US:AAPL" }, false],
    ["BUY CN:600519 → not cash flow", { type: "BUY", assetId: "CN:600519" }, false],
    ["BUY CRYPTO:bitcoin → not cash flow", { type: "BUY", assetId: "CRYPTO:bitcoin" }, false],
    ["BUY CASH:USD → cash flow", { type: "BUY", assetId: "CASH:USD" }, true],
    ["SELL CASH:USD → cash flow", { type: "SELL", assetId: "CASH:USD" }, true],
    ["BUY CASH:CNY → cash flow", { type: "BUY", assetId: "CASH:CNY" }, true],
    ["BUY CASH:HKD → cash flow", { type: "BUY", assetId: "CASH:HKD" }, true],
    ["DIVIDEND on US:AAPL → not cash flow", { type: "DIVIDEND", assetId: "US:AAPL" }, false],
    ["SPLIT on US:AAPL → not cash flow", { type: "SPLIT", assetId: "US:AAPL" }, false],
    ["ADJUSTMENT → not cash flow", { type: "ADJUSTMENT", assetId: "US:AAPL" }, false],
    [
      "DIVIDEND on CASH:USD (theoretical) → not cash flow (only BUY/SELL)",
      { type: "DIVIDEND", assetId: "CASH:USD" },
      false,
    ],
  ])("%s", (_label, partial, expected) => {
    const tx = mkTx({
      type: partial.type,
      assetId: partial.assetId,
      shares: 1,
      pricePerShare: 1,
      tradeDate: "2026-06-15T00:00:00.000Z",
    });
    expect(isCashFlowTransaction(tx)).toBe(expected);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// detectCashFlowEvents — filter + sign + window + sort

describe("detectCashFlowEvents", () => {
  it("filters out non-cash-flow transactions (BUY asset / DIVIDEND / SPLIT)", () => {
    const txs = [
      mkTx({
        type: "BUY",
        assetId: "US:AAPL",
        shares: 100,
        pricePerShare: 150,
        tradeDate: "2026-03-10T00:00:00.000Z",
      }),
      mkTx({
        type: "DIVIDEND",
        assetId: "US:AAPL",
        shares: 0,
        pricePerShare: 50,
        tradeDate: "2026-05-01T00:00:00.000Z",
      }),
      mkTx({
        type: "SPLIT",
        assetId: "US:AAPL",
        shares: 0,
        pricePerShare: 0,
        tradeDate: "2026-08-30T00:00:00.000Z",
      }),
    ];
    const events = detectCashFlowEvents(
      txs,
      new Date("2026-01-01T00:00:00.000Z"),
      new Date("2026-12-31T00:00:00.000Z")
    );
    expect(events).toEqual([]);
  });

  it("BUY CASH:USD produces +amount; SELL CASH:USD produces -amount", () => {
    const txs = [
      mkTx({
        type: "BUY",
        assetId: "CASH:USD",
        shares: 1000,
        pricePerShare: 1,
        currency: "USD",
        tradeDate: "2026-04-01T00:00:00.000Z",
      }),
      mkTx({
        type: "SELL",
        assetId: "CASH:USD",
        shares: 250,
        pricePerShare: 1,
        currency: "USD",
        tradeDate: "2026-09-15T00:00:00.000Z",
      }),
    ];
    const events = detectCashFlowEvents(
      txs,
      new Date("2026-01-01T00:00:00.000Z"),
      new Date("2026-12-31T00:00:00.000Z")
    );
    expect(events).toHaveLength(2);
    expect(events[0].amount.toString()).toBe("1000");
    expect(events[0].currency).toBe("USD");
    expect(events[1].amount.toString()).toBe("-250");
    expect(events[1].currency).toBe("USD");
  });

  it("amount = shares × pricePerShare (e.g. SELL CASH:CNY 1.5 × 100 = -150)", () => {
    const txs = [
      mkTx({
        type: "SELL",
        assetId: "CASH:CNY",
        shares: "1.5",
        pricePerShare: 100,
        currency: "CNY",
        tradeDate: "2026-06-15T00:00:00.000Z",
      }),
    ];
    const events = detectCashFlowEvents(
      txs,
      new Date("2026-01-01T00:00:00.000Z"),
      new Date("2026-12-31T00:00:00.000Z")
    );
    expect(events).toHaveLength(1);
    expect(events[0].amount.toString()).toBe("-150");
  });

  it("transfer-tagged CASH transactions are NOT special-cased (per-portfolio cash flow per spec §决策 2)", () => {
    // S3-AC-D.1.5: Portfolio A 转出 $1000 → Portfolio B 在 A 视角下是 cash outflow.
    const txs = [
      mkTx({
        type: "SELL",
        assetId: "CASH:USD",
        shares: 1000,
        pricePerShare: 1,
        currency: "USD",
        tradeDate: "2026-06-15T00:00:00.000Z",
        notes: "transfer-out-to-portfolio-B",
      }),
      mkTx({
        type: "BUY",
        assetId: "CASH:USD",
        shares: 1000,
        pricePerShare: 1,
        currency: "USD",
        tradeDate: "2026-06-15T00:00:00.000Z",
        notes: "transfer-in-from-portfolio-A",
      }),
    ];
    const events = detectCashFlowEvents(
      txs,
      new Date("2026-01-01T00:00:00.000Z"),
      new Date("2026-12-31T00:00:00.000Z")
    );
    // Both rows produce events — caller treats each portfolio's view independently.
    expect(events).toHaveLength(2);
    const amounts = events.map((e) => e.amount.toString()).sort();
    expect(amounts).toEqual(["-1000", "1000"]);
  });

  it("window is strict (from, to) — events exactly at from or to are excluded", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    const to = new Date("2026-12-31T00:00:00.000Z");
    const txs = [
      mkTx({
        type: "BUY",
        assetId: "CASH:USD",
        shares: 100,
        pricePerShare: 1,
        tradeDate: from.toISOString(),
      }),
      mkTx({
        type: "BUY",
        assetId: "CASH:USD",
        shares: 200,
        pricePerShare: 1,
        tradeDate: "2026-06-15T00:00:00.000Z",
      }),
      mkTx({
        type: "BUY",
        assetId: "CASH:USD",
        shares: 300,
        pricePerShare: 1,
        tradeDate: to.toISOString(),
      }),
    ];
    const events = detectCashFlowEvents(txs, from, to);
    expect(events).toHaveLength(1);
    expect(events[0].amount.toString()).toBe("200");
  });

  it("output is sorted ascending by date even if input is unsorted", () => {
    const txs = [
      mkTx({
        type: "BUY",
        assetId: "CASH:USD",
        shares: 300,
        pricePerShare: 1,
        tradeDate: "2026-09-15T00:00:00.000Z",
      }),
      mkTx({
        type: "BUY",
        assetId: "CASH:USD",
        shares: 100,
        pricePerShare: 1,
        tradeDate: "2026-03-01T00:00:00.000Z",
      }),
      mkTx({
        type: "BUY",
        assetId: "CASH:USD",
        shares: 200,
        pricePerShare: 1,
        tradeDate: "2026-06-15T00:00:00.000Z",
      }),
    ];
    const events = detectCashFlowEvents(
      txs,
      new Date("2026-01-01T00:00:00.000Z"),
      new Date("2026-12-31T00:00:00.000Z")
    );
    expect(events.map((e) => e.amount.toString())).toEqual(["100", "200", "300"]);
  });

  it("empty input → empty output; empty window → empty output", () => {
    expect(
      detectCashFlowEvents(
        [],
        new Date("2026-01-01T00:00:00.000Z"),
        new Date("2026-12-31T00:00:00.000Z")
      )
    ).toEqual([]);

    const txs = [
      mkTx({
        type: "BUY",
        assetId: "CASH:USD",
        shares: 100,
        pricePerShare: 1,
        tradeDate: "2026-06-15T00:00:00.000Z",
      }),
    ];
    // window collapsed to a single instant excludes the only event (strict bounds).
    const instant = new Date("2026-06-15T00:00:00.000Z");
    expect(detectCashFlowEvents(txs, instant, instant)).toEqual([]);
  });
});
