/**
 * @arc/data-sources — Arc 与外部行情/汇率数据源的唯一抽象层
 *
 * 业务代码统一从这里 import；绝不直接 fetch 厂商 API（CLAUDE.md §3.4）。
 *
 * Stage 1 提供：
 *   - PriceAdapter: Finnhub（美股，free tier 60/min）；Alpha Vantage 保留回滚
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

export { createFinnhubAdapter } from "./adapters/finnhub";
export type { FinnhubAdapterConfig } from "./adapters/finnhub";

export { createUsPriceAdapter } from "./adapters/us-price-adapter";
export type { UsPriceAdapterConfig } from "./adapters/us-price-adapter";

export { createTushareClient, assertTushareRowsNonEmpty } from "./adapters/tushare/client";
export type { TushareClient, TushareClientConfig, TushareRows } from "./adapters/tushare/client";
export { createTushareCnAdapter } from "./adapters/tushare/cn";
export type { TushareCnAdapterConfig } from "./adapters/tushare/cn";
export {
  cnSymbolToTsCode,
  hkSymbolToTsCode,
  fundSymbolToTsCode,
  tsCodeToSymbol,
} from "./adapters/tushare/symbol-resolver";

export {
  createAkshareClient,
  createAkshareCnAdapter,
  createAkshareHkAdapter,
  createAkshareFundAdapter,
} from "./adapters/akshare";
export type { AkshareClient, AkshareClientConfig } from "./adapters/akshare";

export { withFallback, defaultFallbackClassifier } from "./adapters/with-fallback";
export type { FallbackDecision } from "./adapters/with-fallback";

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
