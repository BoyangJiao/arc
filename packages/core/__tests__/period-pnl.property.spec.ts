/**
 * Period P&L property tests (Insights 盈亏分析 — pnl-analysis-insights spec
 * §"Property tests" table, ~6 properties):
 *
 *   闭环 (2) — cumInvested closes with computeHoldings totalCostBasis sum;
 *              XIRR flows reconstruct NPV ≈ 0 at the returned rate
 *   退化 (2) — same-sign / single-day cash flows → MWR null (no NaN escape)
 *   单调 (1) — monotone-increasing valueAt with no inflow → curve monotone up
 *   决定 (1) — shuffled transactions + sample dates → identical result
 */

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import Decimal from "decimal.js";

import { computePeriodPnl, type PeriodPnlInput } from "../src/returns/period-pnl";
import { computeHoldings } from "../src/domain/holdings";
import type { Transaction } from "../src/domain/types";

const dec = (n: number | string): Decimal => new Decimal(n);
const ONE_DAY = 86_400_000;
const BASE = new Date("2026-01-01T00:00:00.000Z").getTime();
const day = (n: number): Date => new Date(BASE + n * ONE_DAY);

let seq = 0;
const buy = (
  assetId: string,
  shares: number,
  price: number,
  dayN: number,
  fee = 0
): Transaction => ({
  id: `tx-${++seq}`,
  portfolioId: "p1",
  assetId,
  type: "BUY",
  shares: dec(shares),
  pricePerShare: dec(price),
  currency: "CNY",
  fee: dec(fee),
  tradeDate: day(dayN).toISOString(),
});

const fxOne: PeriodPnlInput["fxAt"] = () => dec(1);
const zeroPerAsset: PeriodPnlInput["perAssetValueAt"] = () => dec(0);

// ─── 闭环 #1 — cost-basis closes with computeHoldings ────────────────────

describe("property: cost basis closes with computeHoldings (AC.1.1)", () => {
  it("final cumInvested == Σ computeHoldings totalCostBasis (fx = 1)", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            shares: fc.integer({ min: 1, max: 1000 }),
            price: fc.integer({ min: 1, max: 500 }),
            fee: fc.integer({ min: 0, max: 50 }),
            dayN: fc.integer({ min: 0, max: 200 }),
          }),
          { minLength: 1, maxLength: 12 }
        ),
        (rows) => {
          const txs = rows.map((r, i) => buy(`CN:A${i % 3}`, r.shares, r.price, r.dayN, r.fee));
          // The curve's last checkpoint cumInvested equals the holdings cost basis.
          const lastDay = day(250);
          const res = computePeriodPnl({
            from: day(0),
            to: lastDay,
            reportingCurrency: "CNY",
            // value == invested at the last day → ratio 0; we only read curve cumInvested via ratio math.
            valueAt: (d) =>
              d.getTime() === lastDay.getTime()
                ? computeHoldings(txs).reduce((s, h) => s.plus(h.totalCostBasis), dec(0))
                : dec(0),
            perAssetValueAt: zeroPerAsset,
            transactions: txs,
            fxAt: fxOne,
            sampleDates: [lastDay],
          });
          const holdingsCost = computeHoldings(txs).reduce(
            (s, h) => s.plus(h.totalCostBasis),
            dec(0)
          );
          // ratio at lastDay = (value + 0 − invested)/invested, value == invested → 0
          expect(res.returnCurve).toHaveLength(1);
          expect(res.returnCurve[0]!.ratio.abs().lt("1e-20")).toBe(true);
          // sanity: holdings cost basis is positive for all-BUY input
          expect(holdingsCost.gt(0)).toBe(true);
        }
      ),
      { numRuns: 60 }
    );
  });
});

// ─── 闭环 #2 — XIRR flows reconstruct NPV ≈ 0 ────────────────────────────

describe("property: returned MWR reproduces NPV ≈ 0", () => {
  it("annualized rate r makes Σ flow×(1+r)^(−t/365) ≈ 0 for a sign-changing series", () => {
    fc.assert(
      fc.property(
        fc.record({
          start: fc.integer({ min: 100, max: 100_000 }),
          gainPct: fc.integer({ min: -80, max: 300 }),
          spanDays: fc.integer({ min: 30, max: 720 }),
        }),
        ({ start, gainPct, spanDays }) => {
          const from = day(0);
          const to = day(spanDays);
          const end = new Decimal(start).times(new Decimal(100 + gainPct).div(100));
          const res = computePeriodPnl({
            from,
            to,
            reportingCurrency: "CNY",
            valueAt: (d) => (d.getTime() === from.getTime() ? dec(start) : end),
            perAssetValueAt: zeroPerAsset,
            transactions: [],
            fxAt: fxOne,
            sampleDates: [],
          });
          // Invariant: WHEN a rate is returned, it reproduces NPV ≈ 0. (A near
          // −100% annualized return — large loss over a short span — may legitimately
          // fail to converge and return null; that's not a violation.)
          if (res.mwrAnnualized === null) return;
          const r = res.mwrAnnualized;
          const t = spanDays / 365;
          // NPV = −start + end×(1+r)^(−t)
          const npv = new Decimal(-start).plus(end.times(new Decimal(1).plus(r).pow(-t)));
          expect(npv.abs().lt("1e-3")).toBe(true);
        }
      ),
      { numRuns: 60 }
    );
  });
});

