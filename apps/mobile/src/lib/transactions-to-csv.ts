/**
 * transactions-to-csv — pure function, no IO, no Decimal formatting.
 *
 * Spec: .specify/feature-specs/stage-3/csv-export-stage-3.md §决策 2
 *
 * Columns (RFC 4180):
 *   portfolio_id, portfolio_name, asset_id, type,
 *   shares, price_per_share, currency, fee, trade_date, notes
 *
 * Numbers: Decimal.toString() — full precision, no formatting, no masking.
 * Notes:   RFC 4180 — wrap in double quotes if value contains comma, quote, or newline;
 *          escape embedded double quotes as "".
 */

import type { Transaction } from "@arc/core";

export const CSV_HEADER =
  "portfolio_id,portfolio_name,asset_id,type,shares,price_per_share,currency,fee,trade_date,notes";

/** RFC 4180 field escaping. */
export const escapeCsvField = (value: string): string => {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

export interface TransactionsToCsvOptions {
  /** Map from portfolioId → portfolio display name (used for portfolio_name column). */
  readonly portfolioNameById: Readonly<Record<string, string>>;
}

/**
 * Convert an array of Transaction domain objects to a CSV string.
 *
 * Returns only the header row when `transactions` is empty.
 * Numbers are emitted via Decimal.toString() — no rounding, no locale formatting.
 */
export const transactionsToCsv = (
  transactions: readonly Transaction[],
  options: TransactionsToCsvOptions
): string => {
  const rows: string[] = [CSV_HEADER];

  for (const tx of transactions) {
    const portfolioName = options.portfolioNameById[tx.portfolioId] ?? tx.portfolioId;

    const row = [
      escapeCsvField(tx.portfolioId),
      escapeCsvField(portfolioName),
      escapeCsvField(tx.assetId),
      escapeCsvField(tx.type),
      tx.shares.toString(),
      tx.pricePerShare.toString(),
      escapeCsvField(tx.currency),
      tx.fee.toString(),
      escapeCsvField(tx.tradeDate),
      escapeCsvField(tx.notes ?? ""),
    ].join(",");

    rows.push(row);
  }

  return rows.join("\r\n");
};
