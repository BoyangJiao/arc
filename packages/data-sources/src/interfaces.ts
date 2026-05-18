/**
 * Data source adapter interfaces — Arc 与外部 API 的唯一抽象边界
 *
 * CLAUDE.md §3.4 / ADR 001 §数据源约束：
 *   业务代码（apps/mobile / packages/core）**只能** 通过这些接口访问行情/汇率数据。
 *   绝不在业务代码中直接 fetch 厂商 API。
 *
 * 类型契约：
 *   - 所有接口返回的 PriceQuote / FxRate 与 packages/core 的 domain types 严格对齐
 *   - 任何 numeric 字段一律 Decimal（CLAUDE.md §3.1）
 *   - timestamps 用 ISO 8601 string + 时区
 *
 * 失败处理：
 *   - 所有 adapter 错误必须抛 `AdapterError` 子类（见 errors.ts），便于上层
 *     按错误类型分流（重试、降级、向用户报错）
 */

import type { Currency, FxRate, Market, PriceQuote } from "@arc/core";

/** SYMBOL_SEARCH / static list row — Stage 2 US watchlist search. */
export interface SymbolSearchResult {
  readonly assetId: string;
  readonly symbol: string;
  readonly name: string;
  readonly market: Market;
  readonly currency: Currency;
}

/**
 * PriceAdapter — 单一市场的实时/历史价格数据源
 *
 * 一个 adapter 只服务一个 Market（如 Alpha Vantage 只做 US；Tushare 只做 CN/HK）。
 * 跨市场路由由 registry.ts 负责。
 */
export interface PriceAdapter {
  /** 该 adapter 服务的市场（路由器据此匹配 asset） */
  readonly market: Market;
  /** 数据源稳定标识（写入 price_snapshots.source 列）*/
  readonly source: string;

  /**
   * 拉取该 market 内某 symbol 的最新价。
   *
   * @param symbol 不含 market 前缀（如 "AAPL"，不是 "US:AAPL"）
   * @throws AdapterError 网络/限流/解析任一失败
   */
  fetchLatest(symbol: string): Promise<PriceQuote>;

  /**
   * 拉取历史日线（Stage 3 才会真正用到）。
   *
   * Stage 1 adapter 可以不实现（接口侧变 optional），抛 NotImplementedError。
   */
  fetchHistorical?(symbol: string, from: Date, to: Date): Promise<ReadonlyArray<PriceQuote>>;

  /**
   * Symbol search (Stage 2 J8 US watchlist). Optional — registry may omit for markets
   * without search support. Prefer `searchSymbolsWithFallback` for static-first routing.
   */
  searchSymbols?(query: string): Promise<ReadonlyArray<SymbolSearchResult>>;
}

/**
 * FxAdapter — 货币兑换率数据源
 *
 * Stage 1 只用 Frankfurter（ECB 日终）；Stage 3 可加实时商业级数据源。
 */
export interface FxAdapter {
  readonly source: string;

  /**
   * 拉取 from→to 的最新汇率。`rate` 表示 1 单位 from 等于多少 to。
   *
   * @throws AdapterError
   */
  fetchRate(from: Currency, to: Currency): Promise<FxRate>;

  /**
   * 拉取历史 from→to 的某日汇率（Stage 3 历史持仓估值用）。
   *
   * @stub 适用 Stage 3
   */
  fetchHistoricalRate?(from: Currency, to: Currency, date: Date): Promise<FxRate>;
}

/**
 * Cache façade — 先查 DB cache，过期/未命中再走 adapter。
 *
 * 实现见 packages/data-sources/src/cache/。
 * Mobile 端通过 DI 注入 SupabaseClient（不直接 import singleton，便于测试 mock）。
 */
export interface PriceCache {
  /**
   * @returns 命中且未过期的 PriceQuote；否则 null（调用方 fallback 到 adapter）
   * `PriceQuote.changePercent` 若存在则来自缓存（自选涨跌幅展示）。
   */
  get(assetId: string, freshnessMs: number): Promise<PriceQuote | null>;
  set(quote: PriceQuote): Promise<void>;
}

export interface FxCache {
  get(from: Currency, to: Currency, freshnessMs: number): Promise<FxRate | null>;
  set(rate: FxRate): Promise<void>;
}
