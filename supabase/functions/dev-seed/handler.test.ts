// Deno unit tests for the dev-seed Edge Function HTTP handler.
//
// Run: `pnpm test:functions` (= `deno test --allow-env supabase/functions/`)
//
// Each test covers one of the 5 security layers documented in handler.ts.
// We stub createUserClient / createAdminClient / runSeedForUser so the tests
// never touch network or Supabase. Scenarios go through the real isScenario()
// from _shared/seed-core.ts — that's intentional (verifies the whitelist
// stays in sync with seed-core).

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { makeHandler, type HandlerDeps, type UserClient, type AdminClient } from "./handler.ts";
import { SCENARIOS } from "../_shared/seed-core.ts";

const baseEnv = (overrides: Record<string, string | undefined> = {}) => {
  const env: Record<string, string | undefined> = {
    SUPABASE_URL: "https://dev-project.supabase.co",
    SUPABASE_ANON_KEY: "anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    DEV_TOOLS_ENABLED: "true",
    ...overrides,
  };
  return (key: string) => env[key];
};

const stubUserClient = (
  user: { id: string } | null,
  error: { message: string } | null = null
): UserClient => ({
  auth: {
    getUser: () => Promise.resolve({ data: { user }, error }),
  },
});

const baseDeps = (overrides: Partial<HandlerDeps> = {}): HandlerDeps => ({
  env: baseEnv(),
  createUserClient: () => stubUserClient({ id: "user-abc" }),
  createAdminClient: (): AdminClient => ({}),
  runSeedForUser: (_admin, args) =>
    Promise.resolve({
      scenario: args.scenario,
      portfolioId: "portfolio-xyz",
      expectedUi: { foo: "bar" },
    }),
  ...overrides,
});

