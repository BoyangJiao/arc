/**
 * tools/seed-dev-data.ts — Inject realistic seed data into the dev Supabase project.
 *
 * Per ADR 007 §决策三: this REPLACES the deleted apps/mobile/src/lib/queries/dev-seed.ts
 * frontend mock. Data here lands in the real `portfolios` + `transactions` tables in the
 * dev Supabase project, so business hooks (useTransactions etc.) → computeHoldings →
 * usePrice / useFxRate → computeMarketValue run the full real chain on first dev hit.
 *
 * Usage:
 *   pnpm seed:dev --email <your-email> [--mode reset|append]
 *
 * Reads from:
 *   apps/mobile/.env.dev.local   (gitignored)
 *     SUPABASE_DEV_URL=https://<project>.supabase.co
 *     SUPABASE_DEV_SERVICE_ROLE_KEY=eyJ...   ← Dashboard → Settings → API → service_role
 *
 * Safety rails (ADR 007 §决策三 - service role key 防线):
 *   1. URL must not contain "prod" / "production"
 *   2. Service role key must be a JWT-shaped string (basic shape check)
 *   3. --mode reset only deletes rows belonging to the target user (FK cascade)
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { argv, exit } from "node:process";
import { createClient } from "@supabase/supabase-js";

// ──────────────────────────────────────────────────────────────────────────
// Args + env

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");
const ENV_FILE = resolve(REPO_ROOT, "apps/mobile/.env.dev.local");

interface SeedArgs {
  email: string;
  mode: "reset" | "append";
}

function parseArgs(): SeedArgs {
  let email: string | undefined;
  let mode: SeedArgs["mode"] = "reset";

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--email") {
      email = argv[++i];
    } else if (arg === "--mode") {
      const v = argv[++i];
      if (v !== "reset" && v !== "append") {
        die(`Invalid --mode "${v}". Expected "reset" or "append".`);
      }
      mode = v;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      exit(0);
    }
  }

  if (!email) {
    die("Missing --email. Usage: pnpm seed:dev --email <your-email> [--mode reset|append]");
  }
  return { email, mode };
}

function printHelp() {
  console.log(`
Arc dev seed — inject portfolio + transactions for a dev user.

Usage:
  pnpm seed:dev --email <email>             # default mode: reset (idempotent)
  pnpm seed:dev --email <email> --mode reset
  pnpm seed:dev --email <email> --mode append

Env file: apps/mobile/.env.dev.local (gitignored; see .env.dev.example)
  SUPABASE_DEV_URL
  SUPABASE_DEV_SERVICE_ROLE_KEY
`);
}

function loadEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) {
    die(
      `Env file not found: ${path}\n` +
        `Copy apps/mobile/.env.dev.example → .env.dev.local and fill in the service role key.`
    );
  }
  const raw = readFileSync(path, "utf8");
  const out: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    out[k] = v;
  }
  return out;
}

function die(msg: string): never {
  console.error(`❌ ${msg}`);
  exit(1);
}

// ──────────────────────────────────────────────────────────────────────────
// Seed payload

const SEED_ASSETS = [
  { id: "US:AAPL", market: "US", symbol: "AAPL", name: "Apple Inc.", currency: "USD" },
  {
    id: "US:MSFT",
    market: "US",
    symbol: "MSFT",
    name: "Microsoft Corporation",
    currency: "USD",
  },
  {
    id: "US:NVDA",
    market: "US",
    symbol: "NVDA",
    name: "NVIDIA Corporation",
    currency: "USD",
  },
] as const;

interface SeedTx {
  asset_id: string;
  type: "BUY";
  shares: string;
  price_per_share: string;
  currency: "USD";
  fee: string;
  trade_date: string;
  notes: string | null;
}

// Dates spread across 3 months ago → today, so historical price + FX chains
// actually have something to resolve. ISO strings; will be parsed by Postgres.
const today = new Date();
const monthsAgo = (m: number) => {
  const d = new Date(today);
  d.setMonth(d.getMonth() - m);
  return d.toISOString();
};

const SEED_TRANSACTIONS: SeedTx[] = [
  {
    asset_id: "US:AAPL",
    type: "BUY",
    shares: "10",
    price_per_share: "189.50",
    currency: "USD",
    fee: "1.00",
    trade_date: monthsAgo(3),
    notes: "Initial position",
  },
  {
    asset_id: "US:MSFT",
    type: "BUY",
    shares: "5",
    price_per_share: "420.30",
    currency: "USD",
    fee: "1.00",
    trade_date: monthsAgo(2),
    notes: null,
  },
  {
    asset_id: "US:NVDA",
    type: "BUY",
    shares: "8",
    price_per_share: "875.00",
    currency: "USD",
    fee: "2.00",
    trade_date: monthsAgo(1),
    notes: "AI play",
  },
];

// ──────────────────────────────────────────────────────────────────────────
// Main

async function main() {
  const args = parseArgs();
  const env = loadEnvFile(ENV_FILE);

  const url = env.SUPABASE_DEV_URL;
  const key = env.SUPABASE_DEV_SERVICE_ROLE_KEY;

  if (!url) die("SUPABASE_DEV_URL missing in apps/mobile/.env.dev.local");
  if (!key) die("SUPABASE_DEV_SERVICE_ROLE_KEY missing in apps/mobile/.env.dev.local");

  // Safety rail 1: never accidentally run against prod
  if (/prod|production/i.test(url)) {
    die(`Refusing to run: SUPABASE_DEV_URL contains "prod" (${url}). This script is dev-only.`);
  }
  // Safety rail 2: service role key shape
  if (!key.startsWith("eyJ")) {
    die("SUPABASE_DEV_SERVICE_ROLE_KEY does not look like a JWT (expected to start with 'eyJ').");
  }

  console.log(`→ Target: ${url}`);
  console.log(`→ User:   ${args.email}`);
  console.log(`→ Mode:   ${args.mode}`);

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Step 1: find user by email via Admin API
  const { data: usersPage, error: listErr } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) die(`Admin listUsers failed: ${listErr.message}`);

  const user = usersPage.users.find((u) => u.email?.toLowerCase() === args.email.toLowerCase());
  if (!user) {
    die(
      `No Supabase user matches email "${args.email}". ` +
        `Sign in once via OTP in the app, then re-run.`
    );
  }
  console.log(`✓ Found user (id ${user.id.slice(0, 8)}…)`);

  // Step 2: ensure assets exist (upsert by id; CHECK constraint enforces shape)
  const { error: assetErr } = await supabase
    .from("assets")
    .upsert(SEED_ASSETS as never, { onConflict: "id" });
  if (assetErr) die(`Asset upsert failed: ${assetErr.message}`);
  console.log(`✓ Assets ensured (${SEED_ASSETS.length})`);

  // Step 3: if reset, delete the user's existing portfolios (cascades to transactions)
  if (args.mode === "reset") {
    const { error: delErr } = await supabase.from("portfolios").delete().eq("user_id", user.id);
    if (delErr) die(`Portfolio delete failed: ${delErr.message}`);
    console.log(`✓ Cleared existing portfolios for this user`);
  }

  // Step 4: create the seed portfolio
  const { data: created, error: portErr } = await supabase
    .from("portfolios")
    .insert({
      user_id: user.id,
      name: "My Portfolio",
      reporting_currency: "CNY",
    })
    .select("id")
    .single();
  if (portErr || !created) die(`Portfolio insert failed: ${portErr?.message ?? "unknown"}`);
  const portfolioId = created.id;
  console.log(`✓ Created portfolio "My Portfolio" (${portfolioId.slice(0, 8)}…)`);

  // Step 5: insert seed transactions
  const txRows = SEED_TRANSACTIONS.map((tx) => ({
    portfolio_id: portfolioId,
    ...tx,
  }));
  const { error: txErr } = await supabase.from("transactions").insert(txRows);
  if (txErr) die(`Transaction insert failed: ${txErr.message}`);
  console.log(`✓ Inserted ${txRows.length} transactions (AAPL/MSFT/NVDA, spread over 3 months)`);

  console.log(`\n✅ Seed complete. Cold-start the app — Portfolio Tab should show 3 holdings.`);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  die(`Seed crashed: ${msg}`);
});
