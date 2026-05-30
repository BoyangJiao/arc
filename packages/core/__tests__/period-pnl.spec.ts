/**
 * Period P&L unit tests (Insights 盈亏分析 — pnl-analysis-insights spec).
 *
 * Maps to S-PNL.AC.1 (math correctness):
 *   AC.1.2 value change · AC.1.4 realized P&L · AC.1.5 curve anchor ·
 *   AC.1.6 ranking sort · AC.1.7 dividend-inclusive contribution.
 * Property tests (closure / degeneracy / monotonicity / determinism) live in
 * period-pnl.property.spec.ts.
 */

import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";

import {
  computePeriodPnl,
  computeRealizedPnlInPeriod,
  type PeriodPnlInput,
} from "../src/returns/period-pnl";
import type { Currency, Transaction, TransactionType } from "../src/domain/types";

const dec = (n: number | string): Decimal => new Decimal(n);
const D = (iso: string): Date => new Date(iso);

let seq = 0;
const mkTx = (opts: {
  type: TransactionType;
  assetId: string;
  shares: number | string;
  pricePerShare: number | string;
  fee?: number | string;
  currency?: Currency;
  tradeDate: string;
}): Transaction => ({
  id: `tx-${++seq}`,
  portfolioId: "p1",
  assetId: opts.assetId,
  type: opts.type,
  shares: dec(opts.shares),
  pricePerShare: dec(opts.pricePerShare),
  currency: opts.currency ?? "CNY",
  fee: dec(opts.fee ?? 0),
  tradeDate: opts.tradeDate,
});

/** fx = 1 (reporting == native) unless overridden. */
const fxOne: PeriodPnlInput["fxAt"] = () => dec(1);

/** Build a valueAt from an ISO→value map. */
const valueAtFrom =
  (m: Record<string, number>): PeriodPnlInput["valueAt"] =>
  (d) =>
    dec(m[d.toISOString()] ?? 0);

/** Build a perAssetValueAt from an ISO→(assetId→value) map. */
const perAssetFrom =
  (m: Record<string, Record<string, number>>): PeriodPnlInput["perAssetValueAt"] =>
  (d, assetId) =>
    dec(m[d.toISOString()]?.[assetId] ?? 0);

const FROM = D("2026-02-01T00:00:00.000Z");
const TO = D("2026-05-01T00:00:00.000Z");

describe("computePeriodPnl — value change (AC.1.2)", () => {
  it("valueChange = endValue − startValue − netInflow", () => {
    const txs = [
      // a BUY inside the period contributes to net inflow
      mkTx({
        type: "BUY",
        assetId: "CN:600519",
        shares: 10,
        pricePerShare: 5,
        tradeDate: "2026-03-01T00:00:00.000Z",
      }),
    ];
    const res = computePeriodPnl({
      from: FROM,
      to: TO,
      reportingCurrency: "CNY",
      valueAt: valueAtFrom({ [FROM.toISOString()]: 100, [TO.toISOString()]: 200 }),
      perAssetValueAt: perAssetFrom({}),
      transactions: txs,
      fxAt: fxOne,
      sampleDates: [],
    });
    expect(res.netInflow.toString()).toBe("50"); // 10 × 5
    expect(res.valueChange.toString()).toBe("50"); // 200 − 100 − 50
    expect(res.startValue.toString()).toBe("100");
    expect(res.endValue.toString()).toBe("200");
  });

  it("a BUY exactly at `from` is part of the baseline, not net inflow (half-open window)", () => {
    const txs = [
      mkTx({
        type: "BUY",
        assetId: "CN:600519",
        shares: 10,
        pricePerShare: 5,
        tradeDate: FROM.toISOString(),
      }),
    ];
    const res = computePeriodPnl({
      from: FROM,
      to: TO,
      reportingCurrency: "CNY",
      valueAt: valueAtFrom({ [FROM.toISOString()]: 50, [TO.toISOString()]: 60 }),
      perAssetValueAt: perAssetFrom({}),
      transactions: txs,
      fxAt: fxOne,
      sampleDates: [],
    });
    expect(res.netInflow.toString()).toBe("0");
    expect(res.valueChange.toString()).toBe("10");
  });

  it("cash deposits (CASH:* BUY) count as net inflow so they don't inflate gains", () => {
    const txs = [
      mkTx({
        type: "BUY",
        assetId: "CASH:CNY",
        shares: 10000,
        pricePerShare: 1,
        tradeDate: "2026-03-01T00:00:00.000Z",
      }),
    ];
    const res = computePeriodPnl({
      from: FROM,
      to: TO,
      reportingCurrency: "CNY",
      valueAt: valueAtFrom({ [FROM.toISOString()]: 0, [TO.toISOString()]: 10000 }),
      perAssetValueAt: perAssetFrom({}),
      transactions: txs,
      fxAt: fxOne,
      sampleDates: [],
    });
    expect(res.netInflow.toString()).toBe("10000");
    expect(res.valueChange.toString()).toBe("0"); // depositing cash is not a gain
    // CASH is excluded from the ranking
    expect(res.perAssetContribution).toHaveLength(0);
  });
});

