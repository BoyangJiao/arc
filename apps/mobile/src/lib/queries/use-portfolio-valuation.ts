/**
 * usePortfolioValuation — full real-data valuation of a portfolio.
 *
 * Single query that fans out internally:
 *   transactions → computeHoldings → fan out usePrice + useFxRate per holding
 *   → computePortfolioValuation → returns aggregated MarketValuation[] + totals
 *
 * Why a single useQuery rather than per-holding hooks: hooks can't be called in
 * a loop. We *could* use TanStack's useQueries but a single query keyed on the
 * portfolio + reporting currency gives one loading/error state to the UI,
 * predictable cache invalidation, and triggers per-asset adapter calls (each
 * passes through @arc/data-sources cache layer) inside a Promise.all.
 *
 * Returns a PortfolioValuation (from @arc/core) ready to render:
 *   - .totalValue (Decimal, reporting currency)
 *   - .totalCostBasis / .totalUnrealizedPnL / ...Percent
 *   - .perAsset[]: each row has priceNative / valueNative / valueReporting /
 *     unrealizedPnL — both native and reporting columns the IA contract requires
 *
 * Stage 1 contract:
 *   - One reporting currency (from user prefs) at a time
 *   - Skips holdings whose adapter is unregistered (logs to console; row absent)
 *   - Skips holdings whose FX rate cannot be resolved (row absent)
 *   - Empty holdings → returns null totals (caller renders empty-state)
 */

import { useMemo } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  computePortfolioValuation,
  parseAssetId,
  type Currency,
  type FxRate,
  type PortfolioValuation,
  type PriceQuote,
} from "@arc/core";
import { fetchFxWithCache, fetchPriceWithCache, RateLimitError } from "@arc/data-sources";
import type { Holding } from "@arc/core";

import { fxCache, priceCache, registry } from "../market-data";
import { usePortfolioHoldings } from "./use-portfolio-holdings";

/** Cache freshness window for prices in this query (ms). */
const PRICE_FRESHNESS_MS = 60 * 1000;

/** Cache freshness window for FX rates in this query (ms). */
const FX_FRESHNESS_MS = 4 * 60 * 60 * 1000;

/** Alpha Vantage free tier: 5 req/min — wait between retries when throttled. */
const AV_RATE_LIMIT_BACKOFF_MS = 12_500;

/** Small gap between symbols to avoid bursting the per-minute cap on cold start. */
const AV_INTER_SYMBOL_GAP_MS = 350;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const fetchQuoteForHolding = async (
  holding: Holding,
  freshnessMs: number
): Promise<PriceQuote | null> => {
  const adapter = registry.resolvePriceAdapterByAssetId(holding.assetId);
  const { symbol } = parseAssetId(holding.assetId);

  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fetchPriceWithCache({
        adapter,
        symbol,
        cache: priceCache,
        freshnessMs,
      });
    } catch (err) {
      if (err instanceof RateLimitError && attempt < maxAttempts - 1) {
        await sleep(err.retryAfterMs ?? AV_RATE_LIMIT_BACKOFF_MS);
        continue;
      }
      console.warn(
        `[portfolio-valuation] price fetch failed for ${holding.assetId}:`,
        err instanceof Error ? err.message : err
      );
      return null;
    }
  }
  return null;
};

/**
 * Fetch quotes sequentially with rate-limit backoff.
 * Parallel fan-out caused flaky 1/2/3 holding counts when AV throttled mid-flight.
 */
const fetchAllQuotes = async (
  holdings: readonly Holding[],
  freshnessMs: number
): Promise<PriceQuote[]> => {
  const quotes: PriceQuote[] = [];
  for (let i = 0; i < holdings.length; i++) {
    if (i > 0) await sleep(AV_INTER_SYMBOL_GAP_MS);
    const quote = await fetchQuoteForHolding(holdings[i], freshnessMs);
    if (quote) quotes.push(quote);
  }
  return quotes;
};

export const usePortfolioValuation = (
  portfolioId: string | undefined,
  reportingCurrency: Currency
): UseQueryResult<PortfolioValuation | null, Error> => {
  const { holdings, data: transactions } = usePortfolioHoldings(portfolioId);

  // Cache key includes a transaction-list fingerprint so adding a tx invalidates.
  const txFingerprint = useMemo(
    () => (transactions ? `${transactions.length}:${transactions.at(-1)?.id ?? ""}` : "0"),
    [transactions]
  );

  return useQuery({
    queryKey: ["portfolioValuation", portfolioId, reportingCurrency, txFingerprint],
    enabled: !!portfolioId && holdings.length > 0,
    staleTime: PRICE_FRESHNESS_MS,
    queryFn: async (): Promise<PortfolioValuation | null> => {
      if (!portfolioId || holdings.length === 0) return null;

      // 1) Sequential price fetches (AV free tier: 5/min; parallel caused flaky counts).
      const quotes = await fetchAllQuotes(holdings, PRICE_FRESHNESS_MS);

      // 2) Unique non-identity currency pairs.
      const pairs = new Set<string>();
      for (const h of holdings) {
        if (h.currency !== reportingCurrency) {
          pairs.add(`${h.currency}->${reportingCurrency}`);
        }
      }

      // 3) Fan out FX fetches in parallel.
      const fxResults = await Promise.allSettled(
        Array.from(pairs).map(async (pair): Promise<FxRate> => {
          const [from, to] = pair.split("->") as [Currency, Currency];
          return await fetchFxWithCache({
            adapter: registry.fxAdapter,
            from,
            to,
            cache: fxCache,
            freshnessMs: FX_FRESHNESS_MS,
          });
        })
      );
      const fxRates: FxRate[] = [];
      for (const result of fxResults) {
        if (result.status === "fulfilled") {
          fxRates.push(result.value);
        }
      }

      // 4) Aggregate via @arc/core.
      return computePortfolioValuation(portfolioId, holdings, quotes, fxRates, reportingCurrency);
    },
  });
};
