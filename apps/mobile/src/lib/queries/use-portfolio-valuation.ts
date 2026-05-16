/**
 * usePortfolioValuation — full real-data valuation of a portfolio.
 *
 * cache-first (default in __DEV__): only reads layered cache unless the user
 * pull-to-refreshes. Survives app restarts via AsyncStorage.
 *
 * live: 15 min freshness; cache miss hits Alpha Vantage (rate-limit aware).
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
import { fetchFxWithCache, fetchPriceWithCache, RateLimitError } from "@arc/data-sources";
import type { Holding } from "@arc/core";

import {
  CACHE_FIRST_READ_FRESHNESS_MS,
  isCacheFirstMarketData,
  readFxFreshnessMs,
  readPriceFreshnessMs,
  valuationQueryStaleTimeMs,
} from "../market-data-policy";
import { fxCache, priceCache, registry } from "../market-data";
import { usePortfolioHoldings } from "./use-portfolio-holdings";

/** Alpha Vantage free tier: 5 req/min — wait between retries when throttled. */
const AV_RATE_LIMIT_BACKOFF_MS = 12_500;

/** Small gap between symbols to avoid bursting the per-minute cap on pull-to-refresh. */
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

const readCachedQuotesOnly = async (holdings: readonly Holding[]): Promise<PriceQuote[]> => {
  const quotes: PriceQuote[] = [];
  for (const holding of holdings) {
    const cached = await priceCache.get(holding.assetId, CACHE_FIRST_READ_FRESHNESS_MS);
    if (cached) quotes.push(cached);
  }
  return quotes;
};

/** When live fetch / rate-limit fails, reuse any stored quote (seed, prior refresh). */
const fillStaleQuotes = async (
  holdings: readonly Holding[],
  quotes: PriceQuote[]
): Promise<PriceQuote[]> => {
  const have = new Set(quotes.map((q) => q.assetId));
  const merged = [...quotes];

  for (const holding of holdings) {
    if (have.has(holding.assetId)) continue;
    const stale = await priceCache.get(holding.assetId, CACHE_FIRST_READ_FRESHNESS_MS);
    if (stale) {
      merged.push(stale);
      have.add(holding.assetId);
      console.info(`[portfolio-valuation] using stale cached quote for ${holding.assetId}`);
    }
  }

  return merged;
};

const fetchAllQuotes = async (
  holdings: readonly Holding[],
  forceNetwork: boolean
): Promise<PriceQuote[]> => {
  if (!forceNetwork && isCacheFirstMarketData()) {
    return readCachedQuotesOnly(holdings);
  }

  const freshnessMs = readPriceFreshnessMs(forceNetwork);
  const quotes: PriceQuote[] = [];
  const needsNetwork: Holding[] = [];

  for (const holding of holdings) {
    if (freshnessMs > 0) {
      const cached = await priceCache.get(holding.assetId, freshnessMs);
      if (cached) {
        quotes.push(cached);
        continue;
      }
    }
    needsNetwork.push(holding);
  }

  for (let i = 0; i < needsNetwork.length; i++) {
    if (i > 0) await sleep(AV_INTER_SYMBOL_GAP_MS);
    const quote = await fetchQuoteForHolding(needsNetwork[i], 0);
    if (quote) quotes.push(quote);
  }

  return fillStaleQuotes(holdings, quotes);
};

const fetchFxRates = async (pairs: readonly string[], forceNetwork: boolean): Promise<FxRate[]> => {
  const freshnessMs = readFxFreshnessMs(forceNetwork);
  const rates: FxRate[] = [];

  for (const pair of pairs) {
    const [from, to] = pair.split("->") as [Currency, Currency];
    if (!forceNetwork && isCacheFirstMarketData()) {
      const cached = await fxCache.get(from, to, CACHE_FIRST_READ_FRESHNESS_MS);
      if (cached) rates.push(cached);
      continue;
    }

    try {
      const rate = await fetchFxWithCache({
        adapter: registry.fxAdapter,
        from,
        to,
        cache: fxCache,
        freshnessMs,
      });
      rates.push(rate);
    } catch (err) {
      console.warn(
        `[portfolio-valuation] FX fetch failed for ${pair}:`,
        err instanceof Error ? err.message : err
      );
      const stale = await fxCache.get(from, to, CACHE_FIRST_READ_FRESHNESS_MS);
      if (stale) rates.push(stale);
    }
  }

  if (rates.length === 0 && pairs.length > 0) {
    for (const pair of pairs) {
      const [from, to] = pair.split("->") as [Currency, Currency];
      const stale = await fxCache.get(from, to, CACHE_FIRST_READ_FRESHNESS_MS);
      if (stale) rates.push(stale);
    }
  }

  return rates;
};

export type PortfolioValuationQuery = UseQueryResult<PortfolioValuation | null, Error> & {
  /** Force live adapter fetch (pull-to-refresh). */
  refreshValuation: () => Promise<void>;
};

export const usePortfolioValuation = (
  portfolioId: string | undefined,
  reportingCurrency: Currency
): PortfolioValuationQuery => {
  const { holdings, data: transactions } = usePortfolioHoldings(portfolioId);
  const forceNetworkRef = useRef(false);
  const queryStaleTime = valuationQueryStaleTimeMs();

  const txFingerprint = useMemo(
    () => (transactions ? `${transactions.length}:${transactions.at(-1)?.id ?? ""}` : "0"),
    [transactions]
  );

  const query = useQuery({
    queryKey: ["portfolioValuation", portfolioId, reportingCurrency, txFingerprint],
    enabled: !!portfolioId && holdings.length > 0,
    staleTime: queryStaleTime,
    gcTime: Number.isFinite(queryStaleTime) ? queryStaleTime * 2 : 24 * 60 * 60_000,
    placeholderData: (previous) => previous,
    queryFn: async (): Promise<PortfolioValuation | null> => {
      if (!portfolioId || holdings.length === 0) return null;

      const forceNetwork = forceNetworkRef.current;
      forceNetworkRef.current = false;

      const quotes = await fetchAllQuotes(holdings, forceNetwork);

      const pairs = new Set<string>();
      for (const h of holdings) {
        if (h.currency !== reportingCurrency) {
          pairs.add(`${h.currency}->${reportingCurrency}`);
        }
      }

      const fxRates = await fetchFxRates(Array.from(pairs), forceNetwork);

      return computePortfolioValuation(portfolioId, holdings, quotes, fxRates, reportingCurrency);
    },
  });

  const refreshValuation = useCallback(async (): Promise<void> => {
    forceNetworkRef.current = true;
    await query.refetch();
  }, [query.refetch]);

  return { ...query, refreshValuation };
};
