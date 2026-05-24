/**
 * TWR + MWR property tests (Stage 3 Block D — TWR spec commit #4).
 *
 * 20 properties (per spec §"Property tests" table — 6 + 4 + 4 + 3 + 2 + 1):
 *
 *   §1 TWR invariants            (6) — empty/zero windows, sub-period count,
 *                                       CF not in numerator, geometric compound
 *   §2 Cash-flow detection       (4) — predicate exhaustive over asset & type
 *   §3 Decimal boundaries        (4) — start=0 skip, tiny/large values, negative TWR
 *   §4 XIRR numeric              (3) — closed-form, convergence, scale invariance
 *   §5 Cross-currency / FX       (2) — currency filter, "missing FX day"
 *   §6 Performance               (1) — 500 tx under 2000ms (M1 manual < 500ms per spec)
 *
 * Maps to S3-AC-D.1.1–D.1.10 (excluding D.1.9 which is manual 雪球 verification).
 */

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import Decimal from "decimal.js";

import {
  ConvergenceError,
  computeAssetTwr,
  computeMwr,
  computePortfolioTwr,
  detectCashFlowEvents,
  isCashFlowTransaction,
} from "../src/returns";
import type { Currency, Transaction, TransactionType } from "../src/domain/types";

// ────────────────────────────────────────────────────────────────────────────
// Shared builders / helpers

const dec = (n: number | string): Decimal => new Decimal(n);
const iso = (date: Date): string => date.toISOString();
const ONE_DAY_MS = 86_400_000;
const BASE = new Date("2024-01-01T00:00:00.000Z");
const dayOffset = (days: number): Date => new Date(BASE.getTime() + days * ONE_DAY_MS);

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

const NUM_RUNS = 200;

// ────────────────────────────────────────────────────────────────────────────
// §1 TWR basic invariants (6 properties)

