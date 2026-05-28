/**
 * Alpha Vantage adapter tests — verify response parsing + error mapping
 *
 * We mock global fetch with vitest's `vi.fn()` returning shaped Response objects.
 * No real API calls (free-tier 25/day quota — never spend on tests).
 */

import { describe, expect, test, vi } from "vitest";
import Decimal from "decimal.js";

import { createAlphaVantageAdapter } from "../src/adapters/alphavantage";
import { NetworkError, NotFoundError, ParseError, RateLimitError } from "../src/errors";

const mockFetch = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  vi.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
      json: () => Promise.resolve(body),
    } as unknown as Response)
  );

const successBody = {
  "Global Quote": {
    "01. symbol": "AAPL",
    "02. open": "180.00",
    "03. high": "182.00",
    "04. low": "179.50",
    "05. price": "180.50",
    "06. volume": "12345678",
    "07. latest trading day": "2026-05-13",
    "08. previous close": "180.20",
    "09. change": "0.30",
    "10. change percent": "0.166%",
  },
};

describe("Alpha Vantage adapter", () => {
  test("constructor throws when apiKey missing", () => {
    expect(() => createAlphaVantageAdapter({ apiKey: "" })).toThrow(/apiKey/);
  });

  test("static fields are correct", () => {
    const a = createAlphaVantageAdapter({ apiKey: "x", fetcher: mockFetch({}) });
    expect(a.market).toBe("US");
    expect(a.source).toBe("alphavantage");
  });

  test("fetchLatest parses success response into PriceQuote", async () => {
    const a = createAlphaVantageAdapter({
      apiKey: "key",
      fetcher: mockFetch(successBody),
    });
    const quote = await a.fetchLatest("AAPL");

    expect(quote.assetId).toBe("US:AAPL");
    expect(quote.price).toBeInstanceOf(Decimal);
    expect(quote.price.equals(new Decimal("180.50"))).toBe(true);
    expect(quote.currency).toBe("USD");
    expect(quote.source).toBe("alphavantage");
    expect(quote.asOf).toMatch(/^2026-05-13T/);
    expect(quote.changePercent).not.toBeNull();
    expect(quote.changePercent!.equals(new Decimal("0.166"))).toBe(true);
  });

  test("uppercases symbol in assetId regardless of input case", async () => {
    const a = createAlphaVantageAdapter({
      apiKey: "key",
      fetcher: mockFetch(successBody),
    });
    const quote = await a.fetchLatest("aapl");
    expect(quote.assetId).toBe("US:AAPL");
  });

  test("Note field with rate-limit copy → RateLimitError", async () => {
    const a = createAlphaVantageAdapter({
      apiKey: "key",
      fetcher: mockFetch({
        Note: "Thank you for using Alpha Vantage! Our standard API call frequency is 5 calls per minute and 25 calls per day.",
      }),
    });
    await expect(a.fetchLatest("AAPL")).rejects.toBeInstanceOf(RateLimitError);
  });

  test("Information field with premium-required → RateLimitError", async () => {
    const a = createAlphaVantageAdapter({
      apiKey: "key",
      fetcher: mockFetch({
        Information: "This API is a premium endpoint",
      }),
    });
    await expect(a.fetchLatest("AAPL")).rejects.toBeInstanceOf(RateLimitError);
  });

  test("Empty Global Quote (invalid symbol) → NotFoundError", async () => {
    const a = createAlphaVantageAdapter({
      apiKey: "key",
      fetcher: mockFetch({ "Global Quote": {} }),
    });
    await expect(a.fetchLatest("ZZZZZZ")).rejects.toBeInstanceOf(NotFoundError);
  });

  test("Error Message field → NotFoundError", async () => {
    const a = createAlphaVantageAdapter({
      apiKey: "key",
      fetcher: mockFetch({ "Error Message": "Invalid API call" }),
    });
    await expect(a.fetchLatest("???")).rejects.toBeInstanceOf(NotFoundError);
  });

  test("HTTP 429 with retry-after header → RateLimitError with retryAfterMs", async () => {
    const a = createAlphaVantageAdapter({
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

  test("HTTP 500 → NetworkError", async () => {
    const a = createAlphaVantageAdapter({
      apiKey: "key",
      fetcher: mockFetch({}, 500),
    });
    await expect(a.fetchLatest("AAPL")).rejects.toBeInstanceOf(NetworkError);
  });

  test("fetch throws (network down) → NetworkError", async () => {
    const a = createAlphaVantageAdapter({
      apiKey: "key",
      fetcher: vi.fn(() => Promise.reject(new Error("ECONNRESET"))) as unknown as typeof fetch,
    });
    await expect(a.fetchLatest("AAPL")).rejects.toBeInstanceOf(NetworkError);
  });

  test("invalid JSON body → ParseError", async () => {
    const a = createAlphaVantageAdapter({
      apiKey: "key",
      fetcher: vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: () => Promise.reject(new Error("not json")),
        } as unknown as Response)
      ) as unknown as typeof fetch,
    });
    await expect(a.fetchLatest("AAPL")).rejects.toBeInstanceOf(ParseError);
  });

  test("missing price field → ParseError", async () => {
    const a = createAlphaVantageAdapter({
      apiKey: "key",
      fetcher: mockFetch({
        "Global Quote": { "01. symbol": "AAPL", "07. latest trading day": "2026-05-13" },
      }),
    });
    await expect(a.fetchLatest("AAPL")).rejects.toBeInstanceOf(ParseError);
  });

  test("non-numeric price string → ParseError", async () => {
    const a = createAlphaVantageAdapter({
      apiKey: "key",
      fetcher: mockFetch({
        "Global Quote": {
          "01. symbol": "AAPL",
          "05. price": "not a number",
          "07. latest trading day": "2026-05-13",
        },
      }),
    });
    await expect(a.fetchLatest("AAPL")).rejects.toBeInstanceOf(ParseError);
  });

  test("fetchHistorical filters TIME_SERIES_DAILY by window and sorts asc", async () => {
    const fetcher = mockFetch({
      "Time Series (Daily)": {
        "2026-05-20": { "4. close": "182.00" },
        "2026-05-19": { "4. close": "180.50" },
        "2026-05-10": { "4. close": "175.00" },
      },
    });
    const a = createAlphaVantageAdapter({
      apiKey: "key",
      fetcher,
    });

    const quotes = await a.fetchHistorical!(
      "AAPL",
      new Date("2026-05-18T00:00:00Z"),
      new Date("2026-05-21T00:00:00Z")
    );

    expect(quotes).toHaveLength(2);
    expect(quotes[0]!.asOf).toMatch(/^2026-05-19/);
    expect(quotes[1]!.asOf).toMatch(/^2026-05-20/);
    expect(quotes[1]!.price.equals(new Decimal("182.00"))).toBe(true);
    expect(fetcher.mock.calls[0]![0]).not.toContain("outputsize=full");
  });

  test("fetchHistorical sets outputsize=full when range exceeds 100 days (ADR 016)", async () => {
    const fetcher = mockFetch({
      "Time Series (Daily)": {
        "2025-01-02": { "4. close": "170.00" },
        "2026-05-20": { "4. close": "182.00" },
      },
    });
    const a = createAlphaVantageAdapter({
      apiKey: "key",
      fetcher,
    });

    await a.fetchHistorical!(
      "AAPL",
      new Date("2025-01-01T00:00:00Z"),
      new Date("2026-05-21T00:00:00Z")
    );

    expect(fetcher.mock.calls[0]![0]).toContain("outputsize=full");
  });
});
