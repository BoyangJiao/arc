-- Stage 1: allow signed-in users to register US equity assets when adding a transaction.
-- Without this, only service_role (seed script) can insert into `assets`, so manual
-- symbol entry fails FK for anything outside the seed list.

ALTER TABLE "assets" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assets_public_read"
  ON "assets"
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "assets_authenticated_insert_us"
  ON "assets"
  FOR INSERT
  TO authenticated
  WITH CHECK (market = 'US');
