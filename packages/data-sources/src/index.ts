import type Decimal from "decimal.js";

export interface PriceQuote {
  assetId: string;
  price: Decimal;
  currency: string;
  timestamp: number;
  isDelayed: boolean;
}

export interface FxRate {
  from: string;
  to: string;
  rate: Decimal;
  date: string;
}

// All market data must flow through this adapter interface.
// Never call vendor APIs directly from business code.
export interface MarketDataAdapter {
  getQuote(assetId: string): Promise<PriceQuote>;
  getHistoricalPrices(assetId: string, from: string, to: string): Promise<PriceQuote[]>;
}

export interface FxAdapter {
  getRate(from: string, to: string, date?: string): Promise<FxRate>;
}
