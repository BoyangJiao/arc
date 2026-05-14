/**
 * Frankfurter adapter — FX rates (Stage 1)
 *
 * https://api.frankfurter.app — free, no API key, ECB rates updated daily ~16:00 CET.
 *
 * Why Frankfurter over exchangerate.host:
 *   - Frankfurter is fully free + no signup
 *   - exchangerate.host now requires a free API key (post-2024 policy change)
 *   - For Stage 1's CNY/USD/HKD/JPY needs, ECB's daily rates are sufficient
 *   - Stage 3 can add a paid realtime FX adapter if needed
 *
 * Endpoint: https://api.frankfurter.app/latest?base=USD&symbols=CNY
 *
 * Response shape:
 * {
 *   "amount": 1.0,
 *   "base": "USD",
 *   "date": "2026-05-13",
 *   "rates": { "CNY": 7.2 }
 * }
 *
 * Caveats:
 *   - Doesn't support crypto (BTC/ETH); Stage 3 will route those through CoinGecko
 *   - Same-currency requests (USD→USD) are guarded client-side (rate=1)
 */

import Decimal from "decimal.js";

import type { Currency, FxRate } from "@arc/core";

import { NetworkError, NotFoundError, ParseError, RateLimitError } from "../errors";
import type { FxAdapter } from "../interfaces";

const SOURCE = "frankfurter";
const ENDPOINT = "https://api.frankfurter.app";

/** Fiat currencies Frankfurter supports (subset relevant to Arc). */
const FRANKFURTER_FIAT: ReadonlySet<Currency> = new Set<Currency>(["CNY", "HKD", "USD", "JPY"]);

interface FrankfurterResponse {
  amount?: number;
  base?: string;
  date?: string;
  rates?: Record<string, number>;
}

export interface FrankfurterAdapterConfig {
  /** Override fetch — for tests. Defaults to global fetch. */
  fetcher?: typeof fetch;
}

const guardSupported = (cur: Currency) => {
  if (!FRANKFURTER_FIAT.has(cur)) {
    throw new NotFoundError(SOURCE, cur);
  }
};

export const createFrankfurterAdapter = (config: FrankfurterAdapterConfig = {}): FxAdapter => {
  const { fetcher = fetch } = config;

  const fetchAt = async (
    pathDate: "latest" | string,
    from: Currency,
    to: Currency
  ): Promise<FxRate> => {
    guardSupported(from);
    guardSupported(to);

    if (from === to) {
      // Caller should short-circuit before calling adapter, but be defensive.
      return {
        from,
        to,
        rate: new Decimal(1),
        asOf: new Date().toISOString(),
        source: SOURCE,
      };
    }

    const url = new URL(`${ENDPOINT}/${pathDate}`);
    url.searchParams.set("base", from);
    url.searchParams.set("symbols", to);

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
      if (res.status === 404) {
        throw new NotFoundError(SOURCE, `${from}/${to} on ${pathDate}`);
      }
      throw new NetworkError(SOURCE, `HTTP ${res.status}`);
    }

    let body: FrankfurterResponse;
    try {
      body = (await res.json()) as FrankfurterResponse;
    } catch (cause) {
      throw new ParseError(SOURCE, "invalid JSON", cause);
    }

    const rateNum = body.rates?.[to];
    const date = body.date;

    if (rateNum === undefined || rateNum === null || !date) {
      throw new ParseError(SOURCE, `missing rate for ${from}->${to}`);
    }

    let rate: Decimal;
    try {
      // Frankfurter returns number; convert via String to avoid float→Decimal precision loss
      rate = new Decimal(rateNum.toString());
    } catch (cause) {
      throw new ParseError(SOURCE, `invalid rate "${rateNum}"`, cause);
    }

    return {
      from,
      to,
      rate,
      // ECB rates published at ~16:00 CET = 14:00-15:00 UTC depending on DST.
      // Stage 1 use UTC midnight of `date` for simplicity.
      asOf: `${date}T15:00:00Z`,
      source: SOURCE,
    };
  };

  return {
    source: SOURCE,
    fetchRate: (from, to) => fetchAt("latest", from, to),
    fetchHistoricalRate: (from, to, date) => {
      // Frankfurter expects YYYY-MM-DD path segment for historical
      const isoDate = date.toISOString().slice(0, 10);
      return fetchAt(isoDate, from, to);
    },
  };
};
