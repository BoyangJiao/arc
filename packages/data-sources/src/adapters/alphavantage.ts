/**
 * Alpha Vantage adapter — US stock quotes (Stage 1)
 *
 * Endpoint: https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=XXX
 *
 * Free tier: 25 requests/day + 5 requests/minute. We rely heavily on
 * cache (price_snapshots table) to stay under the limit.
 *
 * Response shape (success):
 * {
 *   "Global Quote": {
 *     "01. symbol": "AAPL",
 *     "02. open": "180.00",
 *     "05. price": "180.50",
 *     "07. latest trading day": "2026-05-13",
 *     "10. change percent": "0.28%",
 *     ...
 *   }
 * }
 *
 * Response shape (rate-limited): plain JSON with `Note` or `Information` field
 * containing rate limit messages — NOT an HTTP 429. We must inspect body.
 *
 * Response shape (invalid symbol): `{ "Global Quote": {} }` — empty object,
 * not an error. We map empty → NotFoundError.
 */

import Decimal from "decimal.js";

import type { PriceQuote } from "@arc/core";

import { NetworkError, NotFoundError, ParseError, RateLimitError } from "../errors";
import type { PriceAdapter, SymbolSearchResult } from "../interfaces";

const SOURCE = "alphavantage";
const ENDPOINT = "https://www.alphavantage.co/query";

interface GlobalQuoteResponse {
  "Global Quote"?: Record<string, string>;
  Note?: string;
  Information?: string;
  "Error Message"?: string;
}

interface SymbolSearchResponse {
  bestMatches?: Array<Record<string, string>>;
  Note?: string;
  Information?: string;
  "Error Message"?: string;
}

const parseChangePercent = (raw: string | undefined): Decimal | null => {
  if (!raw) return null;
  const cleaned = raw.replace(/%/g, "").trim();
  if (!cleaned) return null;
  try {
    return new Decimal(cleaned);
  } catch {
    return null;
  }
};

const inspectRateLimitBody = (body: { Note?: string; Information?: string }): void => {
  if (body.Note || body.Information) {
    const msg = body.Note ?? body.Information ?? "rate limited";
    if (/(call frequency|rate limit|premium)/i.test(msg)) {
      throw new RateLimitError(SOURCE, null, msg);
    }
  }
};

export interface AlphaVantageAdapterConfig {
  apiKey: string;
  /** Override fetch — for tests. Defaults to global fetch. */
  fetcher?: typeof fetch;
}

/** Parsed GLOBAL_QUOTE fields used by fetchLatest and watchlist quote enrichment. */
export const parseGlobalQuote = (quote: Record<string, string>, symbol: string): PriceQuote => {
  const priceStr = quote["05. price"];
  const tradingDay = quote["07. latest trading day"];

  if (!priceStr || !tradingDay) {
    throw new ParseError(SOURCE, `missing fields for ${symbol}`);
  }

  let price: Decimal;
  try {
    price = new Decimal(priceStr);
  } catch (cause) {
    throw new ParseError(SOURCE, `invalid price "${priceStr}"`, cause);
  }

  const asOf = `${tradingDay}T20:00:00Z`;

  return {
    assetId: `US:${symbol.toUpperCase()}`,
    price,
    currency: "USD",
    asOf,
    source: SOURCE,
    changePercent: parseChangePercent(quote["10. change percent"]),
  };
};

export const createAlphaVantageAdapter = (config: AlphaVantageAdapterConfig): PriceAdapter => {
  const { apiKey, fetcher = fetch } = config;
  if (!apiKey) {
    throw new Error("Alpha Vantage adapter requires apiKey");
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
      const url = new URL(ENDPOINT);
      url.searchParams.set("function", "GLOBAL_QUOTE");
      url.searchParams.set("symbol", symbol);
      url.searchParams.set("apikey", apiKey);

      const body = await fetchJson<GlobalQuoteResponse>(url);

      inspectRateLimitBody(body);

      if (body["Error Message"]) {
        throw new NotFoundError(SOURCE, symbol);
      }

      const quote = body["Global Quote"];
      if (!quote || Object.keys(quote).length === 0) {
        throw new NotFoundError(SOURCE, symbol);
      }

      return parseGlobalQuote(quote, symbol);
    },

    async searchSymbols(query) {
      const trimmed = query.trim();
      if (!trimmed) return [];

      const url = new URL(ENDPOINT);
      url.searchParams.set("function", "SYMBOL_SEARCH");
      url.searchParams.set("keywords", trimmed);
      url.searchParams.set("apikey", apiKey);

      const body = await fetchJson<SymbolSearchResponse>(url);

      inspectRateLimitBody(body);

      if (body["Error Message"]) {
        throw new ParseError(SOURCE, body["Error Message"]);
      }

      const matches = body.bestMatches ?? [];
      const results: SymbolSearchResult[] = [];

      for (const row of matches) {
        const sym = row["1. symbol"];
        const name = row["2. name"];
        const region = row["4. region"];
        const type = row["3. type"];
        const currency = row["8. currency"] as SymbolSearchResult["currency"] | undefined;

        if (!sym || !name) continue;
        if (region && region !== "United States") continue;
        if (type && !/equity|etf/i.test(type)) continue;

        results.push({
          assetId: `US:${sym.toUpperCase()}`,
          symbol: sym.toUpperCase(),
          name,
          market: "US",
          currency: currency === "USD" ? "USD" : "USD",
        });
      }

      return results;
    },
  };
};

/** Re-fetch GLOBAL_QUOTE and return change% alongside PriceQuote (watchlist rows). */
export const fetchAlphaVantageQuoteWithChange = async (
  config: AlphaVantageAdapterConfig,
  symbol: string
): Promise<{ quote: PriceQuote; changePercent: Decimal | null }> => {
  const url = new URL(ENDPOINT);
  url.searchParams.set("function", "GLOBAL_QUOTE");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("apikey", config.apiKey);

  const fetcher = config.fetcher ?? fetch;
  let res: Response;
  try {
    res = await fetcher(url.toString(), { headers: { Accept: "application/json" } });
  } catch (cause) {
    throw new NetworkError(SOURCE, cause);
  }

  if (!res.ok) {
    if (res.status === 429) {
      const retryAfter = res.headers.get("retry-after");
      const retryAfterMs = retryAfter ? Number.parseInt(retryAfter, 10) * 1000 : null;
      throw new RateLimitError(SOURCE, retryAfterMs);
    }
    throw new NetworkError(SOURCE, `HTTP ${res.status}`);
  }

  const body = (await res.json()) as GlobalQuoteResponse;
  inspectRateLimitBody(body);

  if (body["Error Message"]) {
    throw new NotFoundError(SOURCE, symbol);
  }

  const quote = body["Global Quote"];
  if (!quote || Object.keys(quote).length === 0) {
    throw new NotFoundError(SOURCE, symbol);
  }

  const q = parseGlobalQuote(quote, symbol);
  return { quote: q, changePercent: q.changePercent ?? null };
};
