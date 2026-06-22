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
import { ALLOCATION_PALETTE } from "@arc/ui";

export interface Benchmark {
  /** Stable id (persisted, UI key). */
  readonly id: string;
  /** i18n suffix → `insights.benchmark.names.<nameKey>`. */
  readonly nameKey: string;
  /** Existing-adapter asset whose close series proxies this benchmark. */
  readonly proxyAssetId: string;
  /** FIXED bar/legend color (hex, distinct hue) — stable per benchmark, not by position. */
  readonly color: string;
}

/** Max benchmarks selectable on the detail page (grouped bar chart). */
export const MAX_BENCHMARK_SELECTION = 2;

/** Cap = all catalog benchmarks (no artificial 2-limit; user picks any subset). */
export const MAX_BENCHMARKS = 5;

/** Entry-card preview: quarter buckets vs 沪深300 + 中证500. */
export const ENTRY_PREVIEW_GRANULARITY = "quarter" as const;
export const ENTRY_PREVIEW_BENCHMARK_IDS: readonly string[] = ["CSI300", "CSI500"];

/** Detail page initial selection (ephemeral — reset each visit). */
export const DEFAULT_DETAIL_BENCHMARK_IDS: readonly string[] = ["CSI300", "CSI500"];

/** 本组合 series color — distinct from every benchmark. */
export const PORTFOLIO_COLOR = ALLOCATION_PALETTE[0]!;

const c = (i: number): string => ALLOCATION_PALETTE[i % ALLOCATION_PALETTE.length]!;

export const BENCHMARKS: readonly Benchmark[] = [
  { id: "CSI300", nameKey: "CSI300", proxyAssetId: "FUND:510300", color: c(1) }, // 沪深300 → 华泰柏瑞300ETF
  { id: "CSI500", nameKey: "CSI500", proxyAssetId: "FUND:510500", color: c(2) }, // 中证500 → 南方500ETF
  { id: "SPX", nameKey: "SPX", proxyAssetId: "US:SPY", color: c(3) }, // 标普500 → SPY
  { id: "NDX", nameKey: "NDX", proxyAssetId: "US:QQQ", color: c(4) }, // 纳指100 → QQQ
  { id: "HSI", nameKey: "HSI", proxyAssetId: "FUND:159920", color: c(5) }, // 恒生 → 华夏恒生ETF
];

export const benchmarkById = (id: string): Benchmark | undefined =>
  BENCHMARKS.find((b) => b.id === id);

/** Default benchmark by the portfolio's reporting currency. */
export const defaultBenchmarkId = (currency: Currency): string => {
  if (currency === "CNY") return "CSI300";
  if (currency === "HKD") return "HSI";
  return "SPX";
};
