/**
 * Stale-quote heuristics — shared across cache-first reads.
 *
 * Dev cache layers (memory / AsyncStorage / Supabase price_snapshots) can hold
 * rows written by long-retired paths:
 *   - `source: "seed-dev"` — DEV seed scripts (intentional for stale-quote UAT,
 *     but should NOT block real Finnhub refresh on real watchlist / portfolio
 *     reads)
 *   - `source: "fixture"` — ADR 008 fixture adapter (retired 2026-05-19)
 *   - `source: "alphavantage"` — pre-Finnhub adapter (still in tree as rollback)
 *   - missing `changePercent` — earlier adapters / seeds wrote only price
 *
 * Any of the above means "treat the cached row as suspect and prefer a live
 * Finnhub refresh when the policy / freshness window allows it".
 *
 * Callers:
 *   - use-watchlist-quotes (bypass cache when stale)
 *   - use-portfolio-valuation (skip stale rows on cache-first read)
 *   - use-price (skip stale rows on cache-first read)
 *   - validate-us-symbol (skip stale rows before recording a transaction)
 */

import type { PriceQuote } from "@arc/core";

const STALE_SOURCES: ReadonlySet<string> = new Set(["seed-dev", "fixture", "alphavantage"]);

/**
 * Returns true if the cached quote should NOT be trusted as a substitute for
 * a fresh adapter call (Finnhub / Frankfurter).
 *
 * Pure function — no side effects, safe to call in render / queryFn.
 */
export const isStaleQuoteSource = (quote: Pick<PriceQuote, "source" | "changePercent">): boolean =>
  STALE_SOURCES.has(quote.source) || quote.changePercent == null;
