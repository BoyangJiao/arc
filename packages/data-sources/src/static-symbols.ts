/**
 * Top US tickers for watchlist symbol search (Path B — no AV quota).
 *
 * Stage 2: static list first; Alpha Vantage SYMBOL_SEARCH only when zero matches.
 * See .specify/feature-specs/stage-2/watchlist-stage-2.md §Resolved decisions #1.
 */

import { composeAssetId, type Currency } from "@arc/core";

import type { SymbolSearchResult } from "./interfaces";

export interface StaticUsSymbol {
  readonly symbol: string;
  readonly name: string;
}

/** Curated ~120 liquid US equities (S&P 100 + popular growth). */
export const US_STATIC_SYMBOLS: ReadonlyArray<StaticUsSymbol> = [
  { symbol: "AAPL", name: "Apple Inc." },
  { symbol: "MSFT", name: "Microsoft Corporation" },
  { symbol: "GOOGL", name: "Alphabet Inc. Class A" },
  { symbol: "GOOG", name: "Alphabet Inc. Class C" },
  { symbol: "AMZN", name: "Amazon.com Inc." },
  { symbol: "NVDA", name: "NVIDIA Corporation" },
  { symbol: "META", name: "Meta Platforms Inc." },
  { symbol: "TSLA", name: "Tesla Inc." },
  { symbol: "BRK.B", name: "Berkshire Hathaway Inc. Class B" },
  { symbol: "UNH", name: "UnitedHealth Group Inc." },
  { symbol: "JNJ", name: "Johnson & Johnson" },
  { symbol: "V", name: "Visa Inc." },
  { symbol: "XOM", name: "Exxon Mobil Corporation" },
  { symbol: "JPM", name: "JPMorgan Chase & Co." },
  { symbol: "WMT", name: "Walmart Inc." },
  { symbol: "MA", name: "Mastercard Inc." },
  { symbol: "PG", name: "Procter & Gamble Co." },
  { symbol: "HD", name: "Home Depot Inc." },
  { symbol: "CVX", name: "Chevron Corporation" },
  { symbol: "MRK", name: "Merck & Co. Inc." },
  { symbol: "ABBV", name: "AbbVie Inc." },
  { symbol: "KO", name: "Coca-Cola Co." },
  { symbol: "PEP", name: "PepsiCo Inc." },
  { symbol: "COST", name: "Costco Wholesale Corporation" },
  { symbol: "AVGO", name: "Broadcom Inc." },
  { symbol: "LLY", name: "Eli Lilly and Co." },
  { symbol: "ORCL", name: "Oracle Corporation" },
  { symbol: "AMD", name: "Advanced Micro Devices Inc." },
  { symbol: "CRM", name: "Salesforce Inc." },
  { symbol: "NFLX", name: "Netflix Inc." },
  { symbol: "ADBE", name: "Adobe Inc." },
  { symbol: "INTC", name: "Intel Corporation" },
  { symbol: "QCOM", name: "QUALCOMM Inc." },
  { symbol: "TXN", name: "Texas Instruments Inc." },
  { symbol: "AMAT", name: "Applied Materials Inc." },
  { symbol: "MU", name: "Micron Technology Inc." },
  { symbol: "LRCX", name: "Lam Research Corporation" },
  { symbol: "KLAC", name: "KLA Corporation" },
  { symbol: "SNPS", name: "Synopsys Inc." },
  { symbol: "CDNS", name: "Cadence Design Systems Inc." },
  { symbol: "PANW", name: "Palo Alto Networks Inc." },
  { symbol: "CRWD", name: "CrowdStrike Holdings Inc." },
  { symbol: "NOW", name: "ServiceNow Inc." },
  { symbol: "UBER", name: "Uber Technologies Inc." },
  { symbol: "ABNB", name: "Airbnb Inc." },
  { symbol: "SQ", name: "Block Inc." },
  { symbol: "PYPL", name: "PayPal Holdings Inc." },
  { symbol: "SHOP", name: "Shopify Inc." },
  { symbol: "COIN", name: "Coinbase Global Inc." },
  { symbol: "HOOD", name: "Robinhood Markets Inc." },
  { symbol: "PLTR", name: "Palantir Technologies Inc." },
  { symbol: "SNOW", name: "Snowflake Inc." },
  { symbol: "DDOG", name: "Datadog Inc." },
  { symbol: "NET", name: "Cloudflare Inc." },
  { symbol: "ZM", name: "Zoom Video Communications Inc." },
  { symbol: "ROKU", name: "Roku Inc." },
  { symbol: "DIS", name: "Walt Disney Co." },
  { symbol: "CMCSA", name: "Comcast Corporation" },
  { symbol: "T", name: "AT&T Inc." },
  { symbol: "VZ", name: "Verizon Communications Inc." },
  { symbol: "BAC", name: "Bank of America Corp." },
  { symbol: "WFC", name: "Wells Fargo & Co." },
  { symbol: "GS", name: "Goldman Sachs Group Inc." },
  { symbol: "MS", name: "Morgan Stanley" },
  { symbol: "C", name: "Citigroup Inc." },
  { symbol: "AXP", name: "American Express Co." },
  { symbol: "BLK", name: "BlackRock Inc." },
  { symbol: "SCHW", name: "Charles Schwab Corporation" },
  { symbol: "SPGI", name: "S&P Global Inc." },
  { symbol: "ICE", name: "Intercontinental Exchange Inc." },
  { symbol: "CME", name: "CME Group Inc." },
  { symbol: "CAT", name: "Caterpillar Inc." },
  { symbol: "DE", name: "Deere & Co." },
  { symbol: "BA", name: "Boeing Co." },
  { symbol: "GE", name: "GE Aerospace" },
  { symbol: "RTX", name: "RTX Corporation" },
  { symbol: "LMT", name: "Lockheed Martin Corporation" },
  { symbol: "NOC", name: "Northrop Grumman Corporation" },
  { symbol: "GM", name: "General Motors Co." },
  { symbol: "F", name: "Ford Motor Co." },
  { symbol: "RIVN", name: "Rivian Automotive Inc." },
  { symbol: "LCID", name: "Lucid Group Inc." },
  { symbol: "NKE", name: "Nike Inc." },
  { symbol: "SBUX", name: "Starbucks Corporation" },
  { symbol: "MCD", name: "McDonald's Corporation" },
  { symbol: "LOW", name: "Lowe's Companies Inc." },
  { symbol: "TGT", name: "Target Corporation" },
  { symbol: "BKNG", name: "Booking Holdings Inc." },
  { symbol: "MAR", name: "Marriott International Inc." },
  { symbol: "HLT", name: "Hilton Worldwide Holdings Inc." },
  { symbol: "UNP", name: "Union Pacific Corporation" },
  { symbol: "UPS", name: "United Parcel Service Inc." },
  { symbol: "FDX", name: "FedEx Corporation" },
  { symbol: "LIN", name: "Linde plc" },
  { symbol: "APD", name: "Air Products and Chemicals Inc." },
  { symbol: "NEE", name: "NextEra Energy Inc." },
  { symbol: "DUK", name: "Duke Energy Corporation" },
  { symbol: "SO", name: "Southern Co." },
  { symbol: "AMGN", name: "Amgen Inc." },
  { symbol: "GILD", name: "Gilead Sciences Inc." },
  { symbol: "REGN", name: "Regeneron Pharmaceuticals Inc." },
  { symbol: "VRTX", name: "Vertex Pharmaceuticals Inc." },
  { symbol: "BMY", name: "Bristol-Myers Squibb Co." },
  { symbol: "PFE", name: "Pfizer Inc." },
  { symbol: "TMO", name: "Thermo Fisher Scientific Inc." },
  { symbol: "DHR", name: "Danaher Corporation" },
  { symbol: "ISRG", name: "Intuitive Surgical Inc." },
  { symbol: "MDT", name: "Medtronic plc" },
  { symbol: "SPY", name: "SPDR S&P 500 ETF Trust" },
  { symbol: "QQQ", name: "Invesco QQQ Trust" },
  { symbol: "IEF", name: "iShares 7-10 Year Treasury Bond ETF" },
  { symbol: "TLT", name: "iShares 20+ Year Treasury Bond ETF" },
  { symbol: "GLD", name: "SPDR Gold Shares" },
  { symbol: "IWM", name: "iShares Russell 2000 ETF" },
  { symbol: "DIA", name: "SPDR Dow Jones Industrial Average ETF" },
  { symbol: "VOO", name: "Vanguard S&P 500 ETF" },
  { symbol: "VTI", name: "Vanguard Total Stock Market ETF" },
  { symbol: "ARKK", name: "ARK Innovation ETF" },
  { symbol: "SOXL", name: "Direxion Daily Semiconductor Bull 3X Shares" },
  { symbol: "TQQQ", name: "ProShares UltraPro QQQ" },
  { symbol: "SQQQ", name: "ProShares UltraPro Short QQQ" },
  { symbol: "NVDS", name: "Tradr 2X Short NVDA Daily ETF" },
] as const;

const toResult = (row: StaticUsSymbol): SymbolSearchResult => ({
  symbol: row.symbol,
  name: row.name,
  market: "US",
  currency: "USD" as Currency,
  assetId: composeAssetId("US", row.symbol),
});

/**
 * Case-insensitive prefix match on symbol, or substring match on name.
 */
export const searchStaticSymbols = (
  query: string,
  limit = 20
): ReadonlyArray<SymbolSearchResult> => {
  const q = query.trim();
  if (!q) return [];

  const upper = q.toUpperCase();
  const lower = q.toLowerCase();

  const matches = US_STATIC_SYMBOLS.filter((row) => {
    const sym = row.symbol.toUpperCase();
    if (sym.startsWith(upper)) return true;
    return row.name.toLowerCase().includes(lower);
  });

  return matches.slice(0, limit).map(toResult);
};
