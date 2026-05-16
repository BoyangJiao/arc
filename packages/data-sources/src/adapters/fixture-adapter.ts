/**
 * FixtureAdapter — zero-network PriceAdapter + FxAdapter pair for dev.
 *
 * Per ADR 008: when the dev "Fetch real market data" toggle is OFF, the
 * registry uses these adapters instead of Alpha Vantage / Frankfurter. The
 * full business chain (useQuery → adapter.fetchLatest → cache.set →
 * computeMarketValue → render) still runs end-to-end — only the network
 * call is replaced by a fixture table lookup.
 *
 * Why this satisfies the "real-flow integrity" rule (constitution §3.5):
 * it does NOT short-circuit a hook with a return-mock. It swaps the
 * adapter implementation behind the same interface. Adapter-side bugs
 * (wrong field shape, missing currency, Decimal coercion) still surface.
 *
 * Multi-market scaling:
 *   The same FixtureData JSON holds quotes for every market (US/CN/HK/
 *   CRYPTO/FUND). `createFixtureRegistry()` registers one fixture
 *   PriceAdapter per market — they all read the same data, no per-market
 *   wiring needed when Stage 2/3 adds new markets.
 */

import Decimal from "decimal.js";
import { composeAssetId, type Currency, type Market } from "@arc/core";

import { NotFoundError } from "../errors";
import type { FxAdapter, PriceAdapter } from "../interfaces";
import { createRegistry, type AdapterRegistry } from "../registry";

export interface FixtureQuote {
  /** Decimal-as-string (parsed via decimal.js). */
  readonly price: string;
  readonly currency: Currency;
  /** ISO 8601 timestamp. Defaults to FIXTURE_AS_OF_DEFAULT if absent. */
  readonly asOf?: string;
}

export interface FixtureFxRate {
  /** Decimal-as-string. 1 unit `from` equals this many units `to`. */
  readonly rate: string;
  readonly asOf?: string;
}

export interface FixtureData {
  /** Keyed by assetId (e.g. "US:AAPL"). */
  readonly quotes: Readonly<Record<string, FixtureQuote>>;
  /** Keyed by "FROM->TO" (e.g. "USD->CNY"). Reverse pairs auto-derived. */
  readonly fx: Readonly<Record<string, FixtureFxRate>>;
}

const FIXTURE_AS_OF_DEFAULT = "2026-05-17T00:00:00.000Z";
const FIXTURE_SOURCE = "fixture";

/** All Arc markets — keep in sync with packages/core's `Market` union. */
const ALL_MARKETS = ["US", "CN", "HK", "CRYPTO", "FUND"] as const satisfies readonly Market[];

/**
 * One PriceAdapter for a specific market, reading from the shared fixture data.
 * Multiple instances (one per market) all read the same `data` reference, so
 * editing the JSON updates them all.
 */
export const createFixturePriceAdapter = (market: Market, data: FixtureData): PriceAdapter => ({
  market,
  source: FIXTURE_SOURCE,
  async fetchLatest(symbol) {
    const assetId = composeAssetId(market, symbol.toUpperCase());
    const q = data.quotes[assetId];
    if (!q) {
      throw new NotFoundError(
        FIXTURE_SOURCE,
        `no fixture quote for ${assetId}; add it to dev-fixtures/quotes.json or switch toggle ON`
      );
    }
    return {
      assetId,
      price: new Decimal(q.price),
      currency: q.currency,
      asOf: q.asOf ?? FIXTURE_AS_OF_DEFAULT,
      source: FIXTURE_SOURCE,
    };
  },
  async fetchHistorical(symbol) {
    // Stage 1 doesn't render historical charts; return the single latest
    // quote so anything iterating gets a non-empty list. Stage 2/3 chart
    // work will expand the fixture schema to include per-date series.
    const latest = await this.fetchLatest(symbol);
    return [latest];
  },
});

export const createFixtureFxAdapter = (data: FixtureData): FxAdapter => ({
  source: FIXTURE_SOURCE,
  async fetchRate(from, to) {
    if (from === to) {
      return {
        from,
        to,
        rate: new Decimal(1),
        asOf: FIXTURE_AS_OF_DEFAULT,
        source: FIXTURE_SOURCE,
      };
    }
    const direct = data.fx[`${from}->${to}`];
    if (direct) {
      return {
        from,
        to,
        rate: new Decimal(direct.rate),
        asOf: direct.asOf ?? FIXTURE_AS_OF_DEFAULT,
        source: FIXTURE_SOURCE,
      };
    }
    // Try the reverse pair and invert (avoids requiring both directions in JSON).
    const reverse = data.fx[`${to}->${from}`];
    if (reverse) {
      return {
        from,
        to,
        rate: new Decimal(1).dividedBy(reverse.rate),
        asOf: reverse.asOf ?? FIXTURE_AS_OF_DEFAULT,
        source: FIXTURE_SOURCE,
      };
    }
    throw new NotFoundError(
      FIXTURE_SOURCE,
      `no fixture FX rate for ${from}->${to}; add it to dev-fixtures/quotes.json or switch toggle ON`
    );
  },
});

/**
 * Convenience: build a complete AdapterRegistry where every market routes to
 * a fixture PriceAdapter + the fixture FxAdapter. One-line drop-in for
 * `getRegistry()` when the dev "Fetch real market data" toggle is OFF.
 */
export const createFixtureRegistry = (data: FixtureData): AdapterRegistry => {
  const priceAdapters = Object.fromEntries(
    ALL_MARKETS.map((m) => [m, createFixturePriceAdapter(m, data)])
  ) as Record<Market, PriceAdapter>;
  return createRegistry({
    priceAdapters,
    fxAdapter: createFixtureFxAdapter(data),
  });
};
