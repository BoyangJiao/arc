-- Stage 3 ADR 016 — OPENING_SNAPSHOT transaction type (position entry snapshot).
-- Apply in Supabase SQL Editor; commit transaction before using the new enum value.

ALTER TYPE "transaction_type" ADD VALUE IF NOT EXISTS 'OPENING_SNAPSHOT';
