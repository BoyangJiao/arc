/**
 * Historical portfolio valuation for a single UTC day — TWR valueAt fallback.
 *
 * Used when portfolio_value_snapshots has no row for a boundary day (spec §决策 12).
 */

import Decimal from "decimal.js";
import {
  computeHoldings,
  computePortfolioValuation,
  parseAssetId,
  type Currency,
  type FxRate,
  type Holding,
  type PriceQuote,
  type Transaction,
} from "@arc/core";

import { getRegistry } from "./market-data";
import { endOfUtcDay } from "./time-range";
import { indexByUtcDay, lookupByUtcDayWithForwardFill } from "./twr-day-lookup";

const CASH_SOURCE = "cash-constant";
const FORWARD_FILL_LOOKBACK_DAYS = 30;
// Forward-fill historical FX up to 7 days back (covers ECB weekends + bank
// holidays). Past 7 days we throw — surfacing "—" in UI rather than silently
// substituting an unrelated rate (spec §决策 4: 混用历史/当前价 = P0 bug).
const FX_LOOKBACK_DAYS = 7;

const utcDayBounds = (dayKey: string): { from: Date; to: Date } => ({
  from: new Date(`${dayKey}T00:00:00.000Z`),
  to: new Date(`${dayKey}T23:59:59.999Z`),
});

const lookbackFromDayKey = (dayKey: string, days: number): Date => {
  const d = new Date(`${dayKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
};

const cashQuoteOnDay = (assetId: string, currency: Currency, dayKey: string): PriceQuote => ({
  assetId,
  price: new Decimal(1),
  currency,
  asOf: `${dayKey}T23:00:00.000Z`,
  source: CASH_SOURCE,
});

export const fetchHistoricalQuoteOnDay = async (
  assetId: string,
  dayKey: string
): Promise<PriceQuote> => {
  const { market, symbol } = parseAssetId(assetId);

  if (market === "CASH") {
    return cashQuoteOnDay(assetId, symbol as Currency, dayKey);
  }

  const adapter = getRegistry().resolvePriceAdapterByAssetId(assetId);
  if (!adapter.fetchHistorical) {
    throw new Error(`no historical price adapter for ${assetId}`);
  }

  const { to } = utcDayBounds(dayKey);
  const from = lookbackFromDayKey(dayKey, FORWARD_FILL_LOOKBACK_DAYS);
  const quotes = await adapter.fetchHistorical(symbol, from, to);
  const index = indexByUtcDay(quotes);
  const hit = lookupByUtcDayWithForwardFill(dayKey, index);
  if (!hit) {
    throw new Error(`no historical price for ${assetId} on ${dayKey}`);
  }
  return hit;
};

/**
 * Historical FX rate for a TWR boundary day.
 *
 * Forward-fills up to FX_LOOKBACK_DAYS days back when the adapter throws for
 * the exact day (covers ECB weekend/holiday gaps). Past the lookback window
 * the function throws — callers must NOT substitute a current FX rate (spec
 * §决策 4 / constitution §Currency: 混用历史/当前价 = P0 bug).
 */
export const fetchFxRateOnDay = async (
  from: Currency,
  to: Currency,
  dayKey: string
): Promise<FxRate> => {
  if (from === to) {
    return {
      from,
      to,
      rate: new Decimal(1),
      asOf: `${dayKey}T15:00:00.000Z`,
      source: "identity",
    };
  }

  const adapter = getRegistry().fxAdapter;
  if (!adapter.fetchHistoricalRate) {
    throw new Error(
      `no historical FX adapter for ${from}->${to}; cannot value TWR boundary ${dayKey}`
    );
  }

  const baseDate = new Date(`${dayKey}T12:00:00.000Z`);
  let lastError: unknown;
  for (let lookback = 0; lookback < FX_LOOKBACK_DAYS; lookback++) {
    const probe = new Date(baseDate);
    probe.setUTCDate(probe.getUTCDate() - lookback);
    try {
      return await adapter.fetchHistoricalRate(from, to, probe);
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(
    `no historical FX ${from}->${to} within ${FX_LOOKBACK_DAYS} days back from ${dayKey}: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
};

const transactionsUpToDay = (
  transactions: readonly Transaction[],
  dayKey: string
): readonly Transaction[] => {
  const endMs = endOfUtcDay(new Date(`${dayKey}T12:00:00.000Z`)).getTime();
  return transactions.filter((tx) => new Date(tx.tradeDate).getTime() <= endMs);
};

const fetchQuotesForHoldings = async (
  holdings: readonly Holding[],
  dayKey: string
): Promise<PriceQuote[]> => {
  const quotes: PriceQuote[] = [];
  for (const holding of holdings) {
    quotes.push(await fetchHistoricalQuoteOnDay(holding.assetId, dayKey));
  }
  return quotes;
};

const fetchFxForHoldings = async (
  holdings: readonly Holding[],
  reportingCurrency: Currency,
  dayKey: string
): Promise<FxRate[]> => {
  const pairs = new Set<string>();
  for (const holding of holdings) {
    if (holding.currency !== reportingCurrency) {
      pairs.add(`${holding.currency}->${reportingCurrency}`);
    }
  }

  const rates: FxRate[] = [];
  for (const pair of pairs) {
    const [from, to] = pair.split("->") as [Currency, Currency];
    rates.push(await fetchFxRateOnDay(from, to, dayKey));
  }
  return rates;
};

/** Recompute portfolio total value on `dayKey` from transactions + historical prices/FX. */
export const computeValuationAtDate = async (input: {
  readonly portfolioId: string;
  readonly dayKey: string;
  readonly transactions: readonly Transaction[];
  readonly reportingCurrency: Currency;
}): Promise<Decimal> => {
  const txsUpTo = transactionsUpToDay(input.transactions, input.dayKey);
  const holdings = computeHoldings(txsUpTo);
  if (holdings.length === 0) return new Decimal(0);

  const quotes = await fetchQuotesForHoldings(holdings, input.dayKey);
  const fxRates = await fetchFxForHoldings(holdings, input.reportingCurrency, input.dayKey);

  const valuation = computePortfolioValuation(
    input.portfolioId,
    holdings,
    quotes,
    fxRates,
    input.reportingCurrency
  );

  return valuation.totalValue;
};
