// Supabase Edge Function: daily-snapshot
//
// Deno runtime. Invoked daily at 23:00 UTC by .github/workflows/daily-snapshot.yml.
// For each portfolio in the system, computes today's valuation using cached
// price_snapshots + fx_rates only (never calls a live market-data API),
// then upserts one row into portfolio_value_snapshots.
//
// All logic lives in handler.ts (unit-tested via `pnpm test:functions`);
// this file only wires the real Supabase client into the dependency seam.
//
// Per ADR 008 §决策五 and .specify/feature-specs/stage-2/daily-snapshot-stage-2.md
// §"Snapshot timing":
// - Idempotent: same (portfolio_id, as_of) primary key + ON CONFLICT DO UPDATE.
//   Retrying the workflow on the same UTC day overwrites the row.
// - Zero external API calls. We snapshot what we already know. Stale cache is
//   a tradeoff knowingly accepted (the user pulling-to-refresh during the day
//   warms the cache; weekend / inactive periods will show stale prices but
//   the snapshot is still meaningful as "what we last knew").
//
// Auth model:
// - Inbound: Authorization header must match DAILY_SNAPSHOT_SECRET env var
//   (set in Supabase project secrets; constant-time comparison in handler.ts).
//   The GH Actions workflow holds the matching secret in repo secrets.
// - Outbound (to Supabase): uses SUPABASE_SERVICE_ROLE_KEY (DB writes
//   bypass RLS). Never exposed to clients.
//
// Local test: `supabase functions serve daily-snapshot --env-file ./supabase/functions/.env`
// then `curl -X POST http://localhost:54321/functions/v1/daily-snapshot -H "Authorization: Bearer <secret>"`

// @ts-expect-error — Deno-only ESM URL import (resolved at deploy time)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import { makeHandler, type HandlerDeps, type PageRequest } from "./handler.ts";

Deno.serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const deps: HandlerDeps = {
    env: (key) => Deno.env.get(key),
    fetchPage: async (page: PageRequest) => {
      let query = supabase.from(page.table).select(page.columns);
      for (const o of page.orderBy) {
        query = query.order(o.column, { ascending: o.ascending });
      }
      const { data, error } = await query.range(page.from, page.to);
      return { data, error };
    },
    upsertSnapshot: async (row) => {
      const { error } = await supabase
        .from("portfolio_value_snapshots")
        .upsert(row, { onConflict: "portfolio_id,as_of" });
      return { error };
    },
  };

  return makeHandler(deps)(req);
});
