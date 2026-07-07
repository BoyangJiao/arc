/**
 * CoinGecko adapter tests — S3-AC-A2.1 ~ A2.8
 */

import { describe, expect, test, vi } from "vitest";
import Decimal from "decimal.js";

import { createCoingeckoAdapter } from "../src/adapters/coingecko";
import { NetworkError, NotFoundError, RateLimitError } from "../src/errors";

const TEST_BUNDLED = {
  BTC: "bitcoin",
  ETH: "ethereum",
  USDC: "usd-coin",
  SOL: "solana",
  WBTC: "wrapped-bitcoin",
  SBTC: "sbtc-2",
} as const;

type RouteHandler = (url: URL) => unknown;

const createRoutingFetcher = (routes: Record<string, RouteHandler | unknown>) =>
  vi.fn((input: string) => {
    const url = new URL(input);
    const path = url.pathname.replace("/api/v3/", "").replace("/api/v3", "");

    for (const [pattern, handler] of Object.entries(routes)) {
      if (path.includes(pattern) || url.pathname.includes(pattern)) {
        const body = typeof handler === "function" ? (handler as RouteHandler)(url) : handler;
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: () => Promise.resolve(body),
        } as unknown as Response);
      }
    }

    return Promise.resolve({
      ok: false,
      status: 404,
      headers: { get: () => null },
      json: () => Promise.resolve({}),
    } as unknown as Response);
  });

const btcPriceBody = {
  bitcoin: {
    usd: 67234.5,
    usd_24h_change: 2.34,
    last_updated_at: 1747612800,
  },
};

