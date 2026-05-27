/**
 * Transaction form helpers — amount toggle (ADR 016).
 */

import Decimal from "decimal.js";

export type AmountEntryMode = "shares" | "total";

export interface ResolvedAmountFields {
  readonly shares: Decimal;
  readonly pricePerShare: Decimal;
}

/** Map UI fields to persisted shares + pricePerShare. */
export const resolveSharesAndUnitPrice = (
  mode: AmountEntryMode,
  sharesRaw: Decimal | null,
  unitPriceRaw: Decimal | null,
  totalAmountRaw: Decimal | null
): ResolvedAmountFields | null => {
  if (unitPriceRaw === null || unitPriceRaw.lte(0)) return null;
  if (mode === "shares") {
    if (sharesRaw === null || sharesRaw.lte(0)) return null;
    return { shares: sharesRaw, pricePerShare: unitPriceRaw };
  }
  if (totalAmountRaw === null || totalAmountRaw.lte(0)) return null;
  return {
    shares: totalAmountRaw.dividedBy(unitPriceRaw),
    pricePerShare: unitPriceRaw,
  };
};
