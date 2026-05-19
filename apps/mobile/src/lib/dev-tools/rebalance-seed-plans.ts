/**
 * Rebalance DEV scenario targets — fixed % allocations for seeded holdings.
 *
 * Holdings: 10×AAPL, 5×MSFT, 8×NVDA, 5000×CASH:USD (cost basis from seed txs).
 * Current allocation ≈ 11.85% / 13.14% / 43.76% / 31.25% at reference marks.
 *
 * mild/heavy override NVDA mark in cache (warmRebalanceMarketCache) to force drift tiers.
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
