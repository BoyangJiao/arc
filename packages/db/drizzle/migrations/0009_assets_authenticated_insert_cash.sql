-- Stage 2 J9 — allow authenticated users to register CASH:* rows when setting cash balances.
-- CASH global rows are seeded in 0008; this policy covers client-side upsert on first use.
-- US equities remain covered by 0001 assets_authenticated_insert_us.

CREATE POLICY "assets_authenticated_insert_cash"
  ON "assets"
  FOR INSERT
  TO authenticated
  WITH CHECK (market = 'CASH');
