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
import type { PriceAdapter } from "../interfaces";

const SOURCE = "alphavantage";
const ENDPOINT = "https://www.alphavantage.co/query";

interface GlobalQuoteResponse {
  "Global Quote"?: Record<string, string>;
  Note?: string;
  Information?: string;
  "Error Message"?: string;
}

export interface AlphaVantageAdapterConfig {
  apiKey: string;
  /** Override fetch — for tests. Defaults to global fetch. */
  fetcher?: typeof fetch;
}

export const createAlphaVantageAdapter = (config: AlphaVantageAdapterConfig): PriceAdapter => {
  const { apiKey, fetcher = fetch } = config;
  if (!apiKey) {
    throw new Error("Alpha Vantage adapter requires apiKey");
  }

  return {
    market: "US",
    source: SOURCE,

    async fetchLatest(symbol) {
      const url = new URL(ENDPOINT);
      url.searchParams.set("function", "GLOBAL_QUOTE");
      url.searchParams.set("symbol", symbol);
      url.searchParams.set("apikey", apiKey);

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
          // Alpha Vantage almost never returns real 429; this branch is defensive.
          const retryAfter = res.headers.get("retry-after");
          const retryAfterMs = retryAfter ? Number.parseInt(retryAfter, 10) * 1000 : null;
          throw new RateLimitError(SOURCE, retryAfterMs);
        }
        throw new NetworkError(SOURCE, `HTTP ${res.status}`);
      }

      let body: GlobalQuoteResponse;
      try {
        body = (await res.json()) as GlobalQuoteResponse;
      } catch (cause) {
        throw new ParseError(SOURCE, "invalid JSON", cause);
      }

      // Rate limit signal disguised as success — see header comment
      if (body.Note || body.Information) {
        const msg = body.Note ?? body.Information ?? "rate limited";
        if (/(call frequency|rate limit|premium)/i.test(msg)) {
          throw new RateLimitError(SOURCE, null, msg);
        }
      }

      if (body["Error Message"]) {
        throw new NotFoundError(SOURCE, symbol);
      }

      const quote = body["Global Quote"];
      if (!quote || Object.keys(quote).length === 0) {
        // Common case for invalid symbols — Alpha Vantage just returns `{}`
        throw new NotFoundError(SOURCE, symbol);
      }

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

      // tradingDay is like "2026-05-13" — interpret as US market close (NYSE: 16:00 ET).
      // We use UTC midnight of that day as a stable comparable timestamp.
      // Stage 3 may upgrade to actual close timestamp via NYSE calendar.
      const asOf = `${tradingDay}T20:00:00Z`; // 16:00 EST ≈ 20:00 UTC (winter); good enough for Stage 1

      const result: PriceQuote = {
        assetId: `US:${symbol.toUpperCase()}`,
        price,
        currency: "USD",
        asOf,
        source: SOURCE,
      };
      return result;
    },
  };
};