// ─── 退化 — same-sign / single-day → null ────────────────────────────────

describe("property: degenerate cash flows yield null MWR (never NaN)", () => {
  it("from == to → both MWR null", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 300 }),
        fc.integer({ min: 1, max: 100_000 }),
        (dN, v) => {
          const at = day(dN);
          const res = computePeriodPnl({
            from: at,
            to: at,
            reportingCurrency: "CNY",
            valueAt: () => dec(v),
            perAssetValueAt: zeroPerAsset,
            transactions: [],
            fxAt: fxOne,
            sampleDates: [],
          });
          expect(res.mwrPeriod).toBeNull();
          expect(res.mwrAnnualized).toBeNull();
        }
      ),
      { numRuns: 40 }
    );
  });

  it("startValue 0 + single terminal inflow (all same sign) → MWR null", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100_000 }),
        fc.integer({ min: 10, max: 400 }),
        (end, span) => {
          const res = computePeriodPnl({
            from: day(0),
            to: day(span),
            reportingCurrency: "CNY",
            valueAt: (d) => (d.getTime() === day(0).getTime() ? dec(0) : dec(end)),
            perAssetValueAt: zeroPerAsset,
            transactions: [],
            fxAt: fxOne,
            sampleDates: [],
          });
          expect(res.mwrPeriod).toBeNull();
          expect(res.mwrAnnualized).toBeNull();
        }
      ),
      { numRuns: 40 }
    );
  });
});

// ─── 单调 — monotone value, fixed invested → monotone curve ───────────────

describe("property: monotone-increasing value with no inflow → monotone curve", () => {
  it("curve ratios are non-decreasing when valueAt is non-decreasing and invested fixed", () => {
    fc.assert(
      fc.property(
        fc.record({
          shares: fc.integer({ min: 1, max: 1000 }),
          price: fc.integer({ min: 1, max: 200 }),
          increments: fc.array(fc.integer({ min: 0, max: 500 }), { minLength: 2, maxLength: 8 }),
        }),
        ({ shares, price, increments }) => {
          // single BUY before the window → cost basis fixed across all sample days
          const tx = buy("CN:A", shares, price, 0);
          const invested = new Decimal(shares).times(price);
          // build non-decreasing values starting above 0 at increasing sample days
          let acc = invested; // start at break-even
          const points = increments.map((inc, i) => {
            acc = acc.plus(inc);
            return { d: day(10 + i), v: acc };
          });
          const valueMap = new Map(points.map((p) => [p.d.getTime(), p.v]));
          const res = computePeriodPnl({
            from: day(5),
            to: day(10 + points.length),
            reportingCurrency: "CNY",
            valueAt: (d) => valueMap.get(d.getTime()) ?? dec(0),
            perAssetValueAt: zeroPerAsset,
            transactions: [tx],
            fxAt: fxOne,
            sampleDates: points.map((p) => p.d),
          });
          for (let i = 1; i < res.returnCurve.length; i++) {
            expect(res.returnCurve[i]!.ratio.gte(res.returnCurve[i - 1]!.ratio)).toBe(true);
          }
        }
      ),
      { numRuns: 60 }
    );
  });
});

// ─── 决定 — shuffle invariance ───────────────────────────────────────────

describe("property: result is invariant to input ordering", () => {
  it("shuffled transactions + sample dates → identical curve & aggregates", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            shares: fc.integer({ min: 1, max: 500 }),
            price: fc.integer({ min: 1, max: 300 }),
            dayN: fc.integer({ min: 0, max: 100 }),
          }),
          { minLength: 1, maxLength: 8 }
        ),
        fc.array(fc.integer({ min: 0, max: 120 }), { minLength: 1, maxLength: 6 }),
        (rows, sampleDayNs) => {
          const txs = rows.map((r, i) => buy(`CN:A${i % 2}`, r.shares, r.price, r.dayN));
          const sampleDates = sampleDayNs.map((n) => day(n));
          const mk = (t: Transaction[], s: Date[]): PeriodPnlInput => ({
            from: day(0),
            to: day(150),
            reportingCurrency: "CNY",
            // Bounded deterministic value (day index 0..150) — keeps the XIRR
            // boundary flows small so this O(runs × 2 computePeriodPnl) test
            // stays well under the timeout.
            valueAt: (d) => dec((d.getTime() - BASE) / ONE_DAY),
            perAssetValueAt: zeroPerAsset,
            transactions: t,
            fxAt: fxOne,
            sampleDates: s,
          });
          const a = computePeriodPnl(mk([...txs], [...sampleDates]));
          const b = computePeriodPnl(mk([...txs].reverse(), [...sampleDates].reverse()));
          expect(a.netInflow.toString()).toBe(b.netInflow.toString());
          expect(a.valueChange.toString()).toBe(b.valueChange.toString());
          expect(a.returnCurve.map((p) => `${p.date.getTime()}:${p.ratio.toString()}`)).toEqual(
            b.returnCurve.map((p) => `${p.date.getTime()}:${p.ratio.toString()}`)
          );
        }
      ),
      { numRuns: 25 }
    );
  }, 20_000);
});
