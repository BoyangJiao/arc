/**
 * Watchlist quote fetch — PriceQuote + change% with 5-minute cache TTL.
 */

import Decimal from "decimal.js";
import type { PriceQuote } from "@arc/core";

import { fetchPriceWithCache } from "./fetch-with-cache";
import type { PriceAdapter, PriceCache } from "./interfaces";

export const WATCHLIST_QUOTE_FRESHNESS_MS = 5 * 60 * 1000;

export interface WatchlistQuoteFields {
  readonly price: Decimal;
  readonly currency: PriceQuote["currency"];
  readonly changePercent: Decimal | null;
  readonly asOf: string;
  readonly stale: boolean;
}

export interface FetchWatchlistQuoteParams {
  readonly adapter: PriceAdapter;
  readonly symbol: string;
  readonly cache?: PriceCache;
  readonly freshnessMs?: number;
  /** Optional — when adapter is Alpha Vantage enriched fetch. */
  readonly fetchWithChange?: (symbol: string) => Promise<{
    quote: PriceQuote;
    changePercent: Decimal | null;
  }>;
}

const isStale = (asOf: string, freshnessMs: number): boolean => {
  const ageMs = Date.now() - Date.parse(asOf);
  return Number.isFinite(ageMs) && ageMs > freshnessMs;
};

export const fetchWatchlistQuoteWithCache = async (
  params: FetchWatchlistQuoteParams
): Promise<WatchlistQuoteFields> => {
  const { adapter, symbol, cache, freshnessMs = WATCHLIST_QUOTE_FRESHNESS_MS } = params;
  const forceNetwork = freshnessMs === 0;

  if (!forceNetwork && cache) {
    const hit = await cache.get(`${adapter.market}:${symbol.toUpperCase()}`, freshnessMs);
    if (hit) {
      return {
        price: hit.price,
        currency: hit.currency,
        changePercent: null,
        asOf: hit.asOf,
        stale: isStale(hit.asOf, WATCHLIST_QUOTE_FRESHNESS_MS),
      };
    }
  }

  if (params.fetchWithChange) {
    const { quote, changePercent } = await params.fetchWithChange(symbol);
    if (cache) {
      void cache.set(quote);
    }
    return {
      price: quote.price,
      currency: quote.currency,
      changePercent,
      asOf: quote.asOf,
      stale: isStale(quote.asOf, WATCHLIST_QUOTE_FRESHNESS_MS),
    };
  }

  const quote = await fetchPriceWithCache({
    adapter,
    symbol,
    cache,
    freshnessMs: forceNetwork ? 0 : freshnessMs,
  });

  return {
    price: quote.price,
    currency: quote.currency,
    changePercent: null,
    asOf: quote.asOf,
    stale: isStale(quote.asOf, WATCHLIST_QUOTE_FRESHNESS_MS),
  };
};
