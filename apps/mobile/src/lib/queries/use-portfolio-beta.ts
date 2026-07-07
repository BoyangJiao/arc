/**
 * usePortfolioBeta — risk-page beta (#11): the portfolio's β vs one benchmark.
 *
 * Pairs the portfolio's flow-free daily returns (cash-flow-neutral, same basis as
 * the volatility metric) with the benchmark proxy's price returns over the SAME
 * day windows, then `insights.beta`. Per #9 the portfolio side is reporting-
 * currency and the benchmark side is its own-currency price return. β is historical,
 * for-reference (宪法 §二). `null` when there isn't enough overlapping data.
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { insights } from "@arc/core";

import type { TimeRange } from "@arc/ui";

import { closeOnOrBefore, resolveBenchmarkCloses } from "../benchmark-closes";
import { buildHistoricalFxResolver } from "../historical-fx-resolver";
import { buildPortfolioRiskSeries } from "../portfolio-risk-series";
import { trimSnapshotsLeadingZeroTotals } from "../snapshot-asset-series";

import { usePortfolio } from "./use-portfolios";
import { usePortfolioValueSnapshots } from "./use-portfolio-value-snapshots";
import { useTransactions } from "./use-transactions";

export interface PortfolioBetaResult {
  /** β vs the benchmark, or null when undefined / insufficient overlap. */
  readonly beta: number | null;
  /** Number of paired daily observations behind β (for a low-confidence hint). */
  readonly sampleSize: number;
}

export interface UsePortfolioBetaInput {
  readonly portfolioId: string | undefined;
  readonly range: TimeRange;
  readonly benchmarkId: string;
}

const day = (iso: string): string => iso.slice(0, 10);

export const usePortfolioBeta = (
  input: UsePortfolioBetaInput
): UseQueryResult<PortfolioBetaResult, Error> => {
  const { portfolioId, range, benchmarkId } = input;

  const portfolioQuery = usePortfolio(portfolioId);
  const transactionsQuery = useTransactions(portfolioId);
  const snapshotsQuery = usePortfolioValueSnapshots(portfolioId, range);

  return useQuery({
    queryKey: ["portfolio-beta", portfolioId, range, benchmarkId],
    enabled:
      !!portfolioId &&
      portfolioQuery.isSuccess &&
      !!portfolioQuery.data &&
      transactionsQuery.isSuccess &&
      snapshotsQuery.isSuccess,
    staleTime: 30 * 60 * 1000,
    queryFn: async (): Promise<PortfolioBetaResult> => {
      const reportingCurrency = portfolioQuery.data!.reportingCurrency;
      const transactions = transactionsQuery.data ?? [];
      const trimmed = trimSnapshotsLeadingZeroTotals(snapshotsQuery.data ?? []);
      if (trimmed.length < 3) return { beta: null, sampleSize: 0 };

      const fxAt = await buildHistoricalFxResolver({ transactions, reportingCurrency });
      const series = buildPortfolioRiskSeries(trimmed, transactions, fxAt);
      const asOf = trimmed.map((s) => s.asOf);

      // Dated flow-free portfolio returns: each return spans (asOf[i-1], asOf[i]].
      const dated: { from: string; to: string; r: Decimal }[] = [];
      for (let i = 1; i < series.values.length; i++) {
        const prev = series.values[i - 1]!;
        if (prev.lessThanOrEqualTo(0)) continue;
        if (!series.flows[i]!.isZero()) continue; // drop trade days
        dated.push({
          from: day(asOf[i - 1]!),
          to: day(asOf[i]!),
          r: series.values[i]!.div(prev).minus(1),
        });
      }
      if (dated.length < 2) return { beta: null, sampleSize: 0 };

      const closes = await resolveBenchmarkCloses(
        benchmarkId,
        new Date(asOf[0]!),
        new Date(asOf[asOf.length - 1]!)
      );
      if (!closes || closes.length < 2) return { beta: null, sampleSize: 0 };

      const pairs: insights.ReturnPair[] = [];
      for (const d of dated) {
        const cf = closeOnOrBefore(closes, d.from);
        const ct = closeOnOrBefore(closes, d.to);
        if (!cf || !ct || cf.close.lessThanOrEqualTo(0)) continue;
        if (cf.date === ct.date) continue; // no benchmark move spanned → skip
        pairs.push({ portfolio: d.r, benchmark: ct.close.div(cf.close).minus(1) });
      }

      const b = insights.beta(pairs);
      return { beta: b ? b.toNumber() : null, sampleSize: pairs.length };
    },
  });
};
