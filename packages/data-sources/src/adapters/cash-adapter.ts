/**
 * CashPriceAdapter — constant price=1.0 in the asset's native currency.
 *
 * CASH market assets (`CASH:USD`, `CASH:CNY`, …) represent cash balances.
 * No external API; FX layer converts to reporting currency for valuation.
 *
 * 见 .specify/feature-specs/stage-2/rebalance-stage-2.md § CASH asset price adapter
 */

import Decimal from "decimal.js";
import { composeAssetId, type Currency } from "@arc/core";

import type { PriceAdapter } from "../interfaces";

const CASH_SOURCE = "cash-constant";

export const createCashPriceAdapter = (): PriceAdapter => ({
  market: "CASH",
  source: CASH_SOURCE,
  async fetchLatest(symbol) {
    const normalized = symbol.toUpperCase();
    return {
      assetId: composeAssetId("CASH", normalized),
      price: new Decimal(1),
      currency: normalized as Currency,
      asOf: new Date().toISOString(),
      source: CASH_SOURCE,
    };
  },
});
