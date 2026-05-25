/**
 * Per-market share rounding for Rebalance action list (Stage 2 J9).
 *
 * Rationale (.specify/feature-specs/stage-2/rebalance-stage-2.md §Resolved decisions #2):
 *   - Stocks (US / CN / HK / FUND) → integer shares (floor toward zero)
 *   - Crypto → 8 decimal places (satoshi resolution)
 *   - Cash → currency minor unit (2 decimals general; JPY → 0 decimals)
 *
 * "Floor toward zero" means truncation, not -∞:
 *   roundShares(+5.7, US, USD) =  +5    (don't over-buy)
 *   roundShares(-5.7, US, USD) =  -5    (don't over-sell)
 * This is `Decimal.ROUND_DOWN` (NOT `ROUND_FLOOR`).
 *
 * Pure module. No external deps beyond `decimal.js`.
 */

import Decimal from "decimal.js";

import type { Currency, Market } from "../domain/types";

/**
 * How many decimal places a market+currency pair allows in an action quantity.
 * Used as the second arg to `Decimal.toDecimalPlaces`.
 */
export const decimalsForRounding = (market: Market, currency: Currency): number => {
  if (market === "CRYPTO") return 8;
  if (market === "CASH") return currency === "JPY" ? 0 : 2;
  // US / CN / HK / FUND
  return 0;
};

/**
 * Round a raw `shares` Decimal toward zero per market + currency rules.
 *
 * Truncation (not floor toward -∞) keeps the absolute value smaller, which is
 * the conservative move on both sides of zero — don't over-buy, don't over-sell.
 */
export const roundShares = (raw: Decimal, market: Market, currency: Currency): Decimal => {
  const dp = decimalsForRounding(market, currency);
  return raw.toDecimalPlaces(dp, Decimal.ROUND_DOWN);
};
