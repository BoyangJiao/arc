-- Stage 2 J8 — Watchlist feature
-- 见 .specify/feature-specs/watchlist-stage-2.md
--
-- 1) Create watchlist_items
-- 2) UNIQUE (user_id, asset_id) — dedup constraint
-- 3) Index (user_id, added_at desc) — Markets Tab default sort
-- 4) RLS policies — user can SELECT/INSERT/DELETE own rows only;
--    UPDATE intentionally has no policy (no editable columns).

CREATE TABLE "watchlist_items" (
  "id"         uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"    uuid           NOT NULL,
  "asset_id"   text           NOT NULL REFERENCES "assets"("id") ON DELETE CASCADE,
  "added_at"   timestamptz    NOT NULL DEFAULT now()
);

-- Dedup: one watchlist row per (user, asset)
CREATE UNIQUE INDEX "watchlist_items_user_asset_uniq"
  ON "watchlist_items" ("user_id", "asset_id");

-- Sort index for Markets Tab list (most-recently-added at top)
CREATE INDEX "watchlist_items_user_added_at_idx"
  ON "watchlist_items" ("user_id", "added_at" DESC);

-- ─── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE "watchlist_items" ENABLE ROW LEVEL SECURITY;

-- SELECT: user reads only their own rows
CREATE POLICY "watchlist_items_user_select"
  ON "watchlist_items"
  FOR SELECT
  TO authenticated
  USING ("user_id" = (SELECT auth.uid()));

-- INSERT: user can add only with their own user_id
CREATE POLICY "watchlist_items_user_insert"
  ON "watchlist_items"
  FOR INSERT
  TO authenticated
  WITH CHECK ("user_id" = (SELECT auth.uid()));

-- DELETE: user can remove only their own rows
CREATE POLICY "watchlist_items_user_delete"
  ON "watchlist_items"
  FOR DELETE
  TO authenticated
  USING ("user_id" = (SELECT auth.uid()));

-- UPDATE: intentionally no policy. With RLS on + no UPDATE policy = no UPDATE
-- access for any role except service_role. The table has no editable columns
-- by design (modify = DELETE + INSERT).
