/**
 * Supabase-backed price cache (price_snapshots table).
 *
 * Read-first strategy:
 *   1. Try latest snapshot for assetId where now() - as_of < freshnessMs
 *   2. If found → return it (hit)
 *   3. Else → return null (caller falls back to adapter)
 *
 * Write-back: every fresh adapter result gets upserted here so all users in
 * the project share the cache (assets/price_snapshots are RLS-public-read,
 * service-role-write — but client also writes here in Stage 1 for simplicity;
 * Stage 4 will move writes to Edge Function with service role).
 *
 * Note (Stage 1 RLS quirk): client writing to price_snapshots requires us to
 * temporarily allow `authenticated` INSERT, OR we need an Edge Function for
 * writes. Our migration `add_auth_fks_rls_and_triggers` set price_snapshots
 * to public-read + service-role-write. So in Stage 1 dev, client writes WILL
 * fail under RLS — adapter result is returned to caller anyway, just not
 * persisted. We log a warning. Stage 2+ either:
 *   - Add a `cache:price-snapshots` Edge Function callable by authenticated users
 *   - OR loosen RLS on price_snapshots to allow authenticated INSERT
 *
 * For Stage 1 J2 verification (single-user, fresh fetch every time is OK), we
 * accept the cache miss and call adapter every render. TanStack Query's
 * in-memory cache (60s stale time) prevents thrashing.
 */

import Decimal from "decimal.js";

import type { Currency, PriceQuote } from "@arc/core";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { PriceCache } from "../interfaces";

interface PriceSnapshotRow {
  asset_id: string;
  as_of: string;
  price: string;
  currency: Currency;
  source: string;
}

export const createSupabasePriceCache = (client: SupabaseClient): PriceCache => ({
  async get(assetId, freshnessMs) {
    const { data, error } = await client
      .from("price_snapshots")
      .select("asset_id, as_of, price, currency, source")
      .eq("asset_id", assetId)
      .order("as_of", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    const row = data as PriceSnapshotRow;
    const ageMs = Date.now() - new Date(row.as_of).getTime();
    if (ageMs > freshnessMs) return null;

    let price: Decimal;
    try {
      price = new Decimal(row.price);
    } catch {
      return null;
    }

    return {
      assetId: row.asset_id,
      price,
      currency: row.currency,
      asOf: row.as_of,
      source: row.source,
    };
  },

  async set(quote) {
    // Upsert by composite PK (asset_id, as_of)
    const { error } = await client.from("price_snapshots").upsert(
      {
        asset_id: quote.assetId,
        as_of: quote.asOf,
        price: quote.price.toString(), // Decimal → string for numeric column
        currency: quote.currency,
        source: quote.source,
      },
      { onConflict: "asset_id,as_of" }
    );
    if (error) {
      // Stage 1: client writes likely fail RLS; swallow + log.
      // Stage 2 will move to Edge Function with service role.

      console.warn("[price-cache] write failed (expected under client RLS):", error.message);
    }
  },
});
