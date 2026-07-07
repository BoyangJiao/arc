-- Stage 3 Block C — allow authenticated users to register CRYPTO assets on tx entry.
-- US: 0001 | CASH: 0009 | CN/HK/FUND: 0010 | CRYPTO: this file

-- Idempotent: safe to re-run in SQL Editor if policy already exists (42710).
DROP POLICY IF EXISTS "assets_authenticated_insert_crypto" ON "assets";

CREATE POLICY "assets_authenticated_insert_crypto"
  ON "assets"
  FOR INSERT
  TO authenticated
  WITH CHECK (market = 'CRYPTO');
