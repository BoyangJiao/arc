/**
 * Property-based tests for Asset ID composition / parsing.
 *
 * Enforces .specify/data-model-invariants.md Law 1 (Asset ID is Immutable).
 * - composeAssetId / parseAssetId must be inverse functions for valid input
 * - Asset.id format `{market}:{symbol}` must be respected end-to-end
 */

import { describe, test, expect } from "vitest";
import * as fc from "fast-check";
import { composeAssetId, parseAssetId, type Market } from "../src/domain/types";

const MARKETS: ReadonlyArray<Market> = ["CN", "HK", "US", "CRYPTO", "FUND"];

const marketArb = () => fc.constantFrom(...MARKETS);

// Valid symbols: alphanumeric, no whitespace, no colons (would conflict with separator)
const symbolArb = () =>
  fc
    .string({ minLength: 1, maxLength: 16 })
    .filter((s) => !s.includes(":") && s.trim().length === s.length && s.trim() !== "");

describe("Asset ID round-trip (Law 1)", () => {
  test("parseAssetId(composeAssetId(m, s)) preserves market & symbol", () => {
    fc.assert(
      fc.property(marketArb(), symbolArb(), (market, symbol) => {
        const id = composeAssetId(market, symbol);
        const parsed = parseAssetId(id);
        return parsed.market === market && parsed.symbol === symbol;
      })
    );
  });

  test("composed ID always has format `{market}:{symbol}`", () => {
    fc.assert(
      fc.property(marketArb(), symbolArb(), (market, symbol) => {
        const id = composeAssetId(market, symbol);
        return id === `${market}:${symbol}`;
      })
    );
  });

  test("symbols containing `:` are preserved by parseAssetId via rest.join", () => {
    // E.g. some crypto pairs use colons; parseAssetId joins back rest with ':'
    const id = "CRYPTO:btc:usdt";
    const parsed = parseAssetId(id);
    expect(parsed.market).toBe("CRYPTO");
    expect(parsed.symbol).toBe("btc:usdt");
  });

  test("invalid IDs throw clear errors", () => {
    expect(() => parseAssetId("")).toThrow();
    expect(() => parseAssetId("AAPL")).toThrow();
    expect(() => parseAssetId("US:")).toThrow();
  });
});