describe("computeRealizedPnlInPeriod (AC.1.4)", () => {
  it("realized = shares × (sellPrice − averageCost_at_sell) for SELLs inside the window", () => {
    const txs = [
      mkTx({
        type: "BUY",
        assetId: "CN:600519",
        shares: 10,
        pricePerShare: 10,
        tradeDate: "2026-01-15T00:00:00.000Z",
      }),
      mkTx({
        type: "SELL",
        assetId: "CN:600519",
        shares: 5,
        pricePerShare: 15,
        tradeDate: "2026-03-10T00:00:00.000Z",
      }),
    ];
    const realized = computeRealizedPnlInPeriod(txs, FROM, TO, "CNY", fxOne);
    expect(realized.toString()).toBe("25"); // 5 × (15 − 10)
  });

  it("excludes SELLs outside the window", () => {
    const txs = [
      mkTx({
        type: "BUY",
        assetId: "CN:600519",
        shares: 10,
        pricePerShare: 10,
        tradeDate: "2026-01-15T00:00:00.000Z",
      }),
      mkTx({
        type: "SELL",
        assetId: "CN:600519",
        shares: 5,
        pricePerShare: 15,
        tradeDate: "2026-01-20T00:00:00.000Z",
      }),
    ];
    const realized = computeRealizedPnlInPeriod(txs, FROM, TO, "CNY", fxOne);
    expect(realized.toString()).toBe("0");
  });

  it("applies historical FX at the sell date", () => {
    const txs = [
      mkTx({
        type: "BUY",
        assetId: "US:AAPL",
        shares: 10,
        pricePerShare: 100,
        currency: "USD",
        tradeDate: "2026-01-15T00:00:00.000Z",
      }),
      mkTx({
        type: "SELL",
        assetId: "US:AAPL",
        shares: 5,
        pricePerShare: 120,
        currency: "USD",
        tradeDate: "2026-03-10T00:00:00.000Z",
      }),
    ];
    const fxSeven: PeriodPnlInput["fxAt"] = () => dec(7);
    const realized = computeRealizedPnlInPeriod(txs, FROM, TO, "CNY", fxSeven);
    expect(realized.toString()).toBe("700"); // 5 × (120 − 100) × 7
  });

  it("realized P&L surfaces on the full result too", () => {
    const txs = [
      mkTx({
        type: "BUY",
        assetId: "CN:600519",
        shares: 10,
        pricePerShare: 10,
        tradeDate: "2026-01-15T00:00:00.000Z",
      }),
      mkTx({
        type: "SELL",
        assetId: "CN:600519",
        shares: 4,
        pricePerShare: 20,
        tradeDate: "2026-03-10T00:00:00.000Z",
      }),
    ];
    const res = computePeriodPnl({
      from: FROM,
      to: TO,
      reportingCurrency: "CNY",
      valueAt: valueAtFrom({ [FROM.toISOString()]: 100, [TO.toISOString()]: 200 }),
      perAssetValueAt: perAssetFrom({}),
      transactions: txs,
      fxAt: fxOne,
      sampleDates: [],
    });
    expect(res.realizedPnL.toString()).toBe("40"); // 4 × (20 − 10)
  });
});

