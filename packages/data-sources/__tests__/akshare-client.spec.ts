import { describe, expect, test, vi } from "vitest";
import Decimal from "decimal.js";

import { createAkshareClient } from "../src/adapters/akshare/client";
import { NetworkError, NotFoundError, QuotaError, RateLimitError } from "../src/errors";

const quoteJson = {
  assetId: "CN:600519",
  price: "1688.00",
  currency: "CNY",
  asOf: "2026-05-19T07:00:00.000Z",
  source: "akshare-cn",
  changePercent: "1.23",
};

const mockFetch = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  vi.fn((_url: string, init?: RequestInit) => {
    expect((init?.headers as Record<string, string>)["X-Arc-Token"]).toBe("secret");
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
      json: () => Promise.resolve(body),
    } as unknown as Response);
  });

describe("Akshare client", () => {
  test("fetchLatest parses PriceQuote JSON", async () => {
    const client = createAkshareClient({
      baseUrl: "https://wrapper.example",
      token: "secret",
      fetcher: mockFetch(quoteJson),
    });
    const q = await client.fetchLatest("CN", "600519");
    expect(q.assetId).toBe("CN:600519");
    expect(q.price).toBeInstanceOf(Decimal);
    expect(q.currency).toBe("CNY");
  });

  test("HTTP 404 → NotFoundError", async () => {
    const client = createAkshareClient({
      baseUrl: "https://wrapper.example",
      token: "secret",
      fetcher: mockFetch({ code: "not_found", message: "symbol" }, 404),
    });
    await expect(client.fetchLatest("CN", "bad")).rejects.toBeInstanceOf(NotFoundError);
  });

  test("HTTP 429 quota → QuotaError", async () => {
    const client = createAkshareClient({
      baseUrl: "https://wrapper.example",
      token: "secret",
      fetcher: mockFetch({ code: "quota", message: "exhausted" }, 429),
    });
    await expect(client.fetchLatest("CN", "600519")).rejects.toBeInstanceOf(QuotaError);
  });

  test("HTTP 503 → RateLimitError", async () => {
    const client = createAkshareClient({
      baseUrl: "https://wrapper.example",
      token: "secret",
      fetcher: mockFetch({}, 503, { "retry-after": "10" }),
    });
    try {
      await client.fetchLatest("HK", "00700");
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(RateLimitError);
      expect((e as RateLimitError).retryAfterMs).toBe(10_000);
    }
  });

  test("HTTP 401 → NetworkError", async () => {
    const client = createAkshareClient({
      baseUrl: "https://wrapper.example",
      token: "bad",
      fetcher: mockFetch({}, 401),
    });
    await expect(client.fetchLatest("FUND", "000001")).rejects.toBeInstanceOf(NetworkError);
  });
});
