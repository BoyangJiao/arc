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

import { keepPreviousData, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { insights, returns, type Currency, type Transaction } from "@arc/core";

import { resolveBenchmarkCloses } from "../benchmark-closes";
import { findEffectiveBucketFrom } from "../portfolio-snapshot-values";
import { resolvePortfolioValuesByDay } from "../resolve-portfolio-boundary-values";
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
    // Persisted via query-persister whitelist — cold start shows last result while
    // background refetch runs (offline-cache-stage-3 §决策 3).
    staleTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<BenchmarkBucketRow[]> => {
      const portfolio = portfolioQuery.data!;
      const transactions: ReadonlyArray<Transaction> = transactionsQuery.data ?? [];
      const snapshots: ReadonlyArray<PortfolioSnapshotPoint> = snapshotsQuery.data ?? [];
      const reportingCurrency: Currency = portfolio.reportingCurrency;

      const buckets = insights.calendarBuckets(granularity, bucketCountFor(granularity));
      if (buckets.length === 0) return [];
      const spanFrom = buckets[0]!.from;
      const spanTo = buckets[buckets.length - 1]!.to;
      const sortedSnaps = [...snapshots].sort((a, b) => a.asOf.localeCompare(b.asOf));

      // Effective bucket starts (calendar from may predate first snapshot → use in-bucket inception).
      const effectiveFromByKey = new Map<string, Date>();
      for (const b of buckets) {
        const effectiveFrom = findEffectiveBucketFrom(b, sortedSnaps, transactions);
        if (effectiveFrom) effectiveFromByKey.set(b.key, effectiveFrom);
      }

      // Collect all TWR boundary day keys across buckets (cash-flow aware per bucket).
      const dayKeys = new Set<string>();
      for (const b of buckets) {
        const effectiveFrom = effectiveFromByKey.get(b.key);
        if (!effectiveFrom) continue;
        const cfTimes = returns
          .detectCashFlowEvents(transactions, effectiveFrom, b.to)
          .map((e) => e.date.getTime());
        for (const k of collectBoundaryDayKeys(effectiveFrom, b.to, cfTimes)) {
          dayKeys.add(k);
        }
      }

      const valueByDay = await resolvePortfolioValuesByDay({
        portfolioId: portfolioId!,
        dayKeys: [...dayKeys],
        snapshots,
        transactions,
        reportingCurrency,
      });
      const valueAt = buildValueAt(valueByDay);

      const portfolioReturnByKey = new Map<string, number | null>();
      for (const b of buckets) {
        const effectiveFrom = effectiveFromByKey.get(b.key);
        if (!effectiveFrom) {
          portfolioReturnByKey.set(b.key, null);
          continue;
        }
        try {
          const r = returns.computePortfolioTwr({
            portfolioId: portfolioId!,
            reportingCurrency,
            from: effectiveFrom,
            to: b.to,
            transactions,
            valueAt,
          });
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
        const effectiveFrom = effectiveFromByKey.get(b.key);
        const fromISO = effectiveFrom
          ? effectiveFrom.toISOString().slice(0, 10)
          : b.from.toISOString().slice(0, 10);
        const toISO = b.to.toISOString().slice(0, 10);
        const benchmarkReturns: Record<string, number | null> = {};
        for (const id of benchmarkIds) {
          const closes = closesById.get(id) ?? null;
          const r = closes && effectiveFrom ? insights.bucketReturn(closes, fromISO, toISO) : null;
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
