/**
 * @arc/data-sources — Arc 与外部行情/汇率数据源的唯一抽象层
 *
 * 业务代码统一从这里 import；绝不直接 fetch 厂商 API（CLAUDE.md §3.4）。
 *
 * Stage 1 提供：
 *   - PriceAdapter: Alpha Vantage（美股，free tier 25/day）
 *   - FxAdapter: Frankfurter（ECB，免费无 key）
 *   - SupabasePriceCache + SupabaseFxCache: read-first DB 缓存
 *   - fetchPriceWithCache + fetchFxWithCache: 业务首选 facade
 *   - createRegistry: market → adapter 路由
 *
 * Stage 3 扩展：CN/HK 用 Tushare、CRYPTO 用 CoinGecko、FUND 用天天基金 — 同接口
 * Stage 4 重构：cache 写入移到 Edge Function，client 只读
 */

export * from "./interfaces";
export * from "./errors";
export * from "./registry";
export { createCashPriceAdapter } from "./adapters/cash-adapter";
export * from "./fetch-with-cache";

export {
  createAlphaVantageAdapter,
  fetchAlphaVantageQuoteWithChange,
} from "./adapters/alphavantage";
export type { AlphaVantageAdapterConfig } from "./adapters/alphavantage";

export { searchStaticSymbols, US_STATIC_SYMBOLS } from "./static-symbols";
export type { StaticUsSymbol } from "./static-symbols";
export { searchSymbolsWithFallback } from "./search-symbols";
export { fetchWatchlistQuoteWithCache, WATCHLIST_QUOTE_FRESHNESS_MS } from "./watchlist-quote";
export type { WatchlistQuoteFields, FetchWatchlistQuoteParams } from "./watchlist-quote";

export { createFrankfurterAdapter } from "./adapters/frankfurter";
export type { FrankfurterAdapterConfig } from "./adapters/frankfurter";

export { createSupabasePriceCache } from "./cache/price-cache";
export { createSupabaseFxCache } from "./cache/fx-cache";
export { createMemoryPriceCache, createMemoryFxCache } from "./cache/memory-cache";

// Fixture (dev-only) adapters — ADR 008
export {
  createFixturePriceAdapter,
  createFixtureFxAdapter,
  createFixtureRegistry,
  type FixtureData,
  type FixtureQuote,
  type FixtureFxRate,
} from "./adapters/fixture-adapter";
