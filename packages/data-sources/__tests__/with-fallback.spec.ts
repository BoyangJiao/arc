import { describe, expect, test, vi } from "vitest";
import Decimal from "decimal.js";

import type { PriceQuote } from "@arc/core";

import { withFallback, defaultFallbackClassifier } from "../src/adapters/with-fallback";
import { NetworkError, NotFoundError, ParseError, QuotaError, RateLimitError } from "../src/errors";
import type { PriceAdapter } from "../src/interfaces";

const quote: PriceQuote = {
  assetId: "CN:600519",
  price: new Decimal("100"),
  currency: "CNY",
  asOf: "2026-05-19T07:00:00.000Z",
  source: "primary",
  changePercent: null,
};

const stubAdapter = (source: string, impl: Partial<PriceAdapter>): PriceAdapter => ({
  market: "CN",
  source,
  fetchLatest: impl.fetchLatest ?? (() => Promise.resolve(quote)),
  ...impl,
});

describe("defaultFallbackClassifier", () => {
  test.each([
    [new RateLimitError("p", 1000), "try-secondary"],
    [new QuotaError("p", 40002, "quota"), "try-secondary"],
    [new NetworkError("p", "HTTP 500"), "try-secondary"],
    [new NetworkError("p", "40001: bad token"), "bubble"],
    [new NetworkError("p", "HTTP 401 unauthorized"), "bubble"],
    [new NotFoundError("p", "x"), "bubble"],
    [new ParseError("p", "bad"), "bubble"],
  ] as const)("classifies %s → %s", (err, expected) => {
    expect(defaultFallbackClassifier(err)).toBe(expected);
  });
});

describe("withFallback", () => {
  test("primary success — secondary not called", async () => {
    const secondary = vi.fn();
    const adapter = withFallback(
      stubAdapter("primary", {}),
      stubAdapter("secondary", { fetchLatest: secondary })
    );
    await adapter.fetchLatest("600519");
    expect(secondary).not.toHaveBeenCalled();
  });

  test("primary RateLimitError → secondary", async () => {
    const secondary = vi.fn().mockResolvedValue(quote);
    const adapter = withFallback(
      stubAdapter("primary", {
        fetchLatest: () => Promise.reject(new RateLimitError("primary", 60_000)),
      }),
      stubAdapter("secondary", { fetchLatest: secondary })
    );
    const result = await adapter.fetchLatest("600519");
    expect(secondary).toHaveBeenCalledOnce();
    expect(result.source).toBe("primary");
  });

  test("primary QuotaError → secondary", async () => {
    const secondary = vi.fn().mockResolvedValue(quote);
    const adapter = withFallback(
      stubAdapter("primary", {
        fetchLatest: () => Promise.reject(new QuotaError("primary", 40002, "quota")),
      }),
      stubAdapter("secondary", { fetchLatest: secondary })
    );
    await adapter.fetchLatest("600519");
    expect(secondary).toHaveBeenCalledOnce();
  });

  test("primary NetworkError 40001 → bubble", async () => {
    const secondary = vi.fn();
    const adapter = withFallback(
      stubAdapter("primary", {
        fetchLatest: () => Promise.reject(new NetworkError("primary", "40001: token")),
      }),
      stubAdapter("secondary", { fetchLatest: secondary })
    );
    await expect(adapter.fetchLatest("600519")).rejects.toBeInstanceOf(NetworkError);
    expect(secondary).not.toHaveBeenCalled();
  });

  test("primary NotFoundError → bubble", async () => {
    const secondary = vi.fn();
    const adapter = withFallback(
      stubAdapter("primary", {
        fetchLatest: () => Promise.reject(new NotFoundError("primary", "600519")),
      }),
      stubAdapter("secondary", { fetchLatest: secondary })
    );
    await expect(adapter.fetchLatest("600519")).rejects.toBeInstanceOf(NotFoundError);
    expect(secondary).not.toHaveBeenCalled();
  });
});
