-- Stage 3 Block B — soft-archive portfolios (decision 6).
-- NULL = active; non-NULL = archived (hidden from default queries, history retained).

ALTER TABLE "portfolios"
  ADD COLUMN "archived_at" timestamptz NULL;

CREATE INDEX "portfolios_archived_at_idx" ON "portfolios" ("archived_at")
  WHERE "archived_at" IS NULL;
