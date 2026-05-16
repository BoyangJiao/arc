/**
 * Frankfurter FX adapter tests — verify response parsing + currency guards.
 */

import { describe, expect, test, vi } from "vitest";
import Decimal from "decimal.js";

import { createFrankfurterAdapter } from "../src/adapters/frankfurter";
import { NetworkError, NotFoundError, ParseError } from "../src/errors";

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
  amount: 1.0,
  base: "USD",
  date: "2026-05-13",
  rates: { CNY: 7.2 },
};

describe("Frankfurter FX adapter", () => {
  test("source field correct", () => {
    const a = createFrankfurterAdapter({ fetcher: mockFetch({}) });
    expect(a.source).toBe("frankfurter");
  });

  test("fetchRate parses success body", async () => {
    const a = createFrankfurterAdapter({ fetcher: mockFetch(successBody) });
    const r = await a.fetchRate("USD", "CNY");

    expect(r.from).toBe("USD");
    expect(r.to).toBe("CNY");
    expect(r.rate).toBeInstanceOf(Decimal);
    expect(r.rate.equals(new Decimal("7.2"))).toBe(true);
    expect(r.source).toBe("frankfurter");
    expect(r.asOf).toMatch(/^2026-05-13T/);
  });

  test("from === to short-circuits to rate=1 (no API call)", async () => {
    const fetcher = vi.fn() as unknown as typeof fetch;
    const a = createFrankfurterAdapter({ fetcher });
    const r = await a.fetchRate("USD", "USD");

    expect(r.rate.equals(1)).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
  });

  test("unsupported currency (BTC) → NotFoundError", async () => {
    const a = createFrankfurterAdapter({ fetcher: mockFetch(successBody) });
    await expect(a.fetchRate("USD", "BTC")).rejects.toBeInstanceOf(NotFoundError);
    await expect(a.fetchRate("ETH", "USD")).rejects.toBeInstanceOf(NotFoundError);
  });

  test("HTTP 404 → NotFoundError", async () => {
    const a = createFrankfurterAdapter({ fetcher: mockFetch({}, 404) });
    await expect(a.fetchRate("USD", "CNY")).rejects.toBeInstanceOf(NotFoundError);
  });

  test("HTTP 500 → NetworkError", async () => {
    const a = createFrankfurterAdapter({ fetcher: mockFetch({}, 500) });
    await expect(a.fetchRate("USD", "CNY")).rejects.toBeInstanceOf(NetworkError);
  });

  test("missing rate field → ParseError", async () => {
    const a = createFrankfurterAdapter({
      fetcher: mockFetch({ amount: 1, base: "USD", date: "2026-05-13", rates: {} }),
    });
    await expect(a.fetchRate("USD", "CNY")).rejects.toBeInstanceOf(ParseError);
  });

  test("missing date field → ParseError", async () => {
    const a = createFrankfurterAdapter({
      fetcher: mockFetch({ amount: 1, base: "USD", rates: { CNY: 7.2 } }),
    });
    await expect(a.fetchRate("USD", "CNY")).rejects.toBeInstanceOf(ParseError);
  });

  test("fetchHistoricalRate hits date path", async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: () => Promise.resolve(successBody),
      } as unknown as Response)
    );
    const a = createFrankfurterAdapter({ fetcher: fetcher as unknown as typeof fetch });
    const date = new Date("2024-01-15T12:00:00Z");
    await a.fetchHistoricalRate?.("USD", "CNY", date);

    const calledUrl = (fetcher.mock.calls[0]?.[0] ?? "") as string;
    expect(calledUrl).toContain("/2024-01-15");
    expect(calledUrl).toContain("base=USD");
    expect(calledUrl).toContain("symbols=CNY");
  });
});
