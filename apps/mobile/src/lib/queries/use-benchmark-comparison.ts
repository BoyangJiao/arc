/**
 * useBenchmarkComparison — 指数对标 (#9): per calendar bucket (月/季度/年),
 * portfolio TWR vs each selected benchmark's price return.
 *
 * Portfolio side = per-bucket `computePortfolioTwr` (D4, time-weighted) over the
 * bucket window, with `valueAt` resolved from snapshots + computeValuationAtDate.
 * Benchmark side = `bucketReturn` over the proxy ETF's close series (ADR 017 dev
 * proxies; existing adapters). Returns percent numbers (chart-ready); null when a
 * bucket lacks data. Benchmark fetch failures degrade to null (no throw).
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { insights, parseAssetId, returns, type Currency, type Transaction } from "@arc/core";

import { benchmarkById } from "../benchmark-catalog";
import { getRegistry } from "../market-data";
import { buildValueAt, collectBoundaryDayKeys } from "../twr-day-lookup";

import { usePortfolio } from "./use-portfolios";
import {
  usePortfolioValueSnapshots,
  type PortfolioSnapshotPoint,
} from "./use-portfolio-value-snapshots";
import { useTransactions } from "./use-transactions";

type BucketGranularity = insights.BucketGranularity;
type IndexClose = insights.IndexClose;

export interface BenchmarkBucketRow {
  readonly key: string;
  readonly label: string;
  /** Portfolio TWR for the bucket as a percent (e.g. 12.3), or null. */
  readonly portfolioReturn: number | null;
  /** benchmarkId → bucket price return percent, or null. */
  readonly benchmarkReturns: Record<string, number | null>;
}

export interface UseBenchmarkComparisonInput {
  readonly portfolioId: string | undefined;
  readonly granularity: BucketGranularity;
  readonly benchmarkIds: ReadonlyArray<string>;
}

const bucketCountFor = (g: BucketGranularity): number => (g === "year" ? 5 : 6);

const labelFor = (from: Date, g: BucketGranularity): string => {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();
  if (g === "year") return `${y}`;
  if (g === "quarter") return `Q${Math.floor(m / 3) + 1} ${String(y).slice(2)}`;
  return `${y}/${String(m + 1).padStart(2, "0")}`;
};

const resolveBenchmarkCloses = async (
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
    return null; // degrade to absent benchmark bars
  }
};

export const useBenchmarkComparison = (
  input: UseBenchmarkComparisonInput
): UseQueryResult<BenchmarkBucketRow[], Error> => {
  const { portfolioId, granularity, benchmarkIds } = input;

  const portfolioQuery = usePortfolio(portfolioId);
  const transactionsQuery = useTransactions(portfolioId);
  const snapshotsQuery = usePortfolioValueSnapshots(portfolioId, "ALL");

  return useQuery({
    queryKey: [
      "benchmark-comparison",
      portfolioId,
      granularity,
      [...benchmarkIds].sort().join(","),
    ],
    enabled:
      !!portfolioId &&
      portfolioQuery.isSuccess &&
      !!portfolioQuery.data &&
      transactionsQuery.isSuccess &&
      snapshotsQuery.isSuccess,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<BenchmarkBucketRow[]> => {
      const portfolio = portfolioQuery.data!;
      const transactions: ReadonlyArray<Transaction> = transactionsQuery.data ?? [];
      const snapshots: ReadonlyArray<PortfolioSnapshotPoint> = snapshotsQuery.data ?? [];
      const reportingCurrency: Currency = portfolio.reportingCurrency;

      const buckets = insights.calendarBuckets(granularity, bucketCountFor(granularity));
      if (buckets.length === 0) return [];
      const spanFrom = buckets[0]!.from;
      const spanTo = buckets[buckets.length - 1]!.to;

      // ── portfolio per-bucket TWR ──────────────────────────────────────────
      const txTimes = transactions
        .map((t) => new Date(t.tradeDate).getTime())
        .filter((ms) => ms >= spanFrom.getTime() && ms <= spanTo.getTime());
      const dayKeys = new Set<string>();
      for (const b of buckets) {
        for (const k of collectBoundaryDayKeys(b.from, b.to, txTimes)) dayKeys.add(k);
      }
      // Forward-fill from the EOD snapshot series (no network / no throws — robust at
      // calendar boundaries that fall on holidays). 0 before the first snapshot.
      const sortedSnaps = [...snapshots].sort((a, b) => a.asOf.localeCompare(b.asOf));
      const valueOnOrBefore = (dayKey: string): Decimal => {
        let value = new Decimal(0);
        for (const s of sortedSnaps) {
          if (s.asOf.slice(0, 10) <= dayKey) value = s.totalValue;
          else break;
        }
        return value;
      };
      const valueByDay = new Map<string, Decimal>();
      for (const dayKey of dayKeys) valueByDay.set(dayKey, valueOnOrBefore(dayKey));
      const valueAt = buildValueAt(valueByDay);

      const portfolioReturnByKey = new Map<string, number | null>();
      for (const b of buckets) {
        try {
          const r = returns.computePortfolioTwr({
            portfolioId: portfolioId!,
            reportingCurrency,
            from: b.from,
            to: b.to,
            transactions,
            valueAt,
          });
          // No holdings at/over the bucket → not meaningful.
          portfolioReturnByKey.set(
            b.key,
            r.startValue.isZero() ? null : r.value.times(100).toNumber()
          );
        } catch {
          portfolioReturnByKey.set(b.key, null);
        }
      }

      // ── benchmark per-bucket price return ─────────────────────────────────
      const closesById = new Map<string, IndexClose[] | null>();
      await Promise.all(
        benchmarkIds.map(async (id) =>
          closesById.set(id, await resolveBenchmarkCloses(id, spanFrom, spanTo))
        )
      );

      return buckets.map((b) => {
        const fromISO = b.from.toISOString().slice(0, 10);
        const toISO = b.to.toISOString().slice(0, 10);
        const benchmarkReturns: Record<string, number | null> = {};
        for (const id of benchmarkIds) {
          const closes = closesById.get(id) ?? null;
          const r = closes ? insights.bucketReturn(closes, fromISO, toISO) : null;
          benchmarkReturns[id] = r ? r.times(100).toNumber() : null;
        }
        return {
          key: b.key,
          label: labelFor(b.from, granularity),
          portfolioReturn: portfolioReturnByKey.get(b.key) ?? null,
          benchmarkReturns,
        };
      });
    },
  });
};
