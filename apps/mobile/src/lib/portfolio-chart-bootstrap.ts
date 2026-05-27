/**
 * Bootstrap portfolio NAV chart from transactions when daily snapshots are absent.
 *
 * Algorithm: **True Historical** (per ADR 014).
 *
 *   point(T) = Σ_asset ( shares_held_at_T × historical_price_at_T × historical_fx_at_T )
 *
 * - Each sample day uses the actual holdings as of that day (transactions ≤ T).
 *   Days before the first trade emit a chart point with totalValue = 0 so the
 *   stair-step rise at first cash flow is visible in the UI.
 * - Forward-fill only when a quote is missing for a specific day (e.g. weekends);
 *   never substitute a future quote for a pre-position day.
 * - Last point is replaced by live valuation so the hero number lines up exactly
 *   with the right-most chart point.
 *
 * Performance: N adapter calls (one wide historical fetch per asset ever held),
 * not N×M. FX fetched once per sample day, cache-amortized.
 */

import Decimal from "decimal.js";
import {
  computeHoldings,
  computePortfolioValuation,
  parseAssetId,
  type Currency,
  type FxRate,
  type Holding,
  type PortfolioValuation,
  type PriceQuote,
  type Transaction,
} from "@arc/core";
import type { TimeRange } from "@arc/ui";

import { fetchFxRateOnDay } from "./compute-valuation-at-date";
import { getRegistry } from "./market-data";
import type { PortfolioSnapshotPoint } from "./queries/use-portfolio-value-snapshots";
import { rangeToWindow } from "./time-range";
import { indexByUtcDay, lookupByUtcDayWithForwardFill, toUtcDayKey } from "./twr-day-lookup";
import { resolvePortfolioTwrWindow } from "./twr-window";

const toSnapshotPoint = (input: {
  asOf: string;
  totalValue: Decimal;
  reportingCurrency: Currency;
  perAssetReporting: ReadonlyMap<string, Decimal>;
}): PortfolioSnapshotPoint => ({
  asOf: input.asOf,
  totalValue: input.totalValue,
  reportingCurrency: input.reportingCurrency,
  perAssetReporting: input.perAssetReporting,
});

export const liveValuationToChartPoint = (
  valuation: PortfolioValuation,
  asOf: string
): PortfolioSnapshotPoint => {
  const perAssetReporting = new Map<string, Decimal>();
  for (const row of valuation.perAsset) {
    perAssetReporting.set(row.assetId, row.valueReporting);
  }
  return toSnapshotPoint({
    asOf,
    totalValue: valuation.totalValue,
    reportingCurrency: valuation.reportingCurrency,
    perAssetReporting,
  });
};

/**
 * Sample density per range (user-requested):
 *   1D       → 1 interval (2 keys: yesterday + today)
 *   1W       → daily (7 intervals = 8 keys → ~7 unique days)
 *   1M       → daily (30 intervals → ~30 unique days)
 *   3M / YTD / 1Y / ALL → weekly (≈ days/7 intervals)
 *
 * Higher sample density on shorter ranges lets the per-asset baseline scan
 * find real historical prices (instead of falling to cost-basis fallback).
 */
const DAY_MS = 86_400_000;
const sampleCountForRange = (range: TimeRange, windowFrom: Date, windowTo: Date): number => {
  switch (range) {
    case "1D":
      return 1;
    case "1W":
      return 7;
    case "1M":
      return 30;
    case "3M":
    case "YTD":
    case "1Y":
    case "ALL": {
      const days = Math.max(0, (windowTo.getTime() - windowFrom.getTime()) / DAY_MS);
      return Math.max(7, Math.round(days / 7));
    }
  }
};

const buildSampleDayKeys = (input: {
  readonly windowFrom: Date;
  readonly windowTo: Date;
  readonly sampleCount: number;
}): string[] => {
  const fromMs = input.windowFrom.getTime();
  const toMs = input.windowTo.getTime();
  if (toMs <= fromMs) return [toUtcDayKey(input.windowTo)];

  const keys = new Set<string>();
  for (let i = 0; i <= input.sampleCount; i++) {
    const t = fromMs + Math.round(((toMs - fromMs) * i) / input.sampleCount);
    keys.add(toUtcDayKey(new Date(t)));
  }
  return Array.from(keys).sort();
};

interface HistoricalPriceLookup {
  readonly assetId: string;
  readonly currency: Currency;
  readonly index: ReadonlyMap<string, PriceQuote>;
}

const prefetchHistoricalPriceLookups = async (
  assetIds: readonly string[],
  windowFrom: Date,
  windowTo: Date
): Promise<readonly HistoricalPriceLookup[]> => {
  const results = await Promise.allSettled(
    assetIds.map(async (assetId): Promise<HistoricalPriceLookup | null> => {
      const { market, symbol } = parseAssetId(assetId);
      if (market === "CASH") {
        return null; // cash valued separately
      }
      const adapter = getRegistry().resolvePriceAdapterByAssetId(assetId);
      if (!adapter.fetchHistorical) return null;
      const quotes = await adapter.fetchHistorical(symbol, windowFrom, windowTo);
      if (quotes.length === 0) return null;
      const first = quotes[0]!;
      return { assetId, currency: first.currency, index: indexByUtcDay(quotes) };
    })
  );

  const out: HistoricalPriceLookup[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) out.push(r.value);
  }
  return out;
};

