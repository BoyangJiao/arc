/**
 * CoinGecko shared HTTP client — GET JSON from api.coingecko.com/api/v3
 *
 * Free tier: 10-30 req/min, no API key required (Stage 3).
 * Stage 4: optional demo key via x-cg-demo-api-key header.
 */

import { NetworkError, NotFoundError, ParseError, RateLimitError } from "../../errors";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
export const COINGECKO_SOURCE = "coingecko";

export interface CoingeckoClient {
  getJson<T>(path: string, params?: Record<string, string>): Promise<T>;
}

export interface CoingeckoClientConfig {
  /** Override fetch — for tests. Defaults to global fetch. */
  fetcher?: typeof fetch;
  /** Optional demo API key (Stage 4) — sent as x-cg-demo-api-key header */
  apiKey?: string;
}

export const createCoingeckoClient = (config: CoingeckoClientConfig = {}): CoingeckoClient => {
  const { fetcher = fetch, apiKey } = config;

  return {
    async getJson<T>(path: string, params?: Record<string, string>): Promise<T> {
      const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
      const url = new URL(`${COINGECKO_BASE}/${normalizedPath}`);

      if (params) {
        for (const [key, value] of Object.entries(params)) {
          url.searchParams.set(key, value);
        }
      }

      const headers: Record<string, string> = { Accept: "application/json" };
      if (apiKey) {
        headers["x-cg-demo-api-key"] = apiKey;
      }

      let res: Response;
      try {
        res = await fetcher(url.toString(), { headers });
      } catch (cause) {
        throw new NetworkError(COINGECKO_SOURCE, cause);
      }

      if (!res.ok) {
        if (res.status === 429) {
          const retryAfter = res.headers.get("retry-after");
          const retryAfterMs = retryAfter ? Number.parseInt(retryAfter, 10) * 1000 : null;
          throw new RateLimitError(COINGECKO_SOURCE, retryAfterMs);
        }
        if (res.status === 404) {
          throw new NotFoundError(COINGECKO_SOURCE, normalizedPath);
        }
        if (res.status === 401 || res.status === 403) {
          throw new NetworkError(COINGECKO_SOURCE, `HTTP ${res.status} unauthorized`);
        }
        throw new NetworkError(COINGECKO_SOURCE, `HTTP ${res.status}`);
      }

      try {
        return (await res.json()) as T;
      } catch (cause) {
        throw new ParseError(COINGECKO_SOURCE, "invalid JSON", cause);
      }
    },
  };
};
