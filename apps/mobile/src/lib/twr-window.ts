/**
 * TWR window resolution — extends Block C rangeToWindow for ALL-range semantics.
 */

import { returns, type Transaction } from "@arc/core";
import type { TimeRange } from "@arc/ui";

import { rangeToWindow, startOfUtcDay, type TimeWindow } from "./time-range";

export const earliestPortfolioTradeDate = (transactions: readonly Transaction[]): Date | null => {
  if (transactions.length === 0) return null;
  let earliestMs = Infinity;
  for (const tx of transactions) {
    const ms = new Date(tx.tradeDate).getTime();
    if (ms < earliestMs) earliestMs = ms;
  }
  return new Date(earliestMs);
};

export const collectAssetBoundaryTimestamps = (
  transactions: readonly Transaction[],
  assetId: string,
  from: Date,
  to: Date
): readonly number[] => {
  const fromMs = from.getTime();
  const toMs = to.getTime();
  const times: number[] = [];
  for (const tx of transactions) {
    if (tx.assetId !== assetId) continue;
    if (tx.type !== "BUY" && tx.type !== "SELL") continue;
    const ms = new Date(tx.tradeDate).getTime();
    if (ms <= fromMs || ms >= toMs) continue;
    times.push(ms);
  }
  return times;
};

export const resolveAssetTwrWindow = (
  range: TimeRange,
  transactions: readonly Transaction[],
  assetId: string,
  now: Date = new Date()
): TimeWindow => {
  const base = rangeToWindow(range, now);
  if (range !== "ALL") return base;

  const firstBuy = returns.getAssetFirstBuyDate(transactions, assetId);
  if (!firstBuy) return base;

  return { from: startOfUtcDay(firstBuy), to: base.to };
};

export const resolvePortfolioTwrWindow = (
  range: TimeRange,
  transactions: readonly Transaction[],
  now: Date = new Date()
): TimeWindow => {
  const base = rangeToWindow(range, now);
  if (range !== "ALL") return base;

  const earliest = earliestPortfolioTradeDate(transactions);
  if (!earliest) return base;

  return { from: startOfUtcDay(earliest), to: base.to };
};
