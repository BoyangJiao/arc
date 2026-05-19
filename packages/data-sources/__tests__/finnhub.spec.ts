/**
 * Finnhub adapter tests — verify response parsing + error mapping
 */

import { describe, expect, test, vi } from "vitest";
import Decimal from "decimal.js";

import { createFinnhubAdapter } from "../src/adapters/finnhub";
import { NetworkError, NotFoundError, RateLimitError } from "../src/errors";

const mockFetch = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  vi.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
      json: () => Promise.resolve(body),
    } as unknown as Response)
  );

const successQuote = {
  c: 180.5,
  d: 0.3,
  dp: 1.23,
  h: 182,
  l: 179.5,
  o: 180,
  pc: 180.2,
  t: 1747612800,
};

describe("Finnhub adapter", () => {
  test("constructor throws when apiKey missing", () => {
    expect(() => createFinnhubAdapter({ apiKey: "" })).toThrow(/apiKey/);
  });

  test("static fields are correct", () => {
    const a = createFinnhubAdapter({ apiKey: "x", fetcher: mockFetch({}) });
    expect(a.market).toBe("US");
    expect(a.source).toBe("finnhub");
  });

  test("fetchLatest parses success response into PriceQuote", async () => {
    const a = createFinnhubAdapter({
      apiKey: "key",
      fetcher: mockFetch(successQuote),
    });
    const quote = await a.fetchLatest("AAPL");

    expect(quote.assetId).toBe("US:AAPL");
    expect(quote.price).toBeInstanceOf(Decimal);
    expect(quote.price.equals(new Decimal("180.5"))).toBe(true);
    expect(quote.currency).toBe("USD");
    expect(quote.source).toBe("finnhub");
    expect(quote.asOf).toBe("2025-05-19T00:00:00.000Z");
  });

  test("fetchLatest parses changePercent (dp = 1.23 → Decimal 1.23)", async () => {
    const a = createFinnhubAdapter({
      apiKey: "key",
      fetcher: mockFetch(successQuote),
    });
    const quote = await a.fetchLatest("AAPL");
    expect(quote.changePercent).not.toBeNull();
    expect(quote.changePercent!.equals(new Decimal("1.23"))).toBe(true);
  });

  test("fetchLatest parses asOf from Unix seconds", async () => {
    const a = createFinnhubAdapter({
      apiKey: "key",
      fetcher: mockFetch({ ...successQuote, t: 1747612800 }),
    });
    const quote = await a.fetchLatest("AAPL");
    expect(quote.asOf).toBe("2025-05-19T00:00:00.000Z");
  });

  test("uppercases symbol in assetId regardless of input case", async () => {
    const a = createFinnhubAdapter({
      apiKey: "key",
      fetcher: mockFetch(successQuote),
    });
    const quote = await a.fetchLatest("aapl");
    expect(quote.assetId).toBe("US:AAPL");
  });

  test("HTTP 429 → RateLimitError", async () => {
    const a = createFinnhubAdapter({
      apiKey: "key",
      fetcher: mockFetch({}, 429, { "retry-after": "30" }),
    });
    try {
      await a.fetchLatest("AAPL");
      expect.fail("should throw");
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).retryAfterMs).toBe(30000);
    }
  });

  test("HTTP 401 → NetworkError (auth)", async () => {
    const a = createFinnhubAdapter({
      apiKey: "bad",
      fetcher: mockFetch({}, 401),
    });
    await expect(a.fetchLatest("AAPL")).rejects.toBeInstanceOf(NetworkError);
  });

  test("c=0 and t=0 empty response → NotFoundError", async () => {
    const a = createFinnhubAdapter({
      apiKey: "key",
      fetcher: mockFetch({ c: 0, d: null, dp: null, h: 0, l: 0, o: 0, pc: 0, t: 0 }),
    });
    await expect(a.fetchLatest("ZZZZZZ")).rejects.toBeInstanceOf(NotFoundError);
  });

  test("fetch throws (network down) → NetworkError", async () => {
    const a = createFinnhubAdapter({
      apiKey: "key",
      fetcher: vi.fn(() => Promise.reject(new Error("ECONNRESET"))) as unknown as typeof fetch,
    });
    await expect(a.fetchLatest("AAPL")).rejects.toBeInstanceOf(NetworkError);
  });

  test("searchSymbols filters Common Stock and caps at 8", async () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({
      symbol: `SYM${i}`,
      displaySymbol: `SYM${i}`,
      description: `Stock ${i}`,
      type: "Common Stock",
    }));
    const a = createFinnhubAdapter({
      apiKey: "key",
      fetcher: mockFetch({ count: 12, result: rows }),
    });
    const results = await a.searchSymbols!("apple");
    expect(results).toHaveLength(8);
    expect(results[0]?.assetId).toBe("US:SYM0");
    expect(results[0]?.market).toBe("US");
  });

  test("searchSymbols empty result → []", async () => {
    const a = createFinnhubAdapter({
      apiKey: "key",
      fetcher: mockFetch({ count: 0, result: [] }),
    });
    expect(await a.searchSymbols!("nope")).toEqual([]);
  });

  test("searchSymbols filters displaySymbol with dot (BRK.A)", async () => {
    const a = createFinnhubAdapter({
      apiKey: "key",
      fetcher: mockFetch({
        result: [
          {
            symbol: "BRK.A",
            displaySymbol: "BRK.A",
            description: "Berkshire Hathaway",
            type: "Common Stock",
          },
          {
            symbol: "AAPL",
            displaySymbol: "AAPL",
            description: "Apple Inc",
            type: "Common Stock",
          },
        ],
      }),
    });
    const results = await a.searchSymbols!("brk");
    expect(results).toHaveLength(1);
    expect(results[0]?.symbol).toBe("AAPL");
  });

  test("searchSymbols HTTP 429 → RateLimitError", async () => {
    const a = createFinnhubAdapter({
      apiKey: "key",
      fetcher: mockFetch({}, 429),
    });
    await expect(a.searchSymbols!("aapl")).rejects.toBeInstanceOf(RateLimitError);
  });
});
