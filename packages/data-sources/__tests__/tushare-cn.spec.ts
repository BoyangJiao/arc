/**
 * Tushare CN adapter — S3-AC-A1.1 / A1.7 / A1.10
 */

import { describe, expect, test, vi } from "vitest";
import Decimal from "decimal.js";

import { createTushareCnAdapter } from "../src/adapters/tushare/cn";
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

const dailySuccess = {
  code: 0,
  msg: "",
  data: {
    fields: ["ts_code", "trade_date", "close", "pct_chg"],
    items: [["600519.SH", "20260519", 1688.0, 1.23]],
  },
};

describe("Tushare CN adapter", () => {
  test("static fields", () => {
    const client = createTushareClient({ token: "t", fetcher: mockFetch({}) });
    const a = createTushareCnAdapter({ client });
    expect(a.market).toBe("CN");
    expect(a.source).toBe("tushare-cn");
  });

  test("fetchLatest parses daily row (S3-AC-A1.1)", async () => {
    const fetcher = mockFetch(dailySuccess);
    const client = createTushareClient({ token: "t", fetcher });
    const a = createTushareCnAdapter({ client });
    const quote = await a.fetchLatest("600519");

    expect(quote.assetId).toBe("CN:600519");
    expect(quote.currency).toBe("CNY");
    expect(quote.source).toBe("tushare-cn");
    expect(quote.price.equals(new Decimal("1688"))).toBe(true);
    expect(quote.changePercent?.equals(new Decimal("1.23"))).toBe(true);
    expect(quote.asOf).toBe("2026-05-19T07:00:00.000Z");

    const [, init] = fetcher.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.api_name).toBe("daily");
    expect(body.params.ts_code).toBe("600519.SH");
  });

  test("empty items → NotFoundError (S3-AC-A1.7)", async () => {
    const fetcher = mockFetch({
      code: 0,
      msg: "",
      data: { fields: ["close"], items: [] },
    });
    const client = createTushareClient({ token: "t", fetcher });
    const a = createTushareCnAdapter({ client });
    await expect(a.fetchLatest("000000")).rejects.toBeInstanceOf(NotFoundError);
  });

  test("fetchHistorical returns sorted quotes (S3-AC-A1.10)", async () => {
    const fetcher = mockFetch({
      code: 0,
      msg: "",
      data: {
        fields: ["ts_code", "trade_date", "close", "pct_chg"],
        items: [
          ["600519.SH", "20260102", 1600, 0.5],
          ["600519.SH", "20260101", 1590, -0.2],
        ],
      },
    });
    const client = createTushareClient({ token: "t", fetcher });
    const a = createTushareCnAdapter({ client });
    const quotes = await a.fetchHistorical!(
      "600519",
      new Date("2026-01-01T00:00:00.000Z"),
      new Date("2026-01-31T00:00:00.000Z")
    );

    expect(quotes).toHaveLength(2);
    expect(quotes[0]!.asOf).toBe("2026-01-01T07:00:00.000Z");
    expect(quotes[1]!.asOf).toBe("2026-01-02T07:00:00.000Z");

    const body = JSON.parse((fetcher.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.params.start_date).toBe("20260101");
    expect(body.params.end_date).toBe("20260131");
  });

  test("searchSymbols → NotImplementedError", async () => {
    const client = createTushareClient({ token: "t", fetcher: mockFetch({}) });
    const a = createTushareCnAdapter({ client });
    await expect(a.searchSymbols!("茅台")).rejects.toBeInstanceOf(NotImplementedError);
  });
});
