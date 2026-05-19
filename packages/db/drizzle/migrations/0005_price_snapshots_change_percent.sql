-- Optional day change % for watchlist + cache round-trip (Stage 2 J8).
ALTER TABLE "price_snapshots" ADD COLUMN IF NOT EXISTS "change_percent" numeric(28, 12);
