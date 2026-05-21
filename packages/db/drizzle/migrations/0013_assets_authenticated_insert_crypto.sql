-- Stage 3 Block C — allow authenticated users to register CRYPTO assets on tx entry.
-- US: 0001 | CASH: 0009 | CN/HK/FUND: 0010 | CRYPTO: this file

CREATE POLICY "assets_authenticated_insert_crypto"
  ON "assets"
  FOR INSERT
  TO authenticated
  WITH CHECK (market = 'CRYPTO');