const cashQuoteOnDay = (assetId: string, currency: Currency, dayKey: string): PriceQuote => ({
  assetId,
  price: new Decimal(1),
  currency,
  asOf: `${dayKey}T23:00:00.000Z`,
  source: "cash-constant",
});

/**
 * True-historical valuation on a single UTC day from pre-fetched price + FX.
 *
 * Returns null when the day's holdings contain non-cash assets that all fail
 * to resolve a price (chart point would be ambiguous — better to skip).
 * Returns `{totalValue: 0, …}` for days the portfolio was empty.
 */
const valuationOnDay = (input: {
  readonly portfolioId: string;
  readonly dayKey: string;
  readonly holdingsOnDay: readonly Holding[];
  readonly priceLookups: readonly HistoricalPriceLookup[];
  readonly fxRates: readonly FxRate[];
  readonly reportingCurrency: Currency;
}): PortfolioValuation | null => {
  if (input.holdingsOnDay.length === 0) {
    return {
      portfolioId: input.portfolioId,
      reportingCurrency: input.reportingCurrency,
      totalValue: new Decimal(0),
      totalCostBasis: new Decimal(0),
      totalUnrealizedPnL: new Decimal(0),
      totalUnrealizedPnLPercent: new Decimal(0),
      perAsset: [],
      computedAt: `${input.dayKey}T23:00:00.000Z`,
    };
  }

  const quotes: PriceQuote[] = [];
  const usableHoldings: Holding[] = [];
  for (const holding of input.holdingsOnDay) {
    const { market, symbol } = parseAssetId(holding.assetId);
    if (market === "CASH") {
      quotes.push(cashQuoteOnDay(holding.assetId, symbol as Currency, input.dayKey));
      usableHoldings.push(holding);
      continue;
    }
    const lookup = input.priceLookups.find((p) => p.assetId === holding.assetId);
    if (!lookup) continue;
    // Forward-fill only — never substitute a future quote for a day before the
    // asset's first quote (ADR 014: no backward fill in True Historical mode).
    const hit = lookupByUtcDayWithForwardFill(input.dayKey, lookup.index);
    if (!hit) continue;
    quotes.push(hit);
    usableHoldings.push(holding);
  }
  if (usableHoldings.length === 0) return null;

  return computePortfolioValuation(
    input.portfolioId,
    usableHoldings,
    quotes,
    input.fxRates,
    input.reportingCurrency
  );
};

const collectFxPairsFromTransactions = (
  transactions: readonly Transaction[],
  reportingCurrency: Currency
): ReadonlyArray<{ from: Currency; to: Currency }> => {
  const set = new Map<string, { from: Currency; to: Currency }>();
  for (const tx of transactions) {
    if (tx.currency === reportingCurrency) continue;
    const key = `${tx.currency}->${reportingCurrency}`;
    if (!set.has(key)) set.set(key, { from: tx.currency, to: reportingCurrency });
  }
  return Array.from(set.values());
};

const collectAssetIdsFromTransactions = (transactions: readonly Transaction[]): string[] => {
  const seen = new Set<string>();
  for (const tx of transactions) seen.add(tx.assetId);
  return Array.from(seen);
};

const transactionsUpToDayKey = (
  transactions: readonly Transaction[],
  dayKey: string
): readonly Transaction[] => {
  // End-of-day comparison: include any tx whose tradeDate falls on or before dayKey.
  const endOfDay = new Date(`${dayKey}T23:59:59.999Z`).getTime();
  return transactions.filter((tx) => new Date(tx.tradeDate).getTime() <= endOfDay);
};

const snapshotFromValuation = (
  valuation: PortfolioValuation,
  dayKey: string,
  reportingCurrency: Currency
): PortfolioSnapshotPoint => {
  const perAssetReporting = new Map<string, Decimal>();
  for (const row of valuation.perAsset) {
    perAssetReporting.set(row.assetId, row.valueReporting);
  }
  return toSnapshotPoint({
    asOf: `${dayKey}T12:00:00.000Z`,
    totalValue: valuation.totalValue,
    reportingCurrency,
    perAssetReporting,
  });
};

