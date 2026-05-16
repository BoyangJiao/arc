/**
 * Supabase-backed FX cache (fx_rates table).
 *
 * Same read-first / write-back pattern as price-cache.ts.
 * fx_rates table has composite PK (from_currency, to_currency, as_of).
 */

import Decimal from "decimal.js";

import type { Currency, FxRate } from "@arc/core";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { FxCache } from "../interfaces";

interface FxRateRow {
  from_currency: Currency;
  to_currency: Currency;
  as_of: string;
  rate: string;
  source: string;
}

export const createSupabaseFxCache = (client: SupabaseClient): FxCache => ({
  async get(from, to, freshnessMs) {
    const { data, error } = await client
      .from("fx_rates")
      .select("from_currency, to_currency, as_of, rate, source")
      .eq("from_currency", from)
      .eq("to_currency", to)
      .order("as_of", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    const row = data as FxRateRow;
    const ageMs = Date.now() - new Date(row.as_of).getTime();
    if (ageMs > freshnessMs) return null;

    let rate: Decimal;
    try {
      rate = new Decimal(row.rate);
    } catch {
      return null;
    }

    return {
      from: row.from_currency,
      to: row.to_currency,
      rate,
      asOf: row.as_of,
      source: row.source,
    };
  },

  async set(rate) {
    const { error } = await client.from("fx_rates").upsert(
      {
        from_currency: rate.from,
        to_currency: rate.to,
        as_of: rate.asOf,
        rate: rate.rate.toString(),
        source: rate.source,
      },
      { onConflict: "from_currency,to_currency,as_of" }
    );
    if (error) {
      console.warn("[fx-cache] write failed (expected under client RLS):", error.message);
    }
  },
});
