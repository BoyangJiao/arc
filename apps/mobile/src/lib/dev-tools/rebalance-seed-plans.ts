/**
 * Rebalance DEV scenario targets — derived from fixture holdings + quotes.json prices.
 *
 * Holdings: 10×AAPL, 5×MSFT, 8×NVDA, 5000×CASH:USD @ fixture prices 189.50 / 420.30 / 875 / 1.
 * Current allocation ≈ 11.85% / 13.14% / 43.76% / 31.25% (sums to 100).
 *
 * Fixture mode (default) ignores Supabase price_snapshots — drift is driven by targets.
 * Live mode: mild/heavy also bump NVDA quote via warmRebalanceMarketCache.
 */

export const REBALANCE_FIXTURE_NVDA = "875.00";

/** Targets ≈ current → all |deviation| ≤ ~1% (neutral). */
export const REBALANCE_TARGETS_ALIGNED = {
  "US:AAPL": "11.85",
  "US:MSFT": "13.14",
  "US:NVDA": "43.76",
  "CASH:USD": "31.25",
} as const;

/** AAPL ~+7%, MSFT ~-7% vs fixture current (warning tier). */
export const REBALANCE_TARGETS_MILD = {
  "US:AAPL": "4.85",
  "US:MSFT": "20.14",
  "US:NVDA": "43.76",
  "CASH:USD": "31.25",
} as const;

/** NVDA ~+15%, MSFT ~-15% vs fixture current (critical tier). */
export const REBALANCE_TARGETS_HEAVY = {
  "US:AAPL": "11.85",
  "US:MSFT": "28.14",
  "US:NVDA": "28.76",
  "CASH:USD": "31.25",
} as const;

/** Optional NVDA override for live / cache-first paths. */
export const REBALANCE_NVDA_MILD = "962.50";
export const REBALANCE_NVDA_HEAVY = "1181.25";
