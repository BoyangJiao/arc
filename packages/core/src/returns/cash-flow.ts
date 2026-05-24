/**
 * @arc/core/returns/cash-flow — portfolio cash-flow event detection.
 *
 * Spec: .specify/feature-specs/stage-3/twr-stage-3.md §决策 2.
 *
 * A "cash flow" for TWR is **portfolio-level funding or withdrawal**, not
 * every transaction. The judgment table:
 *
 *   BUY / SELL non-CASH asset    ❌  (moves money ↔ asset inside portfolio)
 *   BUY  CASH:*                  ✅  (user adds cash to portfolio)
 *   SELL CASH:*                  ✅  (user withdraws cash from portfolio)
 *   DIVIDEND                     ❌  (already inside portfolio)
 *   SPLIT                        ❌  (share count changes, total unchanged)
 *   ADJUSTMENT                   ❌  (accounting correction)
 *
 * Block B transfers are encoded as a SELL CASH:* on the source portfolio
 * paired with a BUY CASH:* on the destination, both carrying
 * `notes='transfer-(out-to|in-from)-{portfolioId}'`. Per spec §决策 2 final
 * line, transfers ARE cash flows in the per-portfolio view (Stage 3 default);
 * we do NOT special-case the notes tag here.
 *
 * Pure module — no I/O, no Decimal config side effects.
 */

import type { Transaction } from "../domain/types";

import type { CashFlowEvent } from "./types";

/**
 * Predicate: does this transaction count as a portfolio-level cash flow?
 *
 * Per-row classifier. `detectCashFlowEvents` additionally applies the
 * window filter and sorts.
 */
export const isCashFlowTransaction = (tx: Transaction): boolean => {
  if (tx.type !== "BUY" && tx.type !== "SELL") return false;
  return tx.assetId.startsWith("CASH:");
};

/**
 * Extract cash-flow events from a transaction set, filtered to a TWR window.
 *
 * Window semantics: **strict open interval `(from, to)`**. Events exactly at
 * `from` or `to` are excluded — including them would duplicate a boundary in
 * `[from, ...event_dates, to]` and yield a zero-length sub-period downstream
 * (TWR spec sketch in §Architecture).
 *
 * Output is sorted ascending by `date.getTime()` so sub-period boundaries
 * are deterministic.
 *
 * Sign convention:
 *   BUY  CASH:* → +amount (inflow to portfolio)
 *   SELL CASH:* → -amount (outflow from portfolio)
 *
 * `amount` is in the transaction's native currency. The TWR call site
 * applies historical FX if the reporting currency differs (spec §决策 4).
 */
export const detectCashFlowEvents = (
  transactions: ReadonlyArray<Transaction>,
  from: Date,
  to: Date
): ReadonlyArray<CashFlowEvent> => {
  const fromMs = from.getTime();
  const toMs = to.getTime();

  const events: CashFlowEvent[] = [];
  for (const tx of transactions) {
    if (!isCashFlowTransaction(tx)) continue;

    const date = new Date(tx.tradeDate);
    const ms = date.getTime();
    if (ms <= fromMs || ms >= toMs) continue;

    const gross = tx.shares.times(tx.pricePerShare);
    const amount = tx.type === "BUY" ? gross : gross.negated();

    events.push({
      transactionId: tx.id,
      date,
      amount,
      currency: tx.currency,
    });
  }

  events.sort((a, b) => a.date.getTime() - b.date.getTime());
  return events;
};
