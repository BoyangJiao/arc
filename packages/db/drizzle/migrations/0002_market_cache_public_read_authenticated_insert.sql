-- Stage 1 dev: let authenticated clients persist quote/FX cache rows after adapter fetch.
-- Without this, only service_role (seed script) can write — every cold start re-hits Alpha Vantage.
-- Stage 4 will move writes to Edge Functions with service role.

ALTER TABLE "price_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fx_rates" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "price_snapshots_public_read"
  ON "price_snapshots"
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "price_snapshots_authenticated_insert"
  ON "price_snapshots"
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "fx_rates_public_read"
  ON "fx_rates"
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "fx_rates_authenticated_insert"
  ON "fx_rates"
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