describe("§1 TWR invariants", () => {
  it("P1: empty transactions ⇒ subPeriods=1, value=(end-start)/start", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 1e9, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 1, max: 1e9, noNaN: true, noDefaultInfinity: true }),
        (startValue, endValue) => {
          const from = dayOffset(0);
          const to = dayOffset(365);
          const result = computePortfolioTwr({
            portfolioId: "p1",
            reportingCurrency: "USD",
            from,
            to,
            transactions: [],
            valueAt: (d) => (d.getTime() === from.getTime() ? dec(startValue) : dec(endValue)),
          });
          expect(result.subPeriods).toBe(1);
          const expected = dec(endValue).minus(startValue).div(startValue);
          expect(result.value.minus(expected).abs().lt("1e-9")).toBe(true);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  it("P2: from == to ⇒ subPeriods=0, value=0", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3650 }),
        fc.double({ min: 1, max: 1e9, noNaN: true, noDefaultInfinity: true }),
        (dayIdx, val) => {
          const date = dayOffset(dayIdx);
          const result = computePortfolioTwr({
            portfolioId: "p1",
            reportingCurrency: "USD",
            from: date,
            to: date,
            transactions: [],
            valueAt: () => dec(val),
          });
          expect(result.subPeriods).toBe(0);
          expect(result.value.toString()).toBe("0");
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  it("P3: constant valueAt + no CF ⇒ TWR=0", () => {
    fc.assert(
      fc.property(fc.double({ min: 1, max: 1e9, noNaN: true, noDefaultInfinity: true }), (val) => {
        const result = computePortfolioTwr({
          portfolioId: "p1",
          reportingCurrency: "USD",
          from: dayOffset(0),
          to: dayOffset(365),
          transactions: [],
          valueAt: () => dec(val),
        });
        expect(result.value.abs().lt("1e-12")).toBe(true);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it("P4: subPeriods = (unique CF dates inside window) + 1", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 10, max: 350 }), { minLength: 0, maxLength: 8 }),
        (cfDayOffsets) => {
          const from = dayOffset(0);
          const to = dayOffset(365);
          const txs = cfDayOffsets.map((d) =>
            mkTx({
              type: "BUY",
              assetId: "CASH:USD",
              shares: 100,
              pricePerShare: 1,
              currency: "USD",
              tradeDate: iso(dayOffset(d)),
            })
          );
          const result = computePortfolioTwr({
            portfolioId: "p1",
            reportingCurrency: "USD",
            from,
            to,
            transactions: txs,
            // valueAt large enough that endValue - CF stays > 0 (no degenerate skip)
            valueAt: () => dec(1_000_000),
          });
          expect(result.subPeriods).toBe(cfDayOffsets.length + 1);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  it("P5: CF in numerator invariance ⇒ TWR depends only on sub-period returns, not on CF magnitude", () => {
    fc.assert(
      fc.property(
        fc.record({
          startValue: fc.integer({ min: 10_000, max: 1_000_000 }),
          sub1Return: fc.double({
            min: -0.4,
            max: 0.4,
            noNaN: true,
            noDefaultInfinity: true,
          }),
          sub2Return: fc.double({
            min: -0.4,
            max: 0.4,
            noNaN: true,
            noDefaultInfinity: true,
          }),
          cfAmount: fc.integer({ min: 1, max: 1_000_000_000 }),
        }),
        ({ startValue, sub1Return, sub2Return, cfAmount }) => {
          const from = dayOffset(0);
          const mid = dayOffset(180);
          const to = dayOffset(365);
          const sv = dec(startValue);
          const r1 = dec(sub1Return);
          const r2 = dec(sub2Return);
          const cf = dec(cfAmount);

          const preMid = sv.times(dec(1).plus(r1));
          const postMid = preMid.plus(cf);
          const endValue = postMid.times(dec(1).plus(r2));

          const result = computePortfolioTwr({
            portfolioId: "p1",
            reportingCurrency: "USD",
            from,
            to,
            transactions: [
              mkTx({
                type: "BUY",
                assetId: "CASH:USD",
                shares: cfAmount,
                pricePerShare: 1,
                currency: "USD",
                tradeDate: iso(mid),
              }),
            ],
            valueAt: (d) => {
              const t = d.getTime();
              if (t === from.getTime()) return sv;
              if (t === mid.getTime()) return postMid;
              if (t === to.getTime()) return endValue;
              throw new Error(`unmapped ${d.toISOString()}`);
            },
          });

          const expected = dec(1).plus(r1).times(dec(1).plus(r2)).minus(1);
          expect(result.value.minus(expected).abs().lt("1e-9")).toBe(true);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  it("P6: geometric compound — 2 sub-periods both return r ⇒ TWR = (1+r)^2 - 1", () => {
    fc.assert(
      fc.property(
        fc.record({
          r: fc.double({ min: -0.3, max: 0.3, noNaN: true, noDefaultInfinity: true }),
          startValue: fc.integer({ min: 10_000, max: 1_000_000 }),
        }),
        ({ r, startValue }) => {
          const from = dayOffset(0);
          const mid = dayOffset(180);
          const to = dayOffset(365);
          const sv = dec(startValue);
          const rDec = dec(r);
          // CF of amount 0 (boundary insertion without affecting values)
          const txs = [
            mkTx({
              type: "BUY",
              assetId: "CASH:USD",
              shares: 0,
              pricePerShare: 1,
              currency: "USD",
              tradeDate: iso(mid),
            }),
          ];
          const result = computePortfolioTwr({
            portfolioId: "p1",
            reportingCurrency: "USD",
            from,
            to,
            transactions: txs,
            valueAt: (d) => {
              const t = d.getTime();
              if (t === from.getTime()) return sv;
              if (t === mid.getTime()) return sv.times(dec(1).plus(rDec));
              if (t === to.getTime()) return sv.times(dec(1).plus(rDec).pow(2));
              throw new Error("unmapped");
            },
          });
          expect(result.subPeriods).toBe(2);
          const expected = dec(1).plus(rDec).pow(2).minus(1);
          expect(result.value.minus(expected).abs().lt("1e-9")).toBe(true);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// §2 Cash-flow detection (4 properties)

describe("§2 Cash-flow detection", () => {
  const arbAssetId = fc.constantFrom(
    "US:AAPL",
    "CN:600519",
    "HK:00700",
    "CRYPTO:bitcoin",
    "FUND:000001"
  );
  const arbBuySell = fc.constantFrom<TransactionType>("BUY", "SELL");

  it("CF1: BUY/SELL of any non-CASH asset is never a cash flow", () => {
    fc.assert(
      fc.property(arbAssetId, arbBuySell, (assetId, type) => {
        const tx = mkTx({
          type,
          assetId,
          shares: 1,
          pricePerShare: 1,
          tradeDate: iso(dayOffset(100)),
        });
        expect(isCashFlowTransaction(tx)).toBe(false);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it("CF2: BUY/SELL CASH:* always produces a cash flow with correct sign", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Currency>("USD", "CNY", "HKD", "JPY"),
        arbBuySell,
        fc.double({ min: 1, max: 1_000_000, noNaN: true, noDefaultInfinity: true }),
        (currency, type, shares) => {
          const tx = mkTx({
            type,
            assetId: `CASH:${currency}`,
            shares,
            pricePerShare: 1,
            currency,
            tradeDate: iso(dayOffset(100)),
          });
          expect(isCashFlowTransaction(tx)).toBe(true);
          const events = detectCashFlowEvents([tx], dayOffset(0), dayOffset(365));
          expect(events).toHaveLength(1);
          if (type === "BUY") {
            expect(events[0].amount.isPositive()).toBe(true);
          } else {
            expect(events[0].amount.isNegative()).toBe(true);
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  it("CF3: DIVIDEND / SPLIT / ADJUSTMENT on any asset is never a cash flow", () => {
    const nonBuySell = fc.constantFrom<TransactionType>("DIVIDEND", "SPLIT", "ADJUSTMENT");
    const anyAsset = fc.constantFrom(
      "US:AAPL",
      "CN:600519",
      "CASH:USD",
      "CRYPTO:bitcoin",
      "FUND:000001"
    );
    fc.assert(
      fc.property(anyAsset, nonBuySell, (assetId, type) => {
        const tx = mkTx({
          type,
          assetId,
          shares: 0,
          pricePerShare: 1,
          tradeDate: iso(dayOffset(100)),
        });
        expect(isCashFlowTransaction(tx)).toBe(false);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it("CF4: transfer-notes tag does NOT exclude CASH:* from cash flow (per-portfolio view)", () => {
    fc.assert(
      fc.property(
        arbBuySell,
        fc.double({ min: 1, max: 100_000, noNaN: true, noDefaultInfinity: true }),
        (type, shares) => {
          const notes =
            type === "SELL" ? "transfer-out-to-portfolio-B" : "transfer-in-from-portfolio-A";
          const tx = mkTx({
            type,
            assetId: "CASH:USD",
            shares,
            pricePerShare: 1,
            tradeDate: iso(dayOffset(100)),
            notes,
          });
          expect(isCashFlowTransaction(tx)).toBe(true);
          const events = detectCashFlowEvents([tx], dayOffset(0), dayOffset(365));
          expect(events).toHaveLength(1);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// §3 Decimal boundaries (4 properties)

describe("§3 Decimal boundaries", () => {
  it("D1: first boundary startValue=0 ⇒ skip degenerate, rest of chain still computes", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 100, max: 1_000_000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 100, max: 1_000_000, noNaN: true, noDefaultInfinity: true }),
        (midVal, endVal) => {
          const from = dayOffset(0);
          const mid = dayOffset(100);
          const to = dayOffset(365);
          const result = computePortfolioTwr({
            portfolioId: "p1",
            reportingCurrency: "USD",
            from,
            to,
            transactions: [
              mkTx({
                type: "BUY",
                assetId: "CASH:USD",
                shares: 100,
                pricePerShare: 1,
                currency: "USD",
                tradeDate: iso(mid),
              }),
            ],
            valueAt: (d) => {
              const t = d.getTime();
              if (t === from.getTime()) return dec(0); // degenerate first boundary
              if (t === mid.getTime()) return dec(midVal);
              if (t === to.getTime()) return dec(endVal);
              throw new Error("unmapped");
            },
          });
          // first sub-period skipped; second sub-period computed
          expect(result.subPeriods).toBe(1);
          // R = (endVal - midVal) / midVal — last boundary doesn't strip CF
          const expected = dec(endVal).minus(midVal).div(midVal);
          expect(result.value.minus(expected).abs().lt("1e-9")).toBe(true);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  it("D2: tiny values (1e-25 .. 1e-20) ⇒ no NaN / Infinity overflow", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1e-25, max: 1e-20, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0.5, max: 2, noNaN: true, noDefaultInfinity: true }),
        (startTiny, mult) => {
          const sv = dec(startTiny);
          const ev = sv.times(mult);
          const from = dayOffset(0);
          const to = dayOffset(365);
          const result = computePortfolioTwr({
            portfolioId: "p1",
            reportingCurrency: "USD",
            from,
            to,
            transactions: [],
            valueAt: (d) => (d.getTime() === from.getTime() ? sv : ev),
          });
          expect(result.value.isFinite()).toBe(true);
          expect(result.value.isNaN()).toBe(false);
          const expected = ev.minus(sv).div(sv);
          expect(result.value.minus(expected).abs().lt("1e-9")).toBe(true);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  it("D3: large values (1e12 .. 1e15) ⇒ no overflow", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1e12, max: 1e15, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0.5, max: 2, noNaN: true, noDefaultInfinity: true }),
        (startBig, mult) => {
          const sv = dec(startBig);
          const ev = sv.times(mult);
          const from = dayOffset(0);
          const to = dayOffset(365);
          const result = computePortfolioTwr({
            portfolioId: "p1",
            reportingCurrency: "USD",
            from,
            to,
            transactions: [],
            valueAt: (d) => (d.getTime() === from.getTime() ? sv : ev),
          });
          expect(result.value.isFinite()).toBe(true);
          const expected = ev.minus(sv).div(sv);
          expect(result.value.minus(expected).abs().lt("1e-9")).toBe(true);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  it("D4: monotonically decreasing valueAt + no CF ⇒ TWR < 0, bounded in [-1, 0)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1000, max: 1_000_000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0.05, max: 0.95, noNaN: true, noDefaultInfinity: true }),
        (startVal, mult) => {
          const sv = dec(startVal);
          const ev = sv.times(mult);
          const from = dayOffset(0);
          const to = dayOffset(365);
          const result = computePortfolioTwr({
            portfolioId: "p1",
            reportingCurrency: "USD",
            from,
            to,
            transactions: [],
            valueAt: (d) => (d.getTime() === from.getTime() ? sv : ev),
          });
          expect(result.value.isNegative()).toBe(true);
          expect(result.value.gte(-1)).toBe(true);
          expect(result.value.lt(0)).toBe(true);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// §4 XIRR numeric (3 properties)

describe("§4 XIRR numeric", () => {
  it("X1: closed-form two-flow [-1, +(1+r) @ 1y] ⇒ IRR ≈ r ± 1e-6", () => {
    fc.assert(
      fc.property(fc.double({ min: -0.5, max: 0.5, noNaN: true, noDefaultInfinity: true }), (r) => {
        fc.pre(Math.abs(r) > 0.001);
        const result = computeMwr([
          { date: dayOffset(0), amount: dec(-1) },
          { date: dayOffset(365), amount: dec(1).plus(dec(r)) },
        ]);
        expect(result.converged).toBe(true);
        expect(result.iterations).toBeLessThan(100);
        expect(result.value.minus(dec(r)).abs().lt("1e-6")).toBe(true);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it(
    "X2: mixed-sign multi-flow either converges in ≤ 100 iter or throws ConvergenceError (no NaN)",
    { timeout: 30_000 },
    () => {
      // Build mixed-sign flows deterministically — rejection-sampling via
      // fc.pre is too aggressive because fc.double biases toward 0.
      // numRuns reduced: each computeMwr can take many NR iterations × Decimal.pow
      // with fractional exponents (expensive); 50 runs is still ample for shape
      // coverage given the deterministic mixed-sign construction.
      fc.assert(
        fc.property(
          fc.record({
            negatives: fc.array(
              fc.record({
                dayIdx: fc.integer({ min: 30, max: 1800 }),
                magnitude: fc.double({
                  min: 100,
                  max: 10_000,
                  noNaN: true,
                  noDefaultInfinity: true,
                }),
              }),
              { minLength: 1, maxLength: 3 }
            ),
            positives: fc.array(
              fc.record({
                dayIdx: fc.integer({ min: 30, max: 1800 }),
                magnitude: fc.double({
                  min: 100,
                  max: 10_000,
                  noNaN: true,
                  noDefaultInfinity: true,
                }),
              }),
              { minLength: 1, maxLength: 3 }
            ),
          }),
          ({ negatives, positives }) => {
            const cfs = [
              ...negatives.map((f) => ({
                date: dayOffset(f.dayIdx),
                amount: dec(f.magnitude).negated(),
              })),
              ...positives.map((f) => ({
                date: dayOffset(f.dayIdx),
                amount: dec(f.magnitude),
              })),
            ];
            try {
              const result = computeMwr(cfs);
              expect(result.converged).toBe(true);
              expect(result.iterations).toBeLessThanOrEqual(100);
              expect(result.value.isFinite()).toBe(true);
            } catch (err) {
              expect(err).toBeInstanceOf(ConvergenceError);
            }
          }
        ),
        { numRuns: 50 }
      );
    }
  );

  it("X3: scale invariance — multiplying every CF amount by k ≠ 0 preserves IRR", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -0.4, max: 0.4, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0.01, max: 1000, noNaN: true, noDefaultInfinity: true }),
        (r, scale) => {
          fc.pre(Math.abs(r) > 0.001);
          const base = [
            { date: dayOffset(0), amount: dec(-1) },
            { date: dayOffset(365), amount: dec(1).plus(dec(r)) },
          ];
          const scaled = base.map((cf) => ({ ...cf, amount: cf.amount.times(scale) }));
          const r1 = computeMwr(base);
          const r2 = computeMwr(scaled);
          expect(r1.value.minus(r2.value).abs().lt("1e-6")).toBe(true);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// §5 Cross-currency / FX (2 properties)

describe("§5 Cross-currency / FX", () => {
  it("FX1: BUY CASH:USD in CNY-reporting portfolio is filtered out (not a CF)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10_000, max: 10_000_000 }),
        fc.integer({ min: 10_000, max: 10_000_000 }),
        fc.integer({ min: 1, max: 1_000_000 }),
        (sv, ev, cfShares) => {
          const from = dayOffset(0);
          const mid = dayOffset(100);
          const to = dayOffset(365);
          const result = computePortfolioTwr({
            portfolioId: "p1",
            reportingCurrency: "CNY",
            from,
            to,
            transactions: [
              mkTx({
                type: "BUY",
                assetId: "CASH:USD",
                shares: cfShares,
                pricePerShare: 1,
                currency: "USD",
                tradeDate: iso(mid),
              }),
            ],
            valueAt: (d) => (d.getTime() === from.getTime() ? dec(sv) : dec(ev)),
          });
          // CASH:USD currency != CNY reportingCurrency ⇒ filtered out
          expect(result.subPeriods).toBe(1);
          expect(result.netCashFlow.toString()).toBe("0");
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  it("FX2: simulated 'missing FX day' (valueAt=0 at a boundary) ⇒ degenerate sub-period skipped, no throw", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1000, max: 1_000_000 }), (val) => {
        const from = dayOffset(0);
        const mid = dayOffset(100);
        const to = dayOffset(365);
        const result = computePortfolioTwr({
          portfolioId: "p1",
          reportingCurrency: "USD",
          from,
          to,
          transactions: [
            mkTx({
              type: "BUY",
              assetId: "CASH:USD",
              shares: 100,
              pricePerShare: 1,
              currency: "USD",
              tradeDate: iso(mid),
            }),
          ],
          valueAt: (d) => {
            if (d.getTime() === mid.getTime()) return dec(0); // missing FX
            return dec(val);
          },
        });
        // mid is post-CF=0 → sub-period 2 has startValue=0 → skipped.
        // sub-period 1 has startValue=val, endStripped=0-100=-100; finite return.
        expect(result.subPeriods).toBe(1);
        expect(result.value.isFinite()).toBe(true);
        expect(result.value.isNaN()).toBe(false);
      }),
      { numRuns: NUM_RUNS }
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// §6 Performance (1 property)

describe("§6 Performance", () => {
  it("PERF1: 500 transactions over 5 years ⇒ computePortfolioTwr completes under 2000ms (spec target: 500ms on M1 manual)", () => {
    // Relaxed from spec's 500ms because shared CI / locally-loaded machines
    // can drift; the spec contract (S3-AC-D.1.10) is verified manually on M1.
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4 }), (seed) => {
        const txs: Transaction[] = [];
        const types: TransactionType[] = ["BUY", "SELL", "BUY", "DIVIDEND", "BUY"];
        const assetIds = ["US:AAPL", "CN:600519", "CASH:USD", "CRYPTO:bitcoin", "FUND:000001"];
        for (let i = 0; i < 500; i++) {
          const dayIdx = (i * 3 + seed) % 1800; // 5 years
          txs.push(
            mkTx({
              type: types[i % types.length]!,
              assetId: assetIds[i % assetIds.length]!,
              shares: (i % 50) + 1,
              pricePerShare: 100 + (i % 50),
              currency: "USD",
              tradeDate: iso(dayOffset(dayIdx)),
            })
          );
        }
        const from = dayOffset(0);
        const to = dayOffset(1825);
        const t0 = Date.now();
        const result = computePortfolioTwr({
          portfolioId: "p1",
          reportingCurrency: "USD",
          from,
          to,
          transactions: txs,
          valueAt: (d) => dec(100_000).plus((d.getTime() - from.getTime()) / 1e9),
        });
        const elapsed = Date.now() - t0;
        expect(elapsed).toBeLessThan(2000);
        expect(result.value.isFinite()).toBe(true);
      }),
      { numRuns: 5 }
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Sanity: computeAssetTwr also benefits from the no-throw invariants
// (kept light — full asset-level property coverage is folded into commits
// downstream when PA spec adds AssetContribution-level invariants).

describe("computeAssetTwr light sanity (covered by P1 + portfolio tests above)", () => {
  it("asset path: empty transactions on asset ⇒ shares=0 at all dates ⇒ subPeriods=1 with startValue=0 skip ⇒ value=0", () => {
    // No BUYs for the asset → computeSharesAt returns 0 → valueAt returns 0
    // → first (and only) sub-period skipped → subReturns empty → TWR=0
    const result = computeAssetTwr({
      assetId: "US:AAPL",
      portfolioId: "p1",
      from: dayOffset(0),
      to: dayOffset(365),
      transactions: [],
      priceAt: () => dec(150),
    });
    expect(result.subPeriods).toBe(0);
    expect(result.value.toString()).toBe("0");
  });
});
