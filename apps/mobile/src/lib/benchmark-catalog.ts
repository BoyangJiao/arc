/**
 * Benchmark catalog for 指数对标 (insights #9).
 *
 * ADR 017: dev sources only — each benchmark resolves to a tradeable ETF *proxy*
 * served by the EXISTING price adapters (akshare us/etf), so 指数对标 needs zero
 * new data plumbing in dev. Prod can swap a proxy for a licensed raw-index series
 * behind the same id (benchmark id is stable; only `proxyAssetId` changes).
 *
 * Returns are unit-less %, so the proxy's listing currency is irrelevant.
 */

import type { Currency } from "@arc/core";

export interface Benchmark {
  /** Stable id (persisted, UI key). */
  readonly id: string;
  /** i18n suffix → `insights.benchmark.names.<nameKey>`. */
  readonly nameKey: string;
  /** Existing-adapter asset whose close series proxies this benchmark. */
  readonly proxyAssetId: string;
}

/** Up to 2 benchmarks compared at once (Delta parity). */
export const MAX_BENCHMARKS = 2;

export const BENCHMARKS: readonly Benchmark[] = [
  { id: "CSI300", nameKey: "CSI300", proxyAssetId: "FUND:510300" }, // 沪深300 → 华泰柏瑞300ETF
  { id: "CSI500", nameKey: "CSI500", proxyAssetId: "FUND:510500" }, // 中证500 → 南方500ETF
  { id: "SPX", nameKey: "SPX", proxyAssetId: "US:SPY" }, // 标普500 → SPY
  { id: "NDX", nameKey: "NDX", proxyAssetId: "US:QQQ" }, // 纳指100 → QQQ
  { id: "HSI", nameKey: "HSI", proxyAssetId: "FUND:159920" }, // 恒生 → 华夏恒生ETF
];

export const benchmarkById = (id: string): Benchmark | undefined =>
  BENCHMARKS.find((b) => b.id === id);

/** Default benchmark by the portfolio's reporting currency. */
export const defaultBenchmarkId = (currency: Currency): string => {
  if (currency === "CNY") return "CSI300";
  if (currency === "HKD") return "HSI";
  return "SPX";
};
