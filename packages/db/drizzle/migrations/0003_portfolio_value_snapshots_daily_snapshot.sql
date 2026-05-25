-- Stage 2 J7 — Daily Snapshot feature
-- 见 .specify/feature-specs/stage-2/daily-snapshot-stage-2.md
--
-- Migration adds 3 columns to existing portfolio_value_snapshots (created in
-- 0000) so it can carry enough state for Daily Snapshot rendering — top-3
-- movers need per-asset breakdown, and cost basis tracks unrealized vs
-- realized split. Also enables RLS (never turned on for this table since
-- Stage 1 didn't read/write it).
--
-- All ADDs use DEFAULT so existing rows (if any) get safe values.

-- ─── New columns ────────────────────────────────────────────────────────────

ALTER TABLE "portfolio_value_snapshots"
  ADD COLUMN "total_cost_basis" numeric(28, 12) NOT NULL DEFAULT 0;

-- per_asset: jsonb array of { assetId, shares, valueNative, currency, valueReporting }
-- All numeric fields are Decimal-as-string (per CLAUDE.md §3.1, no number for money).
ALTER TABLE "portfolio_value_snapshots"
  ADD COLUMN "per_asset" jsonb NOT NULL DEFAULT '[]'::jsonb;

-- source provenance: 'edge-function' (cron) | 'manual' (seed/backfill)
ALTER TABLE "portfolio_value_snapshots"
  ADD COLUMN "source" text NOT NULL DEFAULT 'edge-function';

-- Add a CHECK so we don't accidentally invent new sources without thinking
ALTER TABLE "portfolio_value_snapshots"
  ADD CONSTRAINT "portfolio_value_snapshots_source_check"
  CHECK ("source" IN ('edge-function', 'manual'));

-- ─── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE "portfolio_value_snapshots" ENABLE ROW LEVEL SECURITY;

-- Users can read snapshots of their own portfolios.
-- Join through portfolios where portfolios.user_id = auth.uid().
CREATE POLICY "portfolio_value_snapshots_user_select"
  ON "portfolio_value_snapshots"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "portfolios"
      WHERE "portfolios"."id" = "portfolio_value_snapshots"."portfolio_id"
        AND "portfolios"."user_id" = (SELECT auth.uid())
    )
  );

-- INSERT/UPDATE/DELETE: service_role only (Edge Function uses service_role; client never writes).
-- Drizzle's `authenticated` role does NOT include INSERT here. Postgres default is "no policy = no access"
-- once RLS is on, so omitting an authenticated INSERT policy correctly locks writes to service_role only.

-- ─── Idempotency note for cron writes ───────────────────────────────────────
-- The Edge Function uses `INSERT … ON CONFLICT (portfolio_id, as_of) DO UPDATE`
-- to make re-runs safe. The existing PK on (portfolio_id, as_of) already
-- provides the conflict target. No migration change needed for that.