describe("CoinGecko adapter", () => {
  test("static fields are correct (S3-AC-A2.1 setup)", () => {
    const a = createCoingeckoAdapter({ fetcher: createRoutingFetcher({}) });
    expect(a.market).toBe("CRYPTO");
    expect(a.source).toBe("coingecko");
  });

  test("fetchLatest happy path → PriceQuote (S3-AC-A2.1)", async () => {
    const fetcher = createRoutingFetcher({
      "simple/price": btcPriceBody,
    });
    const a = createCoingeckoAdapter({ fetcher, bundled: TEST_BUNDLED });

    const quote = await a.fetchLatest("BTC");

    expect(quote.assetId).toBe("CRYPTO:BTC");
    expect(quote.price).toBeInstanceOf(Decimal);
    expect(quote.price.gt(0)).toBe(true);
    expect(quote.price.equals(new Decimal("67234.5"))).toBe(true);
    expect(quote.currency).toBe("USD");
    expect(quote.source).toBe("coingecko");
    expect(quote.changePercent!.equals(new Decimal("2.34"))).toBe(true);
    expect(quote.asOf).toBe("2025-05-19T00:00:00.000Z");

    expect(fetcher).toHaveBeenCalledOnce();
    const [url] = fetcher.mock.calls[0]!;
    expect(url).toContain("simple/price");
    expect(url).toContain("ids=bitcoin");
    expect(url).toContain("vs_currencies=usd");
  });

  test("fetchLatest USDC stablecoin tolerance (S3-AC-A2.2)", async () => {
    const fetcher = createRoutingFetcher({
      "simple/price": {
        "usd-coin": { usd: 1.001, usd_24h_change: 0.01, last_updated_at: 1747612800 },
      },
    });
    const a = createCoingeckoAdapter({ fetcher, bundled: TEST_BUNDLED });
    const quote = await a.fetchLatest("USDC");
    const n = quote.price.toNumber();
    expect(n).toBeGreaterThanOrEqual(0.95);
    expect(n).toBeLessThanOrEqual(1.05);
  });

  test("fetchLatest live fallback when ticker not in bundled (S3-AC-A2.3)", async () => {
    const fetcher = createRoutingFetcher({
      search: {
        coins: [{ id: "obscure-coin", symbol: "OBSCURE", name: "Obscure", market_cap_rank: 42 }],
      },
      "simple/price": (url: URL) => {
        const ids = url.searchParams.get("ids");
        if (ids === "obscure-coin") {
          return {
            "obscure-coin": { usd: 0.42, usd_24h_change: -1.2, last_updated_at: 1747612800 },
          };
        }
        return {};
      },
    });

    const a = createCoingeckoAdapter({ fetcher, bundled: TEST_BUNDLED });
    const quote = await a.fetchLatest("OBSCURE");

    expect(quote.assetId).toBe("CRYPTO:OBSCURE");
    expect(quote.price.equals(new Decimal("0.42"))).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  test("fetchLatest HTTP 429 → RateLimitError (S3-AC-A2.4)", async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 429,
        headers: { get: (k: string) => (k === "retry-after" ? "60" : null) },
        json: () => Promise.resolve({}),
      } as unknown as Response)
    );
    const a = createCoingeckoAdapter({ fetcher, bundled: TEST_BUNDLED });

    try {
      await a.fetchLatest("BTC");
      expect.fail("should throw");
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).retryAfterMs).toBe(60_000);
    }
  });

  test("fetchLatest symbol not found → NotFoundError (S3-AC-A2.5)", async () => {
    const fetcher = createRoutingFetcher({
      search: { coins: [] },
    });
    const a = createCoingeckoAdapter({ fetcher, bundled: TEST_BUNDLED });
    await expect(a.fetchLatest("ZZZZZ")).rejects.toBeInstanceOf(NotFoundError);
  });

  test("fetchHistorical returns sorted asc (S3-AC-A2.6)", async () => {
    const fetcher = createRoutingFetcher({
      market_chart: {
        prices: [
          [1747526400000, 66000],
          [1747612800000, 67234.5],
          [1747699200000, 68000],
        ],
      },
    });
    const a = createCoingeckoAdapter({ fetcher, bundled: TEST_BUNDLED });

    const from = new Date("2026-04-20");
    const to = new Date("2026-05-20");
    const quotes = await a.fetchHistorical!("BTC", from, to);

    expect(fetcher).toHaveBeenCalledOnce();
    const [url] = fetcher.mock.calls[0]!;
    expect(url).toContain("coins/bitcoin/market_chart");
    expect(url).toContain("vs_currency=usd");
    expect(url).toContain("days=30");

    expect(quotes.length).toBeGreaterThan(0);
    for (let i = 1; i < quotes.length; i++) {
      expect(quotes[i]!.asOf >= quotes[i - 1]!.asOf).toBe(true);
    }
    expect(quotes.every((q) => q.currency === "USD" && q.source === "coingecko")).toBe(true);
  });

  test("searchSymbols prefers bundled JSON with zero HTTP (S3-AC-A2.7)", async () => {
    const fetcher = createRoutingFetcher({});
    const a = createCoingeckoAdapter({ fetcher, bundled: TEST_BUNDLED });

    const results = await a.searchSymbols!("btc");
    expect(fetcher).not.toHaveBeenCalled();
    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(results.length).toBeLessThanOrEqual(8);
    expect(results.some((r) => r.symbol === "BTC")).toBe(true);
    expect(results.some((r) => r.symbol === "WBTC")).toBe(true);
  });

  test("searchSymbols filters market_cap_rank ≤ 500 (S3-AC-A2.8)", async () => {
    const fetcher = createRoutingFetcher({
      search: {
        coins: Array.from({ length: 20 }, (_, i) => ({
          id: `coin-${i}`,
          symbol: `FOO${i}`,
          name: `Foo ${i}`,
          market_cap_rank: i < 5 ? i + 1 : 600 + i,
        })),
      },
    });
    const a = createCoingeckoAdapter({ fetcher, bundled: { X: "x-coin" } });

    const results = await a.searchSymbols!("foo");
    expect(results.length).toBeLessThanOrEqual(5);
    expect(results.every((r) => r.market === "CRYPTO" && r.currency === "USD")).toBe(true);
  });

  test("fetchLatest empty price object → NotFoundError", async () => {
    const fetcher = createRoutingFetcher({
      "simple/price": {},
    });
    const a = createCoingeckoAdapter({ fetcher, bundled: TEST_BUNDLED });
    await expect(a.fetchLatest("BTC")).rejects.toBeInstanceOf(NotFoundError);
  });

  test("fetch throws → NetworkError", async () => {
    const fetcher = vi.fn(() => Promise.reject(new Error("ECONNRESET"))) as unknown as typeof fetch;
    const a = createCoingeckoAdapter({ fetcher, bundled: TEST_BUNDLED });
    await expect(a.fetchLatest("BTC")).rejects.toBeInstanceOf(NetworkError);
  });
});