const post = (
  body: unknown,
  headers: Record<string, string> = { Authorization: "Bearer jwt-token" }
) =>
  new Request("https://dev-project.supabase.co/functions/v1/dev-seed", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

// ──────────────────────────────────────────────────────────────────────────
// Method gate

Deno.test("OPTIONS preflight returns 200 with CORS headers", async () => {
  const handler = makeHandler(baseDeps());
  const res = await handler(
    new Request("https://dev-project.supabase.co/functions/v1/dev-seed", { method: "OPTIONS" })
  );
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("GET returns 405 Method not allowed", async () => {
  const handler = makeHandler(baseDeps());
  const res = await handler(
    new Request("https://dev-project.supabase.co/functions/v1/dev-seed", { method: "GET" })
  );
  assertEquals(res.status, 405);
});

// ──────────────────────────────────────────────────────────────────────────
// Layer 1: Prod URL block

Deno.test("Layer 1: SUPABASE_URL containing 'prod' → 403", async () => {
  const handler = makeHandler(
    baseDeps({ env: baseEnv({ SUPABASE_URL: "https://my-prod-project.supabase.co" }) })
  );
  const res = await handler(post({ scenario: "default" }));
  assertEquals(res.status, 403);
  const body = await res.json();
  assertEquals(body.error.includes("production"), true);
});

Deno.test("Layer 1: SUPABASE_URL containing 'production' (case-insensitive) → 403", async () => {
  const handler = makeHandler(
    baseDeps({ env: baseEnv({ SUPABASE_URL: "https://arc-PRODUCTION.supabase.co" }) })
  );
  const res = await handler(post({ scenario: "default" }));
  assertEquals(res.status, 403);
});

// ──────────────────────────────────────────────────────────────────────────
// Layer 2: DEV_TOOLS_ENABLED gate

Deno.test("Layer 2: DEV_TOOLS_ENABLED unset → 403", async () => {
  const handler = makeHandler(baseDeps({ env: baseEnv({ DEV_TOOLS_ENABLED: undefined }) }));
  const res = await handler(post({ scenario: "default" }));
  assertEquals(res.status, 403);
  const body = await res.json();
  assertEquals(body.error.includes("DEV_TOOLS_ENABLED"), true);
});

Deno.test("Layer 2: DEV_TOOLS_ENABLED='false' → 403", async () => {
  const handler = makeHandler(baseDeps({ env: baseEnv({ DEV_TOOLS_ENABLED: "false" }) }));
  const res = await handler(post({ scenario: "default" }));
  assertEquals(res.status, 403);
});

Deno.test("Layer 2: DEV_TOOLS_ENABLED='1' (not exact 'true') → 403", async () => {
  const handler = makeHandler(baseDeps({ env: baseEnv({ DEV_TOOLS_ENABLED: "1" }) }));
  const res = await handler(post({ scenario: "default" }));
  assertEquals(res.status, 403);
});

// ──────────────────────────────────────────────────────────────────────────
// Layer 3: Bearer auth

Deno.test("Layer 3: missing Authorization header → 401", async () => {
  const handler = makeHandler(baseDeps());
  const res = await handler(post({ scenario: "default" }, {}));
  assertEquals(res.status, 401);
});

Deno.test("Layer 3: Authorization not starting with 'Bearer ' → 401", async () => {
  const handler = makeHandler(baseDeps());
  const res = await handler(post({ scenario: "default" }, { Authorization: "Basic abc" }));
  assertEquals(res.status, 401);
});

// ──────────────────────────────────────────────────────────────────────────
// Body parsing

Deno.test("Invalid JSON body → 400", async () => {
  const handler = makeHandler(baseDeps());
  const res = await handler(post("{not json", { Authorization: "Bearer jwt" }));
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "Invalid JSON body");
});

// ──────────────────────────────────────────────────────────────────────────
// Layer 4: Scenario whitelist

Deno.test("Layer 4: missing scenario → 400", async () => {
  const handler = makeHandler(baseDeps());
  const res = await handler(post({}));
  assertEquals(res.status, 400);
});

Deno.test("Layer 4: unknown scenario string → 400", async () => {
  const handler = makeHandler(baseDeps());
  const res = await handler(post({ scenario: "evil:drop-tables" }));
  assertEquals(res.status, 400);
});

Deno.test("Layer 4: scenario as non-string → 400", async () => {
  const handler = makeHandler(baseDeps());
  const res = await handler(post({ scenario: 42 }));
  assertEquals(res.status, 400);
});

Deno.test("Layer 4: every SCENARIOS entry is accepted (with valid user)", async () => {
  for (const scenario of SCENARIOS) {
    const handler = makeHandler(baseDeps());
    const res = await handler(post({ scenario }));
    assertEquals(res.status, 200, `scenario ${scenario} should be accepted`);
    const body = await res.json();
    assertEquals(body.scenario, scenario);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Layer 5: User-scoped via JWT

Deno.test("Layer 5: JWT resolves to no user → 401", async () => {
  const handler = makeHandler(baseDeps({ createUserClient: () => stubUserClient(null) }));
  const res = await handler(post({ scenario: "default" }));
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.error.includes("Unauthorized"), true);
});

Deno.test("Layer 5: auth.getUser returns error → 401", async () => {
  const handler = makeHandler(
    baseDeps({ createUserClient: () => stubUserClient(null, { message: "bad jwt" }) })
  );
  const res = await handler(post({ scenario: "default" }));
  assertEquals(res.status, 401);
});

Deno.test(
  "Layer 5: runSeedForUser receives the JWT-resolved userId (NOT a body-supplied id)",
  async () => {
    let capturedUserId = "";
    const handler = makeHandler(
      baseDeps({
        createUserClient: () => stubUserClient({ id: "real-jwt-user" }),
        runSeedForUser: (_admin, args) => {
          capturedUserId = args.userId;
          return Promise.resolve({
            scenario: args.scenario,
            portfolioId: "p-1",
            expectedUi: {},
          });
        },
      })
    );
    // Attempt smuggling userId via body — should be ignored.
    const res = await handler(post({ scenario: "default", userId: "smuggled-attacker" }));
    assertEquals(res.status, 200);
    assertEquals(capturedUserId, "real-jwt-user");
  }
);

// ──────────────────────────────────────────────────────────────────────────
// Happy path

Deno.test("Happy path: valid scenario + JWT → 200 with portfolioId + expectedUi", async () => {
  const handler = makeHandler(baseDeps());
  const res = await handler(post({ scenario: "daily-snapshot:big-gain" }));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.ok, true);
  assertEquals(body.scenario, "daily-snapshot:big-gain");
  assertEquals(body.portfolioId, "portfolio-xyz");
});

Deno.test("runSeedForUser is invoked with mode='reset'", async () => {
  let capturedMode = "";
  const handler = makeHandler(
    baseDeps({
      runSeedForUser: (_admin, args) => {
        capturedMode = args.mode;
        return Promise.resolve({
          scenario: args.scenario,
          portfolioId: "p-1",
          expectedUi: {},
        });
      },
    })
  );
  await handler(post({ scenario: "default" }));
  assertEquals(capturedMode, "reset");
});

// ──────────────────────────────────────────────────────────────────────────
// Error propagation

Deno.test("runSeedForUser throws → 500 with error message", async () => {
  const handler = makeHandler(
    baseDeps({
      runSeedForUser: () => Promise.reject(new Error("seed blew up")),
    })
  );
  const res = await handler(post({ scenario: "default" }));
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.error, "seed blew up");
});
