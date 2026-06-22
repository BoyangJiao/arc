/**
 * buildHistoricalFxResolver — pre-resolve a synchronous trade-date FX lookup.
 *
 * The pure core algorithms (period-pnl, risk) are sync and must use trade-date
 * FX, never the current rate (宪法 §3.1 Law 5 / 数据模型不变性 §历史≠当下). This
 * fetches every (currency, trade-day) pair that differs from the reporting
 * currency up-front and returns a sync `fxAt(currency, date)` map.
 */

import Decimal from "decimal.js";
import type { Currency, Transaction } from "@arc/core";

import { fetchFxRateOnDay } from "./compute-valuation-at-date";
import { toUtcDayKey } from "./twr-day-lookup";

const ONE = new Decimal(1);

export const buildHistoricalFxResolver = async (input: {
  readonly transactions: readonly Transaction[];
  readonly reportingCurrency: Currency;
}): Promise<(currency: Currency, date: Date) => Decimal> => {
  const needed = new Set<string>(); // `${currency}|${dayKey}`
  for (const tx of input.transactions) {
    if (tx.currency === input.reportingCurrency) continue;
    needed.add(`${tx.currency}|${toUtcDayKey(new Date(tx.tradeDate))}`);
  }

  const fxByKey = new Map<string, Decimal>();
  for (const key of needed) {
    const [currency, dayKey] = key.split("|") as [Currency, string];
    const rate = await fetchFxRateOnDay(currency, input.reportingCurrency, dayKey);
    fxByKey.set(key, rate.rate);
  }

  return (currency: Currency, date: Date): Decimal => {
    if (currency === input.reportingCurrency) return ONE;
    const value = fxByKey.get(`${currency}|${toUtcDayKey(date)}`);
    if (value === undefined) {
      throw new Error(
        `no historical FX ${currency}->${input.reportingCurrency} for ${toUtcDayKey(date)}`
      );
    }
    return value;
  };
};
