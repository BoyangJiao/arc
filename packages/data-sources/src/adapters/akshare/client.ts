/**
 * AKShare HTTP wrapper client — GET JSON aligned with Arc PriceQuote shape.
 */

import Decimal from "decimal.js";

import type { Currency, Market, PriceQuote } from "@arc/core";

import { NetworkError, NotFoundError, ParseError, QuotaError, RateLimitError } from "../../errors";
import type { SymbolSearchResult } from "../../interfaces";

/** US = dev-only fallback while Tushare us_daily is not entitled (ADR 011; removed pre-launch). */
export type AkshareMarket = "CN" | "HK" | "FUND" | "US";

export interface AkshareClient {
  fetchLatest(market: AkshareMarket, symbol: string): Promise<PriceQuote>;
  fetchHistorical(
    market: AkshareMarket,
    symbol: string,
    from: Date,
    to: Date
  ): Promise<ReadonlyArray<PriceQuote>>;
  searchSymbols(market: AkshareMarket, query: string): Promise<ReadonlyArray<SymbolSearchResult>>;
}

export interface AkshareClientConfig {
  baseUrl: string;
  token: string;
  fetcher?: typeof fetch;
}

interface AkshareQuoteJson {
  assetId?: string;
  price?: string | number;
  currency?: string;
  asOf?: string;
  source?: string;
  changePercent?: string | number | null;
}

interface AkshareErrorJson {
  code?: string;
  message?: string;
}

interface AkshareSearchJson {
  assetId?: string;
  symbol?: string;
  name?: string;
  market?: string;
  currency?: string;
}

const parseQuoteJson = (
  body: AkshareQuoteJson,
  market: AkshareMarket,
  symbol: string
): PriceQuote => {
  const assetId = body.assetId ?? `${market}:${symbol}`;
  if (body.price == null || body.asOf == null || !body.currency) {
    throw new ParseError(`akshare-${market.toLowerCase()}`, `missing quote fields for ${symbol}`);
  }

  let price: Decimal;
  try {
    price = new Decimal(String(body.price));
  } catch (cause) {
    throw new ParseError(`akshare-${market.toLowerCase()}`, `invalid price`, cause);
  }

  let changePercent: Decimal | null = null;
  if (body.changePercent != null && body.changePercent !== "") {
    try {
      changePercent = new Decimal(String(body.changePercent));
    } catch {
      changePercent = null;
    }
  }

  return {
    assetId,
    price,
    currency: body.currency as PriceQuote["currency"],
    asOf: body.asOf,
    source: body.source ?? `akshare-${market.toLowerCase()}`,
    changePercent,
  };
};

const mapHttpError = async (res: Response, source: string): Promise<never> => {
  let body: AkshareErrorJson = {};
  try {
    body = (await res.json()) as AkshareErrorJson;
  } catch {
    /* ignore */
  }

  if (res.status === 404) {
    throw new NotFoundError(source, body.message ?? "symbol");
  }

  if (res.status === 429 && body.code === "quota") {
    throw new QuotaError(source, "quota", body.message ?? "quota exceeded");
  }

  if (res.status === 429 || res.status === 503) {
    const retryAfter = res.headers.get("retry-after");
    const retryAfterMs = retryAfter ? Number.parseInt(retryAfter, 10) * 1000 : null;
    throw new RateLimitError(source, retryAfterMs);
  }

  if (res.status === 401 || res.status === 403) {
    throw new NetworkError(source, `HTTP ${res.status} unauthorized`);
  }

  throw new NetworkError(source, `HTTP ${res.status}: ${body.message ?? ""}`);
};

export const createAkshareClient = (config: AkshareClientConfig): AkshareClient => {
  const { baseUrl, token, fetcher = fetch } = config;
  const base = baseUrl.replace(/\/$/, "");

  if (!baseUrl || !token) {
    throw new Error("Akshare client requires baseUrl and token");
  }

  const request = async <T>(path: string, query: Record<string, string>): Promise<T> => {
    const url = new URL(`${base}${path}`);
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, v);
    }

    let res: Response;
    try {
      res = await fetcher(url.toString(), {
        headers: {
          Accept: "application/json",
          "X-Arc-Token": token,
        },
      });
    } catch (cause) {
      throw new NetworkError("akshare", cause);
    }

    if (!res.ok) {
      await mapHttpError(res, "akshare");
    }

    try {
      return (await res.json()) as T;
    } catch (cause) {
      throw new ParseError("akshare", "invalid JSON", cause);
    }
  };

  return {
    async fetchLatest(market, symbol) {
      const body = await request<AkshareQuoteJson>("/api/quote", {
        market,
        symbol,
      });
      return parseQuoteJson(body, market, symbol);
    },

    async fetchHistorical(market, symbol, from, to) {
      const body = await request<AkshareQuoteJson[]>("/api/historical", {
        market,
        symbol,
        from: from.toISOString(),
        to: to.toISOString(),
      });
      if (!Array.isArray(body)) {
        throw new ParseError(`akshare-${market.toLowerCase()}`, "historical response not array");
      }
      return body
        .map((row) => parseQuoteJson(row, market, symbol))
        .sort((a, b) => a.asOf.localeCompare(b.asOf));
    },

    async searchSymbols(market, query) {
      const body = await request<AkshareSearchJson[]>("/api/search", { market, q: query });
      if (!Array.isArray(body)) {
        throw new ParseError(`akshare-${market.toLowerCase()}`, "search response not array");
      }
      return body.slice(0, 8).map((row) => ({
        assetId: row.assetId ?? `${market}:${row.symbol ?? ""}`,
        symbol: String(row.symbol ?? ""),
        name: String(row.name ?? row.symbol ?? ""),
        market: (row.market ?? market) as Market,
        currency: (row.currency ?? "CNY") as Currency,
      }));
    },
  };
};
