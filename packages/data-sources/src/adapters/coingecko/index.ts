/**
 * CoinGecko adapter — CRYPTO spot quotes (Stage 3 Block A 漏单收口)
 *
 * Quote:     /simple/price?ids={coin_id}&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true
 * History:   /coins/{id}/market_chart?vs_currency=usd&days=N
 * Search:    /search?query=...
 */

import Decimal from "decimal.js";

import type { PriceQuote } from "@arc/core";

import { NotFoundError, ParseError } from "../../errors";
import type { PriceAdapter, SymbolSearchResult } from "../../interfaces";
import defaultBundled from "../../static/coingecko-coins-top200.json";
import { COINGECKO_SOURCE, createCoingeckoClient } from "./client";
import {
  matchBundledCoins,
  tickerToCoinId,
  type CoingeckoBundledCoins,
  type CoingeckoSearchCoin,
} from "./coin-id-resolver";

const SOURCE = COINGECKO_SOURCE;

interface SimplePriceEntry {
  usd?: number;
  usd_24h_change?: number;
  last_updated_at?: number;
}

type SimplePriceResponse = Record<string, SimplePriceEntry | undefined>;

interface CoingeckoSearchResponse {
  coins?: ReadonlyArray<{
    id: string;
    symbol: string;
    name: string;
    market_cap_rank?: number | null;
  }>;
}

interface MarketChartResponse {
  prices?: ReadonlyArray<readonly [number, number]>;
}

export interface CoingeckoAdapterConfig {
  fetcher?: typeof fetch;
  /** Optional demo API key (Stage 4) */
  apiKey?: string;
  /** Override bundled ticker map — for tests */
  bundled?: CoingeckoBundledCoins;
}

const formatCoinName = (coinId: string): string =>
  coinId
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const daysBetweenInclusive = (from: Date, to: Date): number => {
  const msPerDay = 86_400_000;
  const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.max(Math.round((toUtc - fromUtc) / msPerDay), 1);
};

const parseSimplePrice = (
  body: SimplePriceResponse,
  coinId: string,
  symbol: string
): PriceQuote => {
  const entry = body[coinId];
  if (!entry || entry.usd == null) {
    throw new NotFoundError(SOURCE, symbol);
  }

  let price: Decimal;
  try {
    price = new Decimal(entry.usd);
  } catch (cause) {
    throw new ParseError(SOURCE, `invalid price "${entry.usd}"`, cause);
  }

  let changePercent: Decimal | null = null;
  if (entry.usd_24h_change != null) {
    try {
      changePercent = new Decimal(entry.usd_24h_change);
    } catch {
      changePercent = null;
    }
  }

  const asOf =
    entry.last_updated_at != null && entry.last_updated_at > 0
      ? new Date(entry.last_updated_at * 1000).toISOString()
      : new Date().toISOString();

  return {
    assetId: `CRYPTO:${symbol.toUpperCase()}`,
    price,
    currency: "USD",
    asOf,
    source: SOURCE,
    changePercent,
  };
};

const mapSearchCoins = (
  coins: ReadonlyArray<CoingeckoSearchCoin>
): ReadonlyArray<SymbolSearchResult> =>
  coins.map((coin) => ({
    assetId: `CRYPTO:${coin.symbol.toUpperCase()}`,
    symbol: coin.symbol.toUpperCase(),
    name: coin.name,
    market: "CRYPTO",
    currency: "USD",
  }));

export const createCoingeckoAdapter = (config: CoingeckoAdapterConfig = {}): PriceAdapter => {
  const { fetcher, apiKey, bundled = defaultBundled as CoingeckoBundledCoins } = config;
  const client = createCoingeckoClient({ fetcher, apiKey });

  const liveSearch = async (query: string): Promise<ReadonlyArray<CoingeckoSearchCoin>> => {
    const body = await client.getJson<CoingeckoSearchResponse>("search", { query });
    return (body.coins ?? []).map((coin) => ({
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      market_cap_rank: coin.market_cap_rank ?? null,
    }));
  };

  const resolveCoinId = (symbol: string) => tickerToCoinId(symbol, bundled, liveSearch);

  return {
    market: "CRYPTO",
    source: SOURCE,

    async fetchLatest(symbol) {
      const upper = symbol.toUpperCase();
      const coinId = await resolveCoinId(upper);
      const body = await client.getJson<SimplePriceResponse>("simple/price", {
        ids: coinId,
        vs_currencies: "usd",
        include_24hr_change: "true",
        include_last_updated_at: "true",
      });
      return parseSimplePrice(body, coinId, upper);
    },

    async fetchHistorical(symbol, from, to) {
      const upper = symbol.toUpperCase();
      const coinId = await resolveCoinId(upper);
      const days = daysBetweenInclusive(from, to);

      const body = await client.getJson<MarketChartResponse>(`coins/${coinId}/market_chart`, {
        vs_currency: "usd",
        days: String(days),
      });

      const rows = body.prices ?? [];
      const quotes: PriceQuote[] = [];

      for (const [tsMs, priceRaw] of rows) {
        let price: Decimal;
        try {
          price = new Decimal(priceRaw);
        } catch (cause) {
          throw new ParseError(SOURCE, `invalid historical price "${priceRaw}"`, cause);
        }

        quotes.push({
          assetId: `CRYPTO:${upper}`,
          price,
          currency: "USD",
          asOf: new Date(tsMs).toISOString(),
          source: SOURCE,
          changePercent: null,
        });
      }

      // No client-side window filter: market_chart?days=N already does API-side windowing
      // (Block C UAT fix 2026-05-24 — filter was incompatible with mock timestamps).
      return quotes.sort((a, b) => a.asOf.localeCompare(b.asOf));
    },

    async searchSymbols(query) {
      const trimmed = query.trim();
      if (!trimmed) return [];

      const bundledMatches = matchBundledCoins(trimmed, bundled);
      if (bundledMatches.length >= 3) {
        return bundledMatches.slice(0, 8).map(({ ticker, coinId }) => ({
          assetId: `CRYPTO:${ticker}`,
          symbol: ticker,
          name: formatCoinName(coinId),
          market: "CRYPTO",
          currency: "USD",
        }));
      }

      const coins = await liveSearch(trimmed);
      const filtered = coins
        .filter((coin) => (coin.market_cap_rank ?? Number.MAX_SAFE_INTEGER) <= 500)
        .slice(0, 8);

      return mapSearchCoins(filtered);
    },
  };
};
