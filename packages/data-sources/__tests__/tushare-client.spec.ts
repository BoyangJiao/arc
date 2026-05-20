/**
 * Tushare shared client — error mapping + POST contract (mocked fetcher)
 */

import { describe, expect, test, vi } from "vitest";

import { assertTushareRowsNonEmpty, createTushareClient } from "../src/adapters/tushare/client";
import { NetworkError, NotFoundError, ParseError, QuotaError, RateLimitError } from "../src/errors";

const mockFetch = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  vi.fn((_url: string, _init?: RequestInit) =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
      json: () => Promise.resolve(body),
    } as unknown as Response)
  );

const successData = {
  code: 0,
  msg: "",
  data: {
    fields: ["ts_code", "trade_date", "close"],
    items: [["600519.SH", "20260519", 1688.0]],
  },
};

describe("Tushare client", () => {
  test("constructor throws when token missing", () => {
    expect(() => createTushareClient({ token: "" })).toThrow(/token/);
  });

  test("code 0 returns column-oriented TushareRows", async () => {
    const fetcher = mockFetch(successData);
    const client = createTushareClient({ token: "test-token", fetcher });

    const rows = await client.call("daily", { ts_code: "600519.SH" }, [
      "ts_code",
      "trade_date",
      "close",
    ]);

    expect(rows.fields).toEqual(["ts_code", "trade_date", "close"]);
    expect(rows.items).toHaveLength(1);
    expect(rows.items[0]).toEqual(["600519.SH", "20260519", 1688.0]);

    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://api.tushare.pro");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({
      api_name: "daily",
      token: "test-token",
      params: { ts_code: "600519.SH" },
      fields: "ts_code,trade_date,close",
    });
  });

  test("Tushare code 40203 → RateLimitError with 60s retry (S3-AC-A1.5)", async () => {
    const fetcher = mockFetch({
      code: 40203,
      msg: "抱歉，您每分钟最多访问该接口60次",
      data: null,
    });
    const client = createTushareClient({
      token: "test-token",
      fetcher,
      source: "tushare-cn",
    });

    try {
      await client.call("daily", { ts_code: "600519.SH" }, ["close"], {
        source: "tushare-cn",
      });
      expect.fail("should throw");
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      const e = err as RateLimitError;
      expect(e.source).toBe("tushare-cn");
      expect(e.retryAfterMs).toBe(60_000);
    }
  });

  test("Tushare code 40002 → QuotaError with code field (S3-AC-A1.6)", async () => {
    const fetcher = mockFetch({
      code: 40002,
      msg: "权限不足",
      data: null,
    });
    const client = createTushareClient({ token: "test-token", fetcher, source: "tushare-cn" });

    try {
      await client.call("daily", { ts_code: "600519.SH" }, ["close"]);
      expect.fail("should throw");
    } catch (err) {
      expect(err).toBeInstanceOf(QuotaError);
      // QuotaError extends AdapterError directly (not NetworkError); withFallback (ADR 011) keys on instanceof QuotaError
      expect(err).not.toBeInstanceOf(NetworkError);
      const e = err as QuotaError;
      expect(e.source).toBe("tushare-cn");
      expect(e.code).toBe(40002);
    }
  });

  test("Tushare code 40001 → NetworkError (invalid token; NOT QuotaError)", async () => {
    const fetcher = mockFetch({
      code: 40001,
      msg: "token无效",
      data: null,
    });
    const client = createTushareClient({ token: "bad", fetcher });

    try {
      await client.call("daily", {}, ["close"]);
      expect.fail("should throw");
    } catch (err) {
      expect(err).toBeInstanceOf(NetworkError);
      // Negative: token-invalid must bubble in withFallback (no benefit from trying secondary)
      expect(err).not.toBeInstanceOf(QuotaError);
    }
  });

  test("other non-zero code → NetworkError with code and msg", async () => {
    const fetcher = mockFetch({
      code: 99999,
      msg: "unknown",
      data: null,
    });
    const client = createTushareClient({ token: "test-token", fetcher });

    try {
      await client.call("daily", {}, ["close"]);
      expect.fail("should throw");
    } catch (err) {
      expect(err).toBeInstanceOf(NetworkError);
      expect(String((err as NetworkError).cause)).toContain("99999");
      expect(String((err as NetworkError).cause)).toContain("unknown");
    }
  });

  test("assertTushareRowsNonEmpty on empty items → NotFoundError (S3-AC-A1.7)", () => {
    expect(() =>
      assertTushareRowsNonEmpty({ fields: ["close"], items: [] }, "tushare-cn", "600519")
    ).toThrow(NotFoundError);
  });

  test("invalid JSON body → ParseError", async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: () => Promise.reject(new SyntaxError("Unexpected token")),
      } as unknown as Response)
    );

    const client = createTushareClient({ token: "test-token", fetcher });

    await expect(client.call("daily", {}, ["close"])).rejects.toBeInstanceOf(ParseError);
  });

  test("code 0 but missing data.fields → ParseError", async () => {
    const fetcher = mockFetch({ code: 0, msg: "", data: { items: [] } });
    const client = createTushareClient({ token: "test-token", fetcher });

    await expect(client.call("daily", {}, ["close"])).rejects.toBeInstanceOf(ParseError);
  });

  test("HTTP 500 → NetworkError", async () => {
    const fetcher = mockFetch({}, 500);
    const client = createTushareClient({ token: "test-token", fetcher });

    await expect(client.call("daily", {}, ["close"])).rejects.toBeInstanceOf(NetworkError);
  });

  test("HTTP 401 → NetworkError", async () => {
    const fetcher = mockFetch({}, 401);
    const client = createTushareClient({ token: "test-token", fetcher });

    await expect(client.call("daily", {}, ["close"])).rejects.toBeInstanceOf(NetworkError);
  });

  test("HTTP 429 with retry-after → RateLimitError", async () => {
    const fetcher = mockFetch({}, 429, { "retry-after": "30" });
    const client = createTushareClient({ token: "test-token", fetcher });

    try {
      await client.call("daily", {}, ["close"]);
      expect.fail("should throw");
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).retryAfterMs).toBe(30_000);
    }
  });

  test("fetch throws (network down) → NetworkError", async () => {
    const client = createTushareClient({
      token: "test-token",
      fetcher: vi.fn(() => Promise.reject(new Error("ECONNRESET"))) as unknown as typeof fetch,
    });

    await expect(client.call("daily", {}, ["close"])).rejects.toBeInstanceOf(NetworkError);
  });

  test("call uses config.source when options.source omitted", async () => {
    const fetcher = mockFetch({
      code: 40203,
      msg: "rate limited",
      data: null,
    });
    const client = createTushareClient({
      token: "test-token",
      fetcher,
      source: "tushare-hk",
    });

    try {
      await client.call("hk_daily", { ts_code: "00700.HK" }, ["close"]);
      expect.fail("should throw");
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).source).toBe("tushare-hk");
    }
  });
});
