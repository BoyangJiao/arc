/**
 * usePortfolioValuation — full real-data valuation of a portfolio.
 *
 * Single query that fans out internally:
 *   transactions → computeHoldings → fan out usePrice + useFxRate per holding
 *   → computePortfolioValuation → returns aggregated MarketValuation[] + totals
 *
 * Performance / Alpha Vantage free tier (5 req/min):
 *   - Default: 15 min TanStack staleTime + Supabase price_snapshots cache reads
 *   - Sequential symbol fetches with backoff on RateLimitError
 *   - `refreshValuation()` bypasses cache once (pull-to-refresh)
 *
 * Dev tip: run `pnpm seed:dev` — it also seeds price_snapshots so cold starts
 * avoid hitting AV on every navigation.
 */

import { useCallback, useMemo, useRef } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  computePortfolioValuation,
  parseAssetId,
  type Currency,
  type FxRate,
  type PortfolioValuation,
  type PriceQuote,
} from "@arc/core";
import {
  DEFAULT_PRICE_FRESHNESS_MS,
  fetchFxWithCache,
  fetchPriceWithCache,
  RateLimitError,
} from "@arc/data-sources";
import type { Holding } from "@arc/core";

import { fxCache, priceCache, registry } from "../market-data";
import { usePortfolioHoldings } from "./use-portfolio-holdings";

/** Align with @arc/data-sources default (15 min) — not 60s — to reduce AV calls. */
const PRICE_FRESHNESS_MS = DEFAULT_PRICE_FRESHNESS_MS;

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

export type PortfolioValuationQuery = UseQueryResult<PortfolioValuation | null, Error> & {
  /** Force a fresh quote fetch (freshnessMs=0) — use for pull-to-refresh. */
  refreshValuation: () => Promise<void>;
};

export const usePortfolioValuation = (
  portfolioId: string | undefined,
  reportingCurrency: Currency
): PortfolioValuationQuery => {
  const { holdings, data: transactions } = usePortfolioHoldings(portfolioId);
  const bypassCacheRef = useRef(false);

  const txFingerprint = useMemo(
    () => (transactions ? `${transactions.length}:${transactions.at(-1)?.id ?? ""}` : "0"),
    [transactions]
  );

  const query = useQuery({
    queryKey: ["portfolioValuation", portfolioId, reportingCurrency, txFingerprint],
    enabled: !!portfolioId && holdings.length > 0,
    staleTime: PRICE_FRESHNESS_MS,
    gcTime: PRICE_FRESHNESS_MS * 2,
    queryFn: async (): Promise<PortfolioValuation | null> => {
      if (!portfolioId || holdings.length === 0) return null;

      const freshnessMs = bypassCacheRef.current ? 0 : PRICE_FRESHNESS_MS;
      bypassCacheRef.current = false;

      const quotes = await fetchAllQuotes(holdings, freshnessMs);

      const pairs = new Set<string>();
      for (const h of holdings) {
        if (h.currency !== reportingCurrency) {
          pairs.add(`${h.currency}->${reportingCurrency}`);
        }
      }

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

      return computePortfolioValuation(portfolioId, holdings, quotes, fxRates, reportingCurrency);
    },
  });

  const refreshValuation = useCallback(async (): Promise<void> => {
    bypassCacheRef.current = true;
    await query.refetch();
  }, [query.refetch]);

  return { ...query, refreshValuation };
};
