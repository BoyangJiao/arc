/**
 * Cross-portfolio cash transfer property tests (Stage 3 Block B).
 */

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import Decimal from "decimal.js";

import type { Currency } from "../src/domain/types";
import {
  buildTransferTransactions,
  validateTransfer,
  type TransferError,
  type TransferIntent,
} from "../src/portfolio/transfer";

const dec = (n: number | string): Decimal => new Decimal(n);

const CURRENCIES: Currency[] = ["CNY", "USD", "HKD", "JPY"];

const uuidArb = fc.uuid();

const cashAssetArb = fc.constantFrom(...CURRENCIES).map((c) => `CASH:${c}` as const);

const positiveAmountArb = fc
  .double({ min: 0.01, max: 1_000_000, noNaN: true, noDefaultInfinity: true })
  .map((n) => dec(n));

const balanceArb = fc
  .double({ min: 0, max: 1_000_000, noNaN: true, noDefaultInfinity: true })
  .map((n) => dec(n));

const hasCode = (errors: ReadonlyArray<TransferError>, code: TransferError["code"]): boolean =>
  errors.some((e) => e.code === code);

const intentArb = fc.record({
  sourcePortfolioId: uuidArb,
  destPortfolioId: uuidArb,
  assetId: cashAssetArb,
  amount: positiveAmountArb,
}) as fc.Arbitrary<TransferIntent>;

describe("validateTransfer — property tests", () => {
  it("property: empty errors iff amount > 0 ∧ amount ≤ balance ∧ source ≠ dest ∧ CASH:*", () => {
    fc.assert(
      fc.property(intentArb, balanceArb, (intent, balance) => {
        const errors = validateTransfer(intent, balance);
        const valid =
          intent.sourcePortfolioId !== intent.destPortfolioId &&
          intent.amount.gt(0) &&
          intent.amount.lte(balance) &&
          intent.assetId.startsWith("CASH:");
        expect(errors.length === 0).toBe(valid);
      }),
      { numRuns: 300 }
    );
  });

  it('property: amount <= 0 → contains "amount_not_positive"', () => {
    fc.assert(
      fc.property(
        intentArb,
        balanceArb,
        fc.oneof(fc.constant(dec(0)), fc.double({ max: -0.01, noNaN: true }).map(dec)),
        (intent, balance, badAmount) => {
          const errors = validateTransfer({ ...intent, amount: badAmount }, balance);
          expect(hasCode(errors, "amount_not_positive")).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('property: amount > balance → contains "amount_exceeds_balance"', () => {
    fc.assert(
      fc.property(intentArb, positiveAmountArb, (intent, balance) => {
        const amount = balance.plus("0.01");
        const errors = validateTransfer({ ...intent, amount }, balance);
        expect(hasCode(errors, "amount_exceeds_balance")).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it('property: source = dest → contains "same_portfolio"', () => {
    fc.assert(
      fc.property(intentArb, balanceArb, uuidArb, (intent, balance, id) => {
        const errors = validateTransfer(
          { ...intent, sourcePortfolioId: id, destPortfolioId: id },
          balance
        );
        expect(hasCode(errors, "same_portfolio")).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it('property: assetId not CASH:* → contains "non_cash_asset"', () => {
    fc.assert(
      fc.property(
        intentArb,
        balanceArb,
        fc.constantFrom("US:AAPL", "CN:600519", "FUND:foo"),
        (intent, balance, assetId) => {
          const errors = validateTransfer(
            { ...intent, assetId: assetId as TransferIntent["assetId"] },
            balance
          );
          expect(hasCode(errors, "non_cash_asset")).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe("buildTransferTransactions — property tests", () => {
  const isoArb = fc
    .integer({ min: 2020, max: 2030 })
    .chain((y) =>
      fc
        .tuple(
          fc.integer({ min: 1, max: 12 }),
          fc.integer({ min: 1, max: 28 }),
          fc.integer({ min: 0, max: 23 }),
          fc.integer({ min: 0, max: 59 }),
          fc.integer({ min: 0, max: 59 })
        )
        .map(([mo, d, h, mi, s]) => new Date(Date.UTC(y, mo - 1, d, h, mi, s)).toISOString())
    );

  it("property: source.shares = dest.shares; currencies match; tradeDate equal; notes reference peer portfolio", () => {
    fc.assert(
      fc.property(
        intentArb.filter((i) => i.sourcePortfolioId !== i.destPortfolioId && i.amount.gt(0)),
        isoArb,
        (intent, iso) => {
          const { source, dest } = buildTransferTransactions(intent, iso);

          expect(source.shares.eq(dest.shares)).toBe(true);
          expect(source.currency).toBe(dest.currency);
          expect(source.tradeDate).toBe(dest.tradeDate);
          expect(source.tradeDate).toBe(iso);
          expect(source.notes).toContain(intent.destPortfolioId);
          expect(dest.notes).toContain(intent.sourcePortfolioId);
          expect(source.type).toBe("SELL");
          expect(dest.type).toBe("BUY");
        }
      ),
      { numRuns: 300 }
    );
  });
});
