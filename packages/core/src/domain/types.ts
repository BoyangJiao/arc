import Decimal from "decimal.js";

export type Market = "CN" | "HK" | "US" | "CRYPTO" | "FUND";
export type Currency = "CNY" | "HKD" | "USD" | "BTC" | "ETH";
export type TransactionType = "BUY" | "SELL" | "DIVIDEND" | "SPLIT";

export interface Asset {
  id: string; // format: "{market}:{symbol}", e.g. "CN:600519"
  market: Market;
  symbol: string;
  name: string;
  currency: Currency;
}

export interface Transaction {
  id: string;
  assetId: string;
  type: TransactionType;
  shares: Decimal;
  pricePerShare: Decimal;
  currency: Currency;
  fxRateUsed: Decimal; // rate to report currency at trade time
  tradeDate: string; // ISO date string
  notes?: string;
}

export interface Holding {
  assetId: string;
  shares: Decimal;
  averageCost: Decimal;
  currency: Currency;
}

export interface Portfolio {
  id: string;
  name: string;
  reportCurrency: Currency;
  holdings: Holding[];
  targetAllocations?: TargetAllocation[];
}

export interface TargetAllocation {
  assetId: string;
  targetPercent: Decimal; // 0–100
}