describe("computePeriodPnl — cumulative return curve (AC.1.5, §决策 3)", () => {
  it("ratio = (value + dividends − totalInvested) / totalInvested at each sample day", () => {
    const d1 = "2026-02-10T00:00:00.000Z";
    const txs = [
      mkTx({
        type: "BUY",
        assetId: "CN:600519",
        shares: 10,
        pricePerShare: 10,
        tradeDate: "2026-02-05T00:00:00.000Z",
      }),
    ];
    const res = computePeriodPnl({
      from: FROM,
      to: TO,
      reportingCurrency: "CNY",
      valueAt: valueAtFrom({ [d1]: 150 }),
      perAssetValueAt: perAssetFrom({}),
      transactions: txs,
      fxAt: fxOne,
      sampleDates: [D(d1)],
    });
    expect(res.returnCurve).toHaveLength(1);
    expect(res.returnCurve[0]!.ratio.toString()).toBe("0.5"); // (150 − 100) / 100
  });

  it("skips sample days before any cost basis exists", () => {
    const before = "2026-02-02T00:00:00.000Z";
    const after = "2026-02-20T00:00:00.000Z";
    const txs = [
      mkTx({
        type: "BUY",
        assetId: "CN:600519",
        shares: 10,
        pricePerShare: 10,
        tradeDate: "2026-02-10T00:00:00.000Z",
      }),
    ];
    const res = computePeriodPnl({
      from: FROM,
      to: TO,
      reportingCurrency: "CNY",
      valueAt: valueAtFrom({ [before]: 0, [after]: 120 }),
      perAssetValueAt: perAssetFrom({}),
      transactions: txs,
      fxAt: fxOne,
      sampleDates: [D(before), D(after)],
    });
    expect(res.returnCurve).toHaveLength(1);
    expect(res.returnCurve[0]!.date.toISOString()).toBe(after);
    expect(res.returnCurve[0]!.ratio.toString()).toBe("0.2");
  });

  it("includes cash dividends in the curve numerator (持有收益 semantics)", () => {
    const d1 = "2026-03-15T00:00:00.000Z";
    const txs = [
      mkTx({
        type: "BUY",
        assetId: "FUND:506002",
        shares: 100,
        pricePerShare: 1,
        tradeDate: "2026-02-05T00:00:00.000Z",
      }),
      mkTx({
        type: "DIVIDEND",
        assetId: "FUND:506002",
        shares: 100,
        pricePerShare: 0.1,
        tradeDate: "2026-03-01T00:00:00.000Z",
      }),
    ];
    const res = computePeriodPnl({
      from: FROM,
      to: TO,
      reportingCurrency: "CNY",
      valueAt: valueAtFrom({ [d1]: 100 }),
      perAssetValueAt: perAssetFrom({}),
      transactions: txs,
      fxAt: fxOne,
      sampleDates: [D(d1)],
    });
    // invested 100, dividends 10, value 100 → (100 + 10 − 100) / 100 = 0.1
    expect(res.returnCurve[0]!.ratio.toString()).toBe("0.1");
  });
});

describe("computePeriodPnl — MWR (§决策 1, §决策 2)", () => {
  it("one-year window with start/end only → annualized ≈ period ≈ 10%", () => {
    const from = D("2026-01-01T00:00:00.000Z");
    const to = D("2027-01-01T00:00:00.000Z");
    const res = computePeriodPnl({
      from,
      to,
      reportingCurrency: "CNY",
      valueAt: valueAtFrom({ [from.toISOString()]: 1000, [to.toISOString()]: 1100 }),
      perAssetValueAt: perAssetFrom({}),
      transactions: [],
      fxAt: fxOne,
      sampleDates: [],
    });
    expect(res.mwrAnnualized).not.toBeNull();
    expect(res.mwrAnnualized!.minus("0.1").abs().lt("1e-6")).toBe(true);
    expect(res.mwrPeriod!.minus("0.1").abs().lt("1e-3")).toBe(true);
  });

  it("sub-year profitable window → period MWR < annualized MWR", () => {
    const from = D("2026-01-01T00:00:00.000Z");
    const to = D("2026-04-01T00:00:00.000Z"); // ~90 days
    const res = computePeriodPnl({
      from,
      to,
      reportingCurrency: "CNY",
      valueAt: valueAtFrom({ [from.toISOString()]: 1000, [to.toISOString()]: 1300 }),
      perAssetValueAt: perAssetFrom({}),
      transactions: [],
      fxAt: fxOne,
      sampleDates: [],
    });
    expect(res.mwrPeriod!.lt(res.mwrAnnualized!)).toBe(true);
    expect(res.mwrPeriod!.minus("0.3").abs().lt("1e-6")).toBe(true); // 1300/1000 − 1
  });

  it("degenerate window (from == to) → both MWR null, never NaN", () => {
    const res = computePeriodPnl({
      from: FROM,
      to: FROM,
      reportingCurrency: "CNY",
      valueAt: valueAtFrom({ [FROM.toISOString()]: 1000 }),
      perAssetValueAt: perAssetFrom({}),
      transactions: [],
      fxAt: fxOne,
      sampleDates: [],
    });
    expect(res.mwrPeriod).toBeNull();
    expect(res.mwrAnnualized).toBeNull();
  });

  it("non-convergent flows (single nonzero) → MWR null", () => {
    const res = computePeriodPnl({
      from: FROM,
      to: TO,
      reportingCurrency: "CNY",
      valueAt: valueAtFrom({ [FROM.toISOString()]: 0, [TO.toISOString()]: 500 }),
      perAssetValueAt: perAssetFrom({}),
      transactions: [],
      fxAt: fxOne,
      sampleDates: [],
    });
    expect(res.mwrPeriod).toBeNull();
    expect(res.mwrAnnualized).toBeNull();
  });
});

