/**
 * Cross-portfolio cash transfer unit tests (Stage 3 Block B).
 */

import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";

import {
  buildTransferTransactions,
  validateTransfer,
  type TransferIntent,
} from "../src/portfolio/transfer";

const dec = (n: number | string): Decimal => new Decimal(n);

const mkIntent = (overrides: Partial<TransferIntent> = {}): TransferIntent => ({
  sourcePortfolioId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  destPortfolioId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  assetId: "CASH:USD",
  amount: dec(1000),
  ...overrides,
});

describe("validateTransfer", () => {
  it("valid intent returns no errors", () => {
    expect(validateTransfer(mkIntent(), dec(5000))).toEqual([]);
  });

  it("amount zero returns amount_not_positive", () => {
    const errs = validateTransfer(mkIntent({ amount: dec(0) }), dec(5000));
    expect(errs.some((e) => e.code === "amount_not_positive")).toBe(true);
  });

  it("negative amount returns amount_not_positive", () => {
    const errs = validateTransfer(mkIntent({ amount: dec(-1) }), dec(5000));
    expect(errs.some((e) => e.code === "amount_not_positive")).toBe(true);
  });

  it("amount exceeds balance returns amount_exceeds_balance with balance", () => {
    const balance = dec(4000);
    const errs = validateTransfer(mkIntent({ amount: dec(5000) }), balance);
    const hit = errs.find((e) => e.code === "amount_exceeds_balance");
    expect(hit).toBeDefined();
    if (hit?.code === "amount_exceeds_balance") {
      expect(hit.balance.eq(balance)).toBe(true);
    }
  });

  it("same portfolio returns same_portfolio", () => {
    const id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const errs = validateTransfer(
      mkIntent({ sourcePortfolioId: id, destPortfolioId: id }),
      dec(5000)
    );
    expect(errs.some((e) => e.code === "same_portfolio")).toBe(true);
  });

  it("non-cash asset returns non_cash_asset", () => {
    const errs = validateTransfer(
      mkIntent({ assetId: "US:AAPL" as TransferIntent["assetId"] }),
      dec(5000)
    );
    expect(errs.some((e) => e.code === "non_cash_asset")).toBe(true);
  });
});

describe("buildTransferTransactions", () => {
  const iso = "2026-05-20T12:00:00.000Z";

  it("builds SELL on source and BUY on dest with matching shares", () => {
    const intent = mkIntent({ amount: dec(1000) });
    const { source, dest } = buildTransferTransactions(intent, iso);

    expect(source.type).toBe("SELL");
    expect(dest.type).toBe("BUY");
    expect(source.shares.eq(dest.shares)).toBe(true);
    expect(source.shares.eq(dec(1000))).toBe(true);
  });

  it("uses price 1 and matching currency from CASH asset", () => {
    const intent = mkIntent({ assetId: "CASH:CNY", amount: dec(500) });
    const { source, dest } = buildTransferTransactions(intent, iso);

    expect(source.pricePerShare.eq(1)).toBe(true);
    expect(dest.pricePerShare.eq(1)).toBe(true);
    expect(source.currency).toBe("CNY");
    expect(dest.currency).toBe("CNY");
    expect(source.fee.isZero()).toBe(true);
    expect(dest.fee.isZero()).toBe(true);
  });

  it("uses same tradeDate and cross-references portfolio ids in notes", () => {
    const intent = mkIntent();
    const { source, dest } = buildTransferTransactions(intent, iso);

    expect(source.tradeDate).toBe(iso);
    expect(dest.tradeDate).toBe(iso);
    expect(source.notes).toBe(`transfer-out-to-${intent.destPortfolioId}`);
    expect(dest.notes).toBe(`transfer-in-from-${intent.sourcePortfolioId}`);
    expect(source.notes).toContain(intent.destPortfolioId);
    expect(dest.notes).toContain(intent.sourcePortfolioId);
  });
});
