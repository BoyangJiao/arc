/**
 * Benchmark close-series resolution for 指数对标 (#9) and risk beta (#11).
 *
 * A benchmark resolves to a tradeable ETF proxy (benchmark-catalog.ts, ADR 017
 * dev sources) served by the EXISTING price adapters. Fetch failures degrade to
 * `null` so a missing benchmark just renders absent, never throws.
 */

import { parseAssetId, type insights } from "@arc/core";

import { benchmarkById } from "./benchmark-catalog";
import { getRegistry } from "./market-data";

type IndexClose = insights.IndexClose;

export const resolveBenchmarkCloses = async (
  id: string,
  from: Date,
  to: Date
): Promise<IndexClose[] | null> => {
  const bm = benchmarkById(id);
  if (!bm) return null;
  try {
    const adapter = getRegistry().resolvePriceAdapterByAssetId(bm.proxyAssetId);
    if (!adapter.fetchHistorical) return null;
    const { symbol } = parseAssetId(bm.proxyAssetId);
    const quotes = await adapter.fetchHistorical(symbol, from, to);
    return quotes.map((q) => ({ date: q.asOf.slice(0, 10), close: q.price }));
  } catch {
    return null; // degrade to absent benchmark
  }
};

/**
 * Latest close on or before `iso` (closes assumed ascending by ISO date) —
 * forward-fills a non-trading day to the last trading close. `null` if no close
 * is on/before the date.
 */
export const closeOnOrBefore = (
  closes: ReadonlyArray<IndexClose>,
  iso: string
): IndexClose | null => {
  let hit: IndexClose | null = null;
  for (const c of closes) {
    if (c.date > iso) break;
    hit = c;
  }
  return hit;
};
