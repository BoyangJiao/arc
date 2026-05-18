-- Stage 2 J9 — Rebalance feature
-- 见 .specify/feature-specs/rebalance-stage-2.md
--
-- ⚠️ Postgres `ALTER TYPE ... ADD VALUE` 不能与同一 transaction 内使用该新枚举值
-- 的其他语句共存。Supabase SQL Editor 默认整段当一个事务，因此本文件分为 3 个
-- 独立批次（用 `;` + 空行隔开）。手动一次性贴入也安全 — PG ≥ 12 支持 ADD VALUE
-- 立即可见。
--
-- 验收：
--   SELECT count(*) FROM pg_policies WHERE tablename = 'target_allocations';  -- 4
--   SELECT count(*) FROM assets WHERE market = 'CASH';                       -- 4
--   SELECT enumlabel FROM pg_enum WHERE enumtypid = 'market'::regtype;         -- 含 CASH

-- ─── BATCH 1: extend market_enum ────────────────────────────────────────────

ALTER TYPE "market" ADD VALUE IF NOT EXISTS 'CASH';

-- ─── BATCH 2: target_allocations table + RLS ───────────────────────────────

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

-- ─── BATCH 3: CASH asset seed ───────────────────────────────────────────────

INSERT INTO "assets" ("id", "market", "symbol", "name", "currency") VALUES
  ('CASH:USD', 'CASH', 'USD', '美元现金', 'USD'),
  ('CASH:CNY', 'CASH', 'CNY', '人民币现金', 'CNY'),
  ('CASH:HKD', 'CASH', 'HKD', '港元现金', 'HKD'),
  ('CASH:JPY', 'CASH', 'JPY', '日元现金', 'JPY')
ON CONFLICT ("id") DO NOTHING;
