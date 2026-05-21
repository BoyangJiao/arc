-- Stage 3 Block B — allow authenticated INSERT of manual dev/UAT snapshots
-- for portfolios the user owns. Edge cron (service_role) unchanged.
-- WITH CHECK: source must be 'manual' (see 0003 source_check).

CREATE POLICY "portfolio_value_snapshots_user_insert_manual"
  ON "portfolio_value_snapshots"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    "source" = 'manual'
    AND EXISTS (
      SELECT 1 FROM "portfolios"
      WHERE "portfolios"."id" = "portfolio_value_snapshots"."portfolio_id"
        AND "portfolios"."user_id" = (SELECT auth.uid())
    )
  );
