/**
 * Tushare US adapter — us_daily EOD (replaces Alpha Vantage history).
 */

import { describe, expect, test, vi } from "vitest";
import Decimal from "decimal.js";

import { createTushareUsAdapter } from "../src/adapters/tushare/us";
import { createTushareClient } from "../src/adapters/tushare/client";
import { NotFoundError, NotImplementedError } from "../src/errors";

const mockFetch = (body: unknown) =>
  vi.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: () => Promise.resolve(body),
    } as unknown as Response)
  );

const dailyFields = ["ts_code", "trade_date", "close", "pct_change"];

describe("Tushare US adapter", () => {
  test("static fields", () => {
    const client = createTushareClient({ token: "t", fetcher: mockFetch({}) });
    const a = createTushareUsAdapter({ client });
    expect(a.market).toBe("US");
    expect(a.source).toBe("tushare-us");
  });

  test("fetchLatest parses the most-recent us_daily row (raw ticker, USD, EOD asOf)", async () => {
    const fetcher = mockFetch({
      code: 0,
      msg: "",
      data: {
        fields: dailyFields,
        items: [
          ["AAPL", "20260615", 210.5, 1.1],
          ["AAPL", "20260616", 212.0, 0.71],
        ],
      },
    });
    const client = createTushareClient({ token: "t", fetcher });
    const a = createTushareUsAdapter({ client });
    const quote = await a.fetchLatest("AAPL");

    expect(quote.assetId).toBe("US:AAPL");
    expect(quote.currency).toBe("USD");
    expect(quote.source).toBe("tushare-us");
    expect(quote.price.equals(new Decimal("212"))).toBe(true); // latest trade_date
    expect(quote.asOf).toBe("2026-06-16T20:00:00.000Z");

    const body = JSON.parse((fetcher.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.api_name).toBe("us_daily");
    expect(body.params.ts_code).toBe("AAPL");
  });

  test("fetchHistorical returns sorted quotes; ETF ticker passes through", async () => {
    const fetcher = mockFetch({
      code: 0,
      msg: "",
      data: {
        fields: dailyFields,
        items: [
          ["SPY", "20260102", 600, 0.5],
          ["SPY", "20260101", 595, -0.2],
        ],
      },
    });
    const client = createTushareClient({ token: "t", fetcher });
    const a = createTushareUsAdapter({ client });
    const quotes = await a.fetchHistorical!(
      "SPY",
      new Date("2026-01-01T00:00:00.000Z"),
      new Date("2026-01-31T00:00:00.000Z")
    );

    expect(quotes).toHaveLength(2);
    expect(quotes[0]!.asOf).toBe("2026-01-01T20:00:00.000Z");
    expect(quotes[1]!.asOf).toBe("2026-01-02T20:00:00.000Z");
    expect(quotes[0]!.assetId).toBe("US:SPY");

    const body = JSON.parse((fetcher.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.params.start_date).toBe("20260101");
    expect(body.params.end_date).toBe("20260131");
  });

  test("empty items → NotFoundError", async () => {
    const fetcher = mockFetch({ code: 0, msg: "", data: { fields: ["close"], items: [] } });
    const client = createTushareClient({ token: "t", fetcher });
    const a = createTushareUsAdapter({ client });
    await expect(a.fetchLatest("NOPE")).rejects.toBeInstanceOf(NotFoundError);
  });

  test("searchSymbols → NotImplementedError", async () => {
    const client = createTushareClient({ token: "t", fetcher: mockFetch({}) });
    const a = createTushareUsAdapter({ client });
    await expect(a.searchSymbols!("apple")).rejects.toBeInstanceOf(NotImplementedError);
  });
});