describe("computePeriodPnl — per-asset ranking (AC.1.6, AC.1.7, §决策 6)", () => {
  it("contribution = ΔValue − netInflow + dividends; sorted by abs DESC", () => {
    const txs = [
      // B is opened inside the period (start value 0 → ratio null)
      mkTx({
        type: "BUY",
        assetId: "CN:B",
        shares: 10,
        pricePerShare: 2,
        tradeDate: "2026-03-01T00:00:00.000Z",
      }),
    ];
    const res = computePeriodPnl({
      from: FROM,
      to: TO,
      reportingCurrency: "CNY",
      valueAt: valueAtFrom({}),
      perAssetValueAt: perAssetFrom({
        [FROM.toISOString()]: { "CN:A": 100, "CN:C": 200 },
        [TO.toISOString()]: { "CN:A": 150, "CN:B": 30, "CN:C": 150 },
      }),
      // A & C have no transactions but are held; they must still rank.
      transactions: [
        ...txs,
        mkTx({
          type: "BUY",
          assetId: "CN:A",
          shares: 1,
          pricePerShare: 1,
          tradeDate: "2026-01-01T00:00:00.000Z",
        }),
        mkTx({
          type: "BUY",
          assetId: "CN:C",
          shares: 1,
          pricePerShare: 1,
          tradeDate: "2026-01-01T00:00:00.000Z",
        }),
      ],
      fxAt: fxOne,
      sampleDates: [],
    });
    const byId = Object.fromEntries(res.perAssetContribution.map((c) => [c.assetId, c]));
    expect(byId["CN:A"]!.contribution.toString()).toBe("50"); // 150 − 100
    expect(byId["CN:A"]!.ratio!.toString()).toBe("0.5");
    expect(byId["CN:C"]!.contribution.toString()).toBe("-50"); // 150 − 200
    expect(byId["CN:B"]!.contribution.toString()).toBe("10"); // 30 − 0 − 20
    expect(byId["CN:B"]!.ratio).toBeNull(); // new position
    // abs ordering: A(50) & C(50) before B(10); A before C by id tie-break
    expect(res.perAssetContribution.map((c) => c.assetId)).toEqual(["CN:A", "CN:C", "CN:B"]);
  });

  it("dividends count as received return in contribution (AC.1.7)", () => {
    const txs = [
      mkTx({
        type: "BUY",
        assetId: "FUND:506002",
        shares: 100,
        pricePerShare: 1,
        tradeDate: "2026-01-01T00:00:00.000Z",
      }),
      mkTx({
        type: "DIVIDEND",
        assetId: "FUND:506002",
        shares: 100,
        pricePerShare: 0.5,
        tradeDate: "2026-03-01T00:00:00.000Z",
      }),
    ];
    const res = computePeriodPnl({
      from: FROM,
      to: TO,
      reportingCurrency: "CNY",
      valueAt: valueAtFrom({}),
      perAssetValueAt: perAssetFrom({
        [FROM.toISOString()]: { "FUND:506002": 100 },
        [TO.toISOString()]: { "FUND:506002": 100 },
      }),
      transactions: txs,
      fxAt: fxOne,
      sampleDates: [],
    });
    // ΔValue 0, netInflow 0, dividends 50 → contribution 50
    expect(res.perAssetContribution[0]!.contribution.toString()).toBe("50");
  });
});

describe("computePeriodPnl — determinism", () => {
  it("transaction input order does not change the result", () => {
    const txs = [
      mkTx({
        type: "BUY",
        assetId: "CN:600519",
        shares: 10,
        pricePerShare: 10,
        tradeDate: "2026-02-05T00:00:00.000Z",
      }),
      mkTx({
        type: "SELL",
        assetId: "CN:600519",
        shares: 3,
        pricePerShare: 15,
        tradeDate: "2026-03-10T00:00:00.000Z",
      }),
      mkTx({
        type: "BUY",
        assetId: "CN:600519",
        shares: 5,
        pricePerShare: 12,
        tradeDate: "2026-03-20T00:00:00.000Z",
      }),
    ];
    const input = (transactions: Transaction[]): PeriodPnlInput => ({
      from: FROM,
      to: TO,
      reportingCurrency: "CNY",
      valueAt: valueAtFrom({ [FROM.toISOString()]: 50, [TO.toISOString()]: 220 }),
      perAssetValueAt: perAssetFrom({
        [FROM.toISOString()]: { "CN:600519": 50 },
        [TO.toISOString()]: { "CN:600519": 220 },
      }),
      transactions,
      fxAt: fxOne,
      sampleDates: [D("2026-03-15T00:00:00.000Z")],
    });
    const a = computePeriodPnl(input([...txs]));
    const b = computePeriodPnl(input([...txs].reverse()));
    expect(a.valueChange.toString()).toBe(b.valueChange.toString());
    expect(a.realizedPnL.toString()).toBe(b.realizedPnL.toString());
    expect(a.netInflow.toString()).toBe(b.netInflow.toString());
    expect(a.returnCurve.map((p) => p.ratio.toString())).toEqual(
      b.returnCurve.map((p) => p.ratio.toString())
    );
  });
});
