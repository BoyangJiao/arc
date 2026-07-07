-- ADR 016 v2: completely remove OPENING_SNAPSHOT from transaction_type enum.
-- Apply in Supabase SQL Editor (same flow as 0012–0014).
--
-- Step 1: convert existing snapshots to BUY (semantically equivalent in computeHoldings).
UPDATE transactions SET type = 'BUY' WHERE type = 'OPENING_SNAPSHOT';

-- Step 2: Postgres cannot DROP VALUE from enum — recreate without OPENING_SNAPSHOT.
CREATE TYPE "transaction_type_new" AS ENUM('BUY', 'SELL', 'DIVIDEND', 'SPLIT', 'ADJUSTMENT');

ALTER TABLE "transactions"
  ALTER COLUMN "type" TYPE "transaction_type_new"
  USING ("type"::text::"transaction_type_new");

DROP TYPE "transaction_type";
ALTER TYPE "transaction_type_new" RENAME TO "transaction_type";
