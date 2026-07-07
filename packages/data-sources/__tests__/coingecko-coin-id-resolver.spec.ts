/**
 * CoinGecko coin-id resolver — table-driven (bundled + live fallback)
 */

import { describe, expect, test, vi } from "vitest";

import {
  matchBundledCoins,
  tickerToCoinId,
  type CoingeckoBundledCoins,
  type CoingeckoSearchCoin,
} from "../src/adapters/coingecko/coin-id-resolver";
import { NotFoundError } from "../src/errors";

const BUNDLED: CoingeckoBundledCoins = {
  BTC: "bitcoin",
  ETH: "ethereum",
  USDC: "usd-coin",
  SOL: "solana",
  WBTC: "wrapped-bitcoin",
};

describe("tickerToCoinId", () => {
  test.each([
    ["BTC", "bitcoin"],
    ["btc", "bitcoin"],
    ["ETH", "ethereum"],
    ["USDC", "usd-coin"],
  ])("%s → %s from bundled JSON", async (ticker, expected) => {
    await expect(tickerToCoinId(ticker, BUNDLED)).resolves.toBe(expected);
  });

  test("missing ticker + no fallback → NotFoundError", async () => {
    await expect(tickerToCoinId("ZZZZZ", BUNDLED)).rejects.toBeInstanceOf(NotFoundError);
  });

  test("missing ticker + live fallback exact match", async () => {
    const fallback = vi.fn(
      async (): Promise<ReadonlyArray<CoingeckoSearchCoin>> => [
        { id: "obscure-coin", symbol: "OBSCURE", name: "Obscure", market_cap_rank: 42 },
      ]
    );

    await expect(tickerToCoinId("OBSCURE", BUNDLED, fallback)).resolves.toBe("obscure-coin");
    expect(fallback).toHaveBeenCalledWith("OBSCURE");
  });

  test("live fallback picks lowest market_cap_rank when duplicate symbols", async () => {
    const fallback = vi.fn(
      async (): Promise<ReadonlyArray<CoingeckoSearchCoin>> => [
        { id: "uni-other", symbol: "UNI", name: "Other UNI", market_cap_rank: 900 },
        { id: "uniswap", symbol: "UNI", name: "Uniswap", market_cap_rank: 20 },
      ]
    );

    await expect(tickerToCoinId("UNI", {}, fallback)).resolves.toBe("uniswap");
  });

  test("live fallback empty results → NotFoundError", async () => {
    const fallback = vi.fn(async () => [] as ReadonlyArray<CoingeckoSearchCoin>);
    await expect(tickerToCoinId("NOPE", BUNDLED, fallback)).rejects.toBeInstanceOf(NotFoundError);
  });

  test("live fallback no symbol match → NotFoundError", async () => {
    const fallback = vi.fn(
      async (): Promise<ReadonlyArray<CoingeckoSearchCoin>> => [
        { id: "foo-coin", symbol: "FOO", name: "Foo", market_cap_rank: 1 },
      ]
    );
    await expect(tickerToCoinId("BAR", BUNDLED, fallback)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("matchBundledCoins", () => {
  test('query "btc" matches BTC and WBTC tickers', () => {
    const matches = matchBundledCoins("btc", BUNDLED);
    const tickers = matches.map((m) => m.ticker).sort();
    expect(tickers).toEqual(["BTC", "WBTC"]);
  });

  test("query matching coin_id substring", () => {
    const matches = matchBundledCoins("ethereum", BUNDLED);
    expect(matches).toEqual([{ ticker: "ETH", coinId: "ethereum" }]);
  });

  test("empty query → []", () => {
    expect(matchBundledCoins("", BUNDLED)).toEqual([]);
    expect(matchBundledCoins("   ", BUNDLED)).toEqual([]);
  });

  test("no match → []", () => {
    expect(matchBundledCoins("zzzzz", BUNDLED)).toEqual([]);
  });
});