const buildSampledChartPoints = async (input: {
  readonly portfolioId: string;
  readonly range: TimeRange;
  readonly transactions: readonly Transaction[];
  readonly reportingCurrency: Currency;
  readonly liveValuation: PortfolioValuation | null | undefined;
}): Promise<readonly PortfolioSnapshotPoint[]> => {
  if (input.transactions.length === 0) return [];

  // Window: ALL clamps to first trade; others are pure calendar.
  const window = resolvePortfolioTwrWindow(input.range, input.transactions);
  const sampleDays = buildSampleDayKeys({
    windowFrom: window.from,
    windowTo: window.to,
    sampleCount: sampleCountForRange(input.range, window.from, window.to),
  });
  if (sampleDays.length === 0) return [];

  // Pre-fetch one wide historical window per asset EVER traded (handles assets
  // bought-then-sold in the window). Widen start by 30 days for forward-fill.
  const lookupFrom = new Date(`${sampleDays[0]!}T00:00:00.000Z`);
  lookupFrom.setUTCDate(lookupFrom.getUTCDate() - 30);
  const allAssetIds = collectAssetIdsFromTransactions(input.transactions);
  const priceLookups = await prefetchHistoricalPriceLookups(allAssetIds, lookupFrom, window.to);

  // FX pairs from all tx currencies (covers closed positions whose currency
  // is no longer in current holdings).
  const fxPairs = collectFxPairsFromTransactions(input.transactions, input.reportingCurrency);

  // Fetch FX once per sample day, serially (adapter caches absorb duplicates).
  const fxByDay = new Map<string, FxRate[]>();
  for (const dayKey of sampleDays) {
    const rates: FxRate[] = [];
    try {
      for (const pair of fxPairs) {
        rates.push(await fetchFxRateOnDay(pair.from, pair.to, dayKey));
      }
      fxByDay.set(dayKey, rates);
    } catch {
      // Skip day if FX unresolvable — chart will interpolate visually.
    }
  }

  const points: PortfolioSnapshotPoint[] = [];
  // All sample days EXCEPT the last get bootstrapped (live valuation covers
  // the last day so the hero card and right-most chart point match exactly).
  const bootstrapDays = sampleDays.slice(0, -1);
  for (const dayKey of bootstrapDays) {
    const holdingsOnDay = computeHoldings(transactionsUpToDayKey(input.transactions, dayKey));

    // Empty-portfolio days still emit a point (totalValue = 0) so the
    // stair-step at first cash flow renders correctly.
    if (holdingsOnDay.length === 0) {
      points.push(
        toSnapshotPoint({
          asOf: `${dayKey}T12:00:00.000Z`,
          totalValue: new Decimal(0),
          reportingCurrency: input.reportingCurrency,
          perAssetReporting: new Map(),
        })
      );
      continue;
    }

    const fxRates = fxByDay.get(dayKey);
    if (!fxRates) continue;

    const valuation = valuationOnDay({
      portfolioId: input.portfolioId,
      dayKey,
      holdingsOnDay,
      priceLookups,
      fxRates,
      reportingCurrency: input.reportingCurrency,
    });
    if (!valuation) continue;
    points.push(snapshotFromValuation(valuation, dayKey, input.reportingCurrency));
  }

  // Last point = live valuation (preferred — matches the hero card exactly).
  if (input.liveValuation && input.liveValuation.perAsset.length > 0) {
    points.push(liveValuationToChartPoint(input.liveValuation, new Date().toISOString()));
  } else {
    // Fallback: bootstrap the last sample day too.
    const lastDay = sampleDays[sampleDays.length - 1]!;
    const holdingsOnLast = computeHoldings(transactionsUpToDayKey(input.transactions, lastDay));
    const fxRates = fxByDay.get(lastDay);
    if (holdingsOnLast.length === 0) {
      points.push(
        toSnapshotPoint({
          asOf: `${lastDay}T12:00:00.000Z`,
          totalValue: new Decimal(0),
          reportingCurrency: input.reportingCurrency,
          perAssetReporting: new Map(),
        })
      );
    } else if (fxRates) {
      const valuation = valuationOnDay({
        portfolioId: input.portfolioId,
        dayKey: lastDay,
        holdingsOnDay: holdingsOnLast,
        priceLookups,
        fxRates,
        reportingCurrency: input.reportingCurrency,
      });
      if (valuation) {
        points.push(snapshotFromValuation(valuation, lastDay, input.reportingCurrency));
      }
    }
  }

  // Dedupe by day key in case sample days collide (e.g., very short ranges).
  const dedup = new Map<string, PortfolioSnapshotPoint>();
  for (const p of points) dedup.set(p.asOf.slice(0, 10), p);
  return Array.from(dedup.values()).sort((a, b) => a.asOf.localeCompare(b.asOf));
};

export const buildBootstrapChartPoints = async (input: {
  readonly portfolioId: string;
  readonly range: TimeRange;
  readonly transactions: readonly Transaction[];
  readonly reportingCurrency: Currency;
  readonly liveValuation: PortfolioValuation | null | undefined;
}): Promise<readonly PortfolioSnapshotPoint[]> => {
  if (input.transactions.length === 0) return [];
  return buildSampledChartPoints(input);
};

/** True when DB snapshots alone cannot render a chart for the selected range. */
export const needsChartBootstrap = (
  snapshots: readonly PortfolioSnapshotPoint[],
  range: TimeRange,
  transactions: readonly Transaction[]
): boolean => {
  if (snapshots.length >= 2) return false;
  if (transactions.length === 0) return false;
  const window = rangeToWindow(range);
  return (
    snapshots.length === 0 ||
    transactions.some((tx) => {
      const ms = new Date(tx.tradeDate).getTime();
      return ms >= window.from.getTime() && ms <= window.to.getTime();
    })
  );
};
