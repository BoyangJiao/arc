/**
 * CoinGecko shared client — GET contract + error mapping (mocked fetcher)
 */

import { describe, expect, test, vi } from "vitest";

import { COINGECKO_SOURCE, createCoingeckoClient } from "../src/adapters/coingecko/client";
import { NetworkError, NotFoundError, ParseError, RateLimitError } from "../src/errors";

const mockFetch = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
  jsonError = false
) =>
  vi.fn((_url: string, _init?: RequestInit) =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
      json: () =>
        jsonError ? Promise.reject(new SyntaxError("invalid JSON")) : Promise.resolve(body),
    } as unknown as Response)
  );

describe("CoinGecko client", () => {
  test("getJson happy path — URL, query params, Accept header", async () => {
    const fetcher = mockFetch({ bitcoin: { usd: 67234.5 } });
    const client = createCoingeckoClient({ fetcher });

    const body = await client.getJson<Record<string, unknown>>("simple/price", {
      ids: "bitcoin",
      vs_currencies: "usd",
    });

    expect(body).toEqual({ bitcoin: { usd: 67234.5 } });
    expect(fetcher).toHaveBeenCalledOnce();

    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd");
    expect((init?.headers as Record<string, string>).Accept).toBe("application/json");
    expect((init?.headers as Record<string, string>)["x-cg-demo-api-key"]).toBeUndefined();
  });

  test("apiKey sends x-cg-demo-api-key header", async () => {
    const fetcher = mockFetch({});
    const client = createCoingeckoClient({ fetcher, apiKey: "demo-key-123" });

    await client.getJson("coins/list");

    const [, init] = fetcher.mock.calls[0]!;
    expect((init?.headers as Record<string, string>)["x-cg-demo-api-key"]).toBe("demo-key-123");
  });

  test("leading slash on path is normalized", async () => {
    const fetcher = mockFetch({});
    const client = createCoingeckoClient({ fetcher });

    await client.getJson("/search", { query: "btc" });

    const [url] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://api.coingecko.com/api/v3/search?query=btc");
  });

  test("fetch throw → NetworkError", async () => {
    const fetcher = vi.fn(() => Promise.reject(new TypeError("network down")));
    const client = createCoingeckoClient({ fetcher });

    try {
      await client.getJson("simple/price");
      expect.fail("should throw");
    } catch (err) {
      expect(err).toBeInstanceOf(NetworkError);
      expect((err as NetworkError).source).toBe(COINGECKO_SOURCE);
    }
  });

  test("HTTP 429 + Retry-After → RateLimitError with retryAfterMs", async () => {
    const fetcher = mockFetch({}, 429, { "retry-after": "60" });
    const client = createCoingeckoClient({ fetcher });

    try {
      await client.getJson("simple/price");
      expect.fail("should throw");
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      const e = err as RateLimitError;
      expect(e.source).toBe(COINGECKO_SOURCE);
      expect(e.retryAfterMs).toBe(60_000);
    }
  });

  test("HTTP 429 without Retry-After → RateLimitError with null retryAfterMs", async () => {
    const fetcher = mockFetch({}, 429);
    const client = createCoingeckoClient({ fetcher });

    try {
      await client.getJson("simple/price");
      expect.fail("should throw");
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).retryAfterMs).toBeNull();
    }
  });

  test("HTTP 404 → NotFoundError", async () => {
    const fetcher = mockFetch({}, 404);
    const client = createCoingeckoClient({ fetcher });

    try {
      await client.getJson("coins/unknown-coin");
      expect.fail("should throw");
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundError);
      expect((err as NotFoundError).source).toBe(COINGECKO_SOURCE);
    }
  });

  test("HTTP 401 → NetworkError", async () => {
    const fetcher = mockFetch({}, 401);
    const client = createCoingeckoClient({ fetcher });

    await expect(client.getJson("simple/price")).rejects.toBeInstanceOf(NetworkError);
  });

  test("HTTP 403 → NetworkError", async () => {
    const fetcher = mockFetch({}, 403);
    const client = createCoingeckoClient({ fetcher });

    await expect(client.getJson("simple/price")).rejects.toBeInstanceOf(NetworkError);
  });

  test("HTTP 500 → NetworkError", async () => {
    const fetcher = mockFetch({}, 500);
    const client = createCoingeckoClient({ fetcher });

    try {
      await client.getJson("simple/price");
      expect.fail("should throw");
    } catch (err) {
      expect(err).toBeInstanceOf(NetworkError);
      expect((err as NetworkError).source).toBe(COINGECKO_SOURCE);
    }
  });

  test("JSON parse fail → ParseError", async () => {
    const fetcher = mockFetch(null, 200, {}, true);
    const client = createCoingeckoClient({ fetcher });

    await expect(client.getJson("simple/price")).rejects.toBeInstanceOf(ParseError);
  });
});
