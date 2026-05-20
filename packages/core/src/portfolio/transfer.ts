/**
 * portfolio/transfer — 跨组合现金转账纯函数 (Stage 3 Block B)
 *
 * 决策 1：转账 = 两笔 transaction（源 SELL + 目标 BUY），数据模型零改动。
 * 决策 4：notes 标记 transfer-out-to-{dest} / transfer-in-from-{source}。
 *
 * 不做 I/O；金额一律 Decimal。
 */

import Decimal from "decimal.js";

import {
  parseAssetId,
  type Currency,
  type Transaction,
  type TransactionType,
} from "../domain/types";

export interface TransferIntent {
  readonly sourcePortfolioId: string;
  readonly destPortfolioId: string;
  readonly assetId: `CASH:${Currency}`;
  readonly amount: Decimal;
}

export type TransferError =
  | { readonly code: "amount_not_positive" }
  | { readonly code: "amount_exceeds_balance"; readonly balance: Decimal }
  | { readonly code: "same_portfolio" }
  | { readonly code: "non_cash_asset" };

/** Insert-ready transaction row (no server-assigned id). */
export type NewTransaction = Omit<Transaction, "id">;

const isCashAssetId = (assetId: string): boolean => {
  if (!assetId.startsWith("CASH:")) return false;
  try {
    return parseAssetId(assetId).market === "CASH";
  } catch {
    return false;
  }
};

const cashCurrencyFromAssetId = (assetId: `CASH:${Currency}`): Currency => {
  const { symbol } = parseAssetId(assetId);
  return symbol as Currency;
};

/**
 * 校验跨组合现金转账意图。
 *
 * @returns 错误数组；空数组表示通过
 */
export const validateTransfer = (
  intent: TransferIntent,
  sourceBalance: Decimal
): ReadonlyArray<TransferError> => {
  const errors: TransferError[] = [];

  if (!isCashAssetId(intent.assetId)) {
    errors.push({ code: "non_cash_asset" });
  }

  if (intent.sourcePortfolioId === intent.destPortfolioId) {
    errors.push({ code: "same_portfolio" });
  }

  if (!intent.amount.gt(0)) {
    errors.push({ code: "amount_not_positive" });
  }

  if (intent.amount.gt(sourceBalance)) {
    errors.push({ code: "amount_exceeds_balance", balance: sourceBalance });
  }

  return errors;
};

/**
 * 构建源/目标两笔转账 transaction（调用方应先通过 validateTransfer）。
 *
 * CASH 份额 = 金额；price_per_share = 1；fee = 0。
 */
export const buildTransferTransactions = (
  intent: TransferIntent,
  createdAtIso: string
): { readonly source: NewTransaction; readonly dest: NewTransaction } => {
  const currency = cashCurrencyFromAssetId(intent.assetId);
  const shares = intent.amount;
  const pricePerShare = new Decimal(1);
  const fee = new Decimal(0);

  const source: NewTransaction = {
    portfolioId: intent.sourcePortfolioId,
    assetId: intent.assetId,
    type: "SELL" satisfies TransactionType,
    shares,
    pricePerShare,
    currency,
    fee,
    tradeDate: createdAtIso,
    notes: `transfer-out-to-${intent.destPortfolioId}`,
  };

  const dest: NewTransaction = {
    portfolioId: intent.destPortfolioId,
    assetId: intent.assetId,
    type: "BUY" satisfies TransactionType,
    shares,
    pricePerShare,
    currency,
    fee,
    tradeDate: createdAtIso,
    notes: `transfer-in-from-${intent.sourcePortfolioId}`,
  };

  return { source, dest };
};
