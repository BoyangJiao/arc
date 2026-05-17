// Supabase Edge Function: dev-seed
//
// Dev-only. Resets + re-seeds the **calling user's** portfolio for a named scenario.
// Same logic as `pnpm seed:dev` / tools/seed-dev-data.ts via _shared/seed-core.ts.
//
// Auth: caller's Supabase session JWT (Authorization: Bearer <access_token>).
// Writes: service_role client (never exposed to the mobile bundle).
//
// All HTTP behavior lives in ./handler.ts (so it's unit-testable without
// touching network / Deno.serve). This file only wires real deps + serves.
//
// Deploy (dev project only):
//   supabase secrets set DEV_TOOLS_ENABLED=true
//   supabase functions deploy dev-seed

// @ts-expect-error — Deno ESM
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import { runSeedForUser } from "../_shared/seed-core.ts";
import { makeHandler } from "./handler.ts";

const handler = makeHandler({
  env: (key) => Deno.env.get(key),
  createUserClient: (url, anonKey, authHeader) =>
    createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  createAdminClient: (url, serviceKey) =>
    createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  runSeedForUser,
});

Deno.serve(handler);
