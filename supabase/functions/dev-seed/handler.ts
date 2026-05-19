// Pure HTTP handler for the dev-seed Edge Function.
//
// Split from index.ts so the 5-layer security defenses can be unit-tested
// without spinning up a real Deno.serve / Supabase client / network.
//
// Layers verified (mapped to .specify/session-state.md 2026-05-18 audit):
//   1. Prod URL block  — SUPABASE_URL must not match /prod|production/i
//   2. DEV_TOOLS_ENABLED gate — env secret must equal "true"
//   3. Bearer auth — Authorization header must start with "Bearer "
//   4. Scenario whitelist — body.scenario must satisfy isScenario()
//   5. User-scoped via JWT — Supabase auth.getUser(JWT) must resolve to a real user;
//      runSeedForUser writes only under that user_id.

import { isScenario, SeedError, type Scenario } from "../_shared/seed-core.ts";

// Minimal structural types — we don't depend on the real @supabase/supabase-js
// here so tests can stub without resolving the bare specifier.
export interface UserClient {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: { message: string } | null;
    }>;
  };
}

export type AdminClient = Record<string, unknown>;

export interface HandlerDeps {
  env: (key: string) => string | undefined;
  createUserClient: (url: string, anonKey: string, authHeader: string) => UserClient;
  createAdminClient: (url: string, serviceKey: string) => AdminClient;
  runSeedForUser: (
    admin: AdminClient,
    args: { userId: string; scenario: Scenario; mode: "reset" }
  ) => Promise<{ scenario: string; portfolioId: string; expectedUi: unknown }>;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export const makeHandler =
  (deps: HandlerDeps) =>
  async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const supabaseUrl = deps.env("SUPABASE_URL") ?? "";

    // Layer 1: prod URL block
    if (/prod|production/i.test(supabaseUrl)) {
      return json({ error: "dev-seed is disabled on production projects" }, 403);
    }

    // Layer 2: DEV_TOOLS_ENABLED gate
    if (deps.env("DEV_TOOLS_ENABLED") !== "true") {
      return json(
        {
          error:
            "DEV_TOOLS_ENABLED is not true. Set via: supabase secrets set DEV_TOOLS_ENABLED=true",
        },
        403
      );
    }

    // Layer 3: Bearer auth header present
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

    // Layer 4: scenario whitelist
    if (!isScenario(body.scenario)) {
      return json({ error: "Invalid scenario. Expected one of the known scenario ids." }, 400);
    }
    const scenario = body.scenario as Scenario;

    const anonKey = deps.env("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = deps.env("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabaseUser = deps.createUserClient(supabaseUrl, anonKey, authHeader);

    // Layer 5: JWT must resolve to a real user
    const {
      data: { user },
      error: userErr,
    } = await supabaseUser.auth.getUser();
    if (userErr || !user) {
      return json({ error: "Unauthorized — sign in to the dev app first" }, 401);
    }

    const supabaseAdmin = deps.createAdminClient(supabaseUrl, serviceKey);

    try {
      const result = await deps.runSeedForUser(supabaseAdmin, {
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
  };
