// Supabase Edge Function: dev-seed
//
// Dev-only. Resets + re-seeds the **calling user's** portfolio for a named scenario.
// Same logic as `pnpm seed:dev` / tools/seed-dev-data.ts via _shared/seed-core.ts.
//
// Auth: caller's Supabase session JWT (Authorization: Bearer <access_token>).
// Writes: service_role client (never exposed to the mobile bundle).
//
// Guards:
//   - SUPABASE_URL must not contain "prod" / "production"
//   - DEV_TOOLS_ENABLED project secret must be "true"
//
// Deploy (dev project only):
//   supabase secrets set DEV_TOOLS_ENABLED=true
//   supabase functions deploy dev-seed
//
// App invokes: supabase.functions.invoke('dev-seed', { body: { scenario } })

// @ts-expect-error — Deno ESM
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import { isScenario, runSeedForUser, SeedError, type Scenario } from "../_shared/seed-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  if (/prod|production/i.test(supabaseUrl)) {
    return json({ error: "dev-seed is disabled on production projects" }, 403);
  }

  if (Deno.env.get("DEV_TOOLS_ENABLED") !== "true") {
    return json(
      {
        error:
          "DEV_TOOLS_ENABLED is not true. Set via: supabase secrets set DEV_TOOLS_ENABLED=true",
      },
      403
    );
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Missing Authorization header" }, 401);
  }

  let body: { scenario?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!isScenario(body.scenario)) {
    return json({ error: `Invalid scenario. Expected one of the known scenario ids.` }, 400);
  }
  const scenario = body.scenario as Scenario;

  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user },
    error: userErr,
  } = await supabaseUser.auth.getUser();
  if (userErr || !user) {
    return json({ error: "Unauthorized — sign in to the dev app first" }, 401);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const result = await runSeedForUser(supabaseAdmin, {
      userId: user.id,
      scenario,
      mode: "reset",
    });
    return json({
      ok: true,
      scenario: result.scenario,
      portfolioId: result.portfolioId,
      expectedUi: result.expectedUi,
    });
  } catch (err) {
    const message =
      err instanceof SeedError ? err.message : err instanceof Error ? err.message : String(err);
    console.error("[dev-seed]", message);
    return json({ error: message }, 500);
  }
});
