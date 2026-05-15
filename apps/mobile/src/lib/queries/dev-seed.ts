/**
 * Dev Seed Data — mock data for development bypass mode.
 *
 * Only used when EXPO_PUBLIC_DEV_BYPASS_AUTH=true.
 * Provides a default portfolio + 3 transactions so the home screen
 * renders a realistic "with data" state during dev/QA.
 */

import Decimal from "decimal.js";
import type { Portfolio, Transaction } from "@arc/core";

const DEV_USER_ID = "dev-user-bypass";

export const DEV_PORTFOLIOS: Portfolio[] = [
  {
    id: "dev-portfolio-1",
    userId: DEV_USER_ID,
    name: "My Portfolio",
    reportingCurrency: "USD",
    createdAt: "2025-01-01T00:00:00Z",
  },
];

export const DEV_TRANSACTIONS: Transaction[] = [
  {
    id: "dev-tx-1",
    portfolioId: "dev-portfolio-1",
    assetId: "US:AAPL",
    type: "BUY",
    shares: new Decimal("10"),
    pricePerShare: new Decimal("189.50"),
    currency: "USD",
    fee: new Decimal("1.00"),
    tradeDate: "2025-03-15T10:00:00Z",
    notes: "Initial position",
  },
  {
    id: "dev-tx-2",
    portfolioId: "dev-portfolio-1",
    assetId: "US:MSFT",
    type: "BUY",
    shares: new Decimal("5"),
    pricePerShare: new Decimal("420.30"),
    currency: "USD",
    fee: new Decimal("1.00"),
    tradeDate: "2025-03-20T10:00:00Z",
  },
  {
    id: "dev-tx-3",
    portfolioId: "dev-portfolio-1",
    assetId: "US:NVDA",
    type: "BUY",
    shares: new Decimal("8"),
    pricePerShare: new Decimal("875.00"),
    currency: "USD",
    fee: new Decimal("2.00"),
    tradeDate: "2025-04-01T10:00:00Z",
    notes: "AI play",
  },
];
