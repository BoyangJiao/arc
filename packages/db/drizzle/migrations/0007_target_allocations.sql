-- Stage 2 J9 — Rebalance (step 2/3)
-- 前置：0006_market_enum_cash.sql 已成功提交。
-- Supabase SQL Editor：单独执行本文件。

CREATE TABLE "target_allocations" (
  "id"              uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  "portfolio_id"    uuid           NOT NULL REFERENCES "portfolios"("id") ON DELETE CASCADE,
  "asset_id"        text           NOT NULL REFERENCES "assets"("id"),
  "target_percent"  numeric(28, 12) NOT NULL,
  "updated_at"      timestamptz    NOT NULL DEFAULT now(),
  CONSTRAINT "target_allocations_percent_range"
    CHECK ("target_percent" >= 0 AND "target_percent" <= 100)
);

CREATE UNIQUE INDEX "target_allocations_portfolio_asset_uniq"
  ON "target_allocations" ("portfolio_id", "asset_id");

CREATE INDEX "target_allocations_portfolio_id_idx"
  ON "target_allocations" ("portfolio_id");

ALTER TABLE "target_allocations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "target_allocations_user_select"
  ON "target_allocations"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "portfolios"
      WHERE "portfolios"."id" = "target_allocations"."portfolio_id"
        AND "portfolios"."user_id" = (SELECT auth.uid())
    )
  );

CREATE POLICY "target_allocations_user_insert"
  ON "target_allocations"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "portfolios"
      WHERE "portfolios"."id" = "target_allocations"."portfolio_id"
        AND "portfolios"."user_id" = (SELECT auth.uid())
    )
  );

CREATE POLICY "target_allocations_user_update"
  ON "target_allocations"
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "portfolios"
      WHERE "portfolios"."id" = "target_allocations"."portfolio_id"
        AND "portfolios"."user_id" = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "portfolios"
      WHERE "portfolios"."id" = "target_allocations"."portfolio_id"
        AND "portfolios"."user_id" = (SELECT auth.uid())
    )
  );

CREATE POLICY "target_allocations_user_delete"
  ON "target_allocations"
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "portfolios"
      WHERE "portfolios"."id" = "target_allocations"."portfolio_id"
        AND "portfolios"."user_id" = (SELECT auth.uid())
    )
  );
