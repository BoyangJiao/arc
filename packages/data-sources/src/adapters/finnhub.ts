/**
 * Finnhub adapter — US stock quotes (Stage 3 entry)
 *
 * Quote:  https://finnhub.io/api/v1/quote?symbol=AAPL&token=XXX
 * Search: https://finnhub.io/api/v1/search?q=apple&exchange=US&token=XXX
 *
 * Free tier: 60 calls/minute (vs Alpha Vantage 25/day).
 */

import Decimal from "decimal.js";

import type { PriceQuote } from "@arc/core";

import { NetworkError, NotFoundError, ParseError, RateLimitError } from "../errors";
import type { PriceAdapter, SymbolSearchResult } from "../interfaces";

const SOURCE = "finnhub";

interface FinnhubQuoteResponse {
  c?: number;
  d?: number | null;
  dp?: number | null;
  h?: number;
  l?: number;
  o?: number;
  pc?: number;
  t?: number;
}

interface FinnhubSearchRow {
  symbol?: string;
  displaySymbol?: string;
  description?: string;
  type?: string;
}

interface FinnhubSearchResponse {
  count?: number;
  result?: FinnhubSearchRow[];
}

export interface FinnhubAdapterConfig {
  apiKey: string;
  /** Override fetch — for tests. Defaults to global fetch. */
  fetcher?: typeof fetch;
}

const parseQuoteBody = (body: FinnhubQuoteResponse, symbol: string): PriceQuote => {
  const c = body.c;
  const t = body.t;

  if (c === 0 && t === 0) {
    throw new NotFoundError(SOURCE, symbol);
  }

  if (c == null || t == null || t === 0) {
    throw new ParseError(SOURCE, `missing fields for ${symbol}`);
  }

  let price: Decimal;
  try {
    price = new Decimal(c);
  } catch (cause) {
    throw new ParseError(SOURCE, `invalid price "${c}"`, cause);
  }

  let changePercent: Decimal | null = null;
  if (body.dp != null) {
    try {
      changePercent = new Decimal(body.dp);
    } catch {
      changePercent = null;
    }
  }

  return {
    assetId: `US:${symbol.toUpperCase()}`,
    price,
    currency: "USD",
    asOf: new Date(t * 1000).toISOString(),
    source: SOURCE,
    changePercent,
  };
};

interface FinnhubCandleResponse {
  s?: string;
  t?: number[];
  c?: number[];
}

export const createFinnhubAdapter = (config: FinnhubAdapterConfig): PriceAdapter => {
  const { apiKey, fetcher = fetch } = config;
  if (!apiKey) {
    throw new Error("Finnhub adapter requires apiKey");
  }

  const fetchJson = async <T>(url: URL): Promise<T> => {
    let res: Response;
    try {
      res = await fetcher(url.toString(), {
        headers: { Accept: "application/json" },
      });
    } catch (cause) {
      throw new NetworkError(SOURCE, cause);
    }

    if (!res.ok) {
      if (res.status === 429) {
        const retryAfter = res.headers.get("retry-after");
        const retryAfterMs = retryAfter ? Number.parseInt(retryAfter, 10) * 1000 : null;
        throw new RateLimitError(SOURCE, retryAfterMs);
      }
      if (res.status === 401 || res.status === 403) {
        throw new NetworkError(SOURCE, `HTTP ${res.status} unauthorized`);
      }
      throw new NetworkError(SOURCE, `HTTP ${res.status}`);
    }

    try {
      return (await res.json()) as T;
    } catch (cause) {
      throw new ParseError(SOURCE, "invalid JSON", cause);
    }
  };

  return {
    market: "US",
    source: SOURCE,

    async fetchLatest(symbol) {
      const url = new URL("https://finnhub.io/api/v1/quote");
      url.searchParams.set("symbol", symbol.toUpperCase());
      url.searchParams.set("token", apiKey);

      const body = await fetchJson<FinnhubQuoteResponse>(url);
      return parseQuoteBody(body, symbol);
    },

    async fetchHistorical(symbol, from, to) {
      const url = new URL("https://finnhub.io/api/v1/stock/candle");
      url.searchParams.set("symbol", symbol.toUpperCase());
      url.searchParams.set("resolution", "D");
      url.searchParams.set("from", String(Math.floor(from.getTime() / 1000)));
      url.searchParams.set("to", String(Math.floor(to.getTime() / 1000)));
      url.searchParams.set("token", apiKey);

      const body = await fetchJson<FinnhubCandleResponse>(url);
      if (body.s !== "ok" || !body.t?.length || !body.c?.length) {
        return [];
      }

      const quotes: PriceQuote[] = [];
      for (let i = 0; i < body.t.length; i++) {
        const close = body.c[i];
        const ts = body.t[i];
        if (close == null || ts == null) continue;
        try {
          quotes.push({
            assetId: `US:${symbol.toUpperCase()}`,
            price: new Decimal(close),
            currency: "USD",
            asOf: new Date(ts * 1000).toISOString(),
            source: SOURCE,
            changePercent: null,
          });
        } catch {
          // skip malformed row
        }
      }

      return quotes.sort((a, b) => a.asOf.localeCompare(b.asOf));
    },

    async searchSymbols(query) {
      const trimmed = query.trim();
      if (!trimmed) return [];

      const url = new URL("https://finnhub.io/api/v1/search");
      url.searchParams.set("q", trimmed);
      url.searchParams.set("exchange", "US");
      url.searchParams.set("token", apiKey);

      const body = await fetchJson<FinnhubSearchResponse>(url);
      const rows = body.result ?? [];
      const results: SymbolSearchResult[] = [];

      for (const row of rows) {
        const sym = row.symbol;
        const displaySymbol = row.displaySymbol ?? sym;
        const name = row.description;
        const type = row.type;

        if (!sym || !name) continue;
        if (type !== "Common Stock") continue;
        if (displaySymbol?.includes(".")) continue;

        results.push({
          assetId: `US:${sym.toUpperCase()}`,
          symbol: sym.toUpperCase(),
          name,
          market: "US",
          currency: "USD",
        });

        if (results.length >= 8) break;
      }

      return results;
    },
  };
};
