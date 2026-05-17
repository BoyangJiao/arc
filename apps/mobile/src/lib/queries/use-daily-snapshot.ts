/**
 * useDailySnapshot — read the most-recent `portfolio_value_snapshots` row
 * for a portfolio (the baseline for today's Daily Snapshot card).
 *
 * Stage 2 J7. Returns null when no snapshot exists yet (first day of use).
 * Decimal fields are revived from string DB columns (per CLAUDE.md §3.1 +
 * ADR 007 — no `number` for money).
 *
 * Why latest-before-today, not specifically yesterday:
 *   The Edge Function writes at 23:00 UTC daily, but real users miss days
 *   (offline / app deleted / etc). The card compares against the most
 *   recent baseline regardless of age, surfacing "N days ago" in the UI
 *   when the gap is unusual. Spec §UI contract handles that state.
 *
 * RLS: SELECT policy on portfolio_value_snapshots (migration 0003) requires
 * the user own the portfolio; client uses the anon key, so users can't
 * read other users' snapshots.
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import Decimal from "decimal.js";
import type { Currency, PortfolioDailySnapshot, SnapshotAsset } from "@arc/core";

import { useAuth } from "../auth";
import { supabase } from "../supabase";

interface DBSnapshotRow {
  portfolio_id: string;
  as_of: string;
  total_value: string;
  total_cost_basis: string;
  reporting_currency: Currency;
  per_asset: ReadonlyArray<{
    assetId: string;
    shares: string;
    valueNative: string;
    currency: Currency;
    valueReporting: string;
  }>;
  source: "edge-function" | "manual";
  created_at: string;
}

const reviveSnapshotAsset = (row: DBSnapshotRow["per_asset"][number]): SnapshotAsset => ({
  assetId: row.assetId,
  shares: new Decimal(row.shares),
  valueNative: new Decimal(row.valueNative),
  currency: row.currency,
  valueReporting: new Decimal(row.valueReporting),
});

const reviveSnapshot = (row: DBSnapshotRow): PortfolioDailySnapshot => ({
  portfolioId: row.portfolio_id,
  asOf: row.as_of,
  reportingCurrency: row.reporting_currency,
  totalValue: new Decimal(row.total_value),
  totalCostBasis: new Decimal(row.total_cost_basis),
  perAsset: Array.isArray(row.per_asset) ? row.per_asset.map(reviveSnapshotAsset) : [],
  source: row.source,
  createdAt: row.created_at,
});

/**
 * Returns the most recent snapshot before NOW (or `null` if none exists).
 *
 * `null` is a legitimate result — UI shows the "no-baseline" placeholder
 * state for it. Don't treat it as an error.
 */
export const useDailySnapshot = (
  portfolioId: string | undefined
): UseQueryResult<PortfolioDailySnapshot | null, Error> => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["dailySnapshot", portfolioId, user?.id],
    enabled: !!user && !!portfolioId,
    // Snapshots only change once a day. Cache aggressively — the card
    // doesn't need re-fetching during a session.
    staleTime: 60 * 60_000, // 1h
    gcTime: 24 * 60 * 60_000, // 24h
    queryFn: async (): Promise<PortfolioDailySnapshot | null> => {
      if (!portfolioId) return null;

      const { data, error } = await supabase
        .from("portfolio_value_snapshots")
        .select(
          "portfolio_id, as_of, total_value, total_cost_basis, reporting_currency, per_asset, source, created_at"
        )
        .eq("portfolio_id", portfolioId)
        .lt("as_of", new Date().toISOString())
        .order("as_of", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }
      if (!data) return null;

      return reviveSnapshot(data as DBSnapshotRow);
    },
  });
};
