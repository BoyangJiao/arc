/**
 * Arc CRYPTO ticker ↔ CoinGecko coin_id mapping.
 *
 * Bundled top-200 JSON covers common tickers; live /search fallback for the rest.
 */

import { NotFoundError } from "../../errors";
import { COINGECKO_SOURCE } from "./client";

/** Uppercase ticker → CoinGecko coin_id (e.g. BTC → bitcoin) */
export type CoingeckoBundledCoins = Readonly<Record<string, string>>;

export interface CoingeckoSearchCoin {
  readonly id: string;
  readonly symbol: string;
  readonly name: string;
  readonly market_cap_rank: number | null;
}

export type LiveSearchFallback = (query: string) => Promise<ReadonlyArray<CoingeckoSearchCoin>>;

export interface BundledCoinMatch {
  readonly ticker: string;
  readonly coinId: string;
}

const pickBestSymbolMatch = (
  ticker: string,
  coins: ReadonlyArray<CoingeckoSearchCoin>
): CoingeckoSearchCoin | null => {
  const upper = ticker.toUpperCase();
  const matches = coins.filter((c) => c.symbol.toUpperCase() === upper);
  if (matches.length === 0) return null;

  return [...matches].sort((a, b) => {
    const ra = a.market_cap_rank ?? Number.MAX_SAFE_INTEGER;
    const rb = b.market_cap_rank ?? Number.MAX_SAFE_INTEGER;
    return ra - rb;
  })[0]!;
};

/** Substring match against bundled tickers and coin_ids (zero HTTP — for searchSymbols). */
export const matchBundledCoins = (
  query: string,
  bundled: CoingeckoBundledCoins
): ReadonlyArray<BundledCoinMatch> => {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const matches: BundledCoinMatch[] = [];
  for (const [ticker, coinId] of Object.entries(bundled)) {
    if (ticker.toLowerCase().includes(q) || coinId.toLowerCase().includes(q)) {
      matches.push({ ticker, coinId });
    }
  }

  return matches;
};

export const tickerToCoinId = async (
  ticker: string,
  bundled: CoingeckoBundledCoins,
  liveSearchFallback?: LiveSearchFallback
): Promise<string> => {
  const upper = ticker.toUpperCase();
  const fromBundled = bundled[upper];
  if (fromBundled) return fromBundled;

  if (!liveSearchFallback) {
    throw new NotFoundError(COINGECKO_SOURCE, upper);
  }

  const results = await liveSearchFallback(upper);
  const best = pickBestSymbolMatch(upper, results);
  if (!best) {
    throw new NotFoundError(COINGECKO_SOURCE, upper);
  }

  return best.id;
};
