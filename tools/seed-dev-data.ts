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
 *   <repo-root>/.env.dev.local   (gitignored)
 *     SUPABASE_DEV_URL=https://<project>.supabase.co
 *     SUPABASE_DEV_SERVICE_ROLE_KEY=eyJ...   ← Dashboard → Settings → API → service_role
 *
 *   ↑ File lives at repo root, NOT apps/mobile/. Metro/Expo only knows the
 *   standard .env names; a non-standard one under apps/mobile/ crashes the
 *   bundler ("Unexpected token" on the # comment). See ADR 007.
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
const ENV_FILE = resolve(REPO_ROOT, ".env.dev.local");

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

Env file: <repo-root>/.env.dev.local (gitignored; see .env.dev.example)
  SUPABASE_DEV_URL
  SUPABASE_DEV_SERVICE_ROLE_KEY
`);
}

function loadEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) {
    die(
      `Env file not found: ${path}\n` +
        `Copy .env.dev.example → .env.dev.local (both at repo root) and fill in the service role key.`
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

/** Trim and fix common copy-paste mistakes (e.g. `https://https://xxx.supabase.co`). */
function normalizeSupabaseUrl(raw: string): string {
  let url = raw.trim().replace(/\/+$/, "");
  // Collapse repeated scheme prefixes from Dashboard copy + manual `https://` prefix.
  while (/^https?:\/\/https?:\/\//i.test(url)) {
    url = url.replace(/^https?:\/\//i, "");
  }
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url;
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

  const url = normalizeSupabaseUrl(env.SUPABASE_DEV_URL ?? "");
  const key = (env.SUPABASE_DEV_SERVICE_ROLE_KEY ?? "").trim();

  if (!env.SUPABASE_DEV_URL?.trim()) die("SUPABASE_DEV_URL missing in .env.dev.local (repo root)");
  if (!key) die("SUPABASE_DEV_SERVICE_ROLE_KEY missing in .env.dev.local (repo root)");

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

  // Step 6: seed price_snapshots so dev navigation hits Supabase cache instead of
  // Alpha Vantage on every screen open (AV free tier: 5 req/min).
  const asOf = new Date().toISOString();
  const priceRows = [
    { asset_id: "US:AAPL", as_of: asOf, price: "189.50", currency: "USD", source: "seed-dev" },
    { asset_id: "US:MSFT", as_of: asOf, price: "420.30", currency: "USD", source: "seed-dev" },
    { asset_id: "US:NVDA", as_of: asOf, price: "875.00", currency: "USD", source: "seed-dev" },
  ];
  const { error: priceErr } = await supabase
    .from("price_snapshots")
    .upsert(priceRows as never, { onConflict: "asset_id,as_of" });
  if (priceErr) die(`price_snapshots upsert failed: ${priceErr.message}`);
  console.log(`✓ Seeded ${priceRows.length} price_snapshots (dev cache — not live quotes)`);

  // Step 7: seed USD→CNY FX row for reporting-currency conversion without Frankfurter on first paint.
  const { error: fxErr } = await supabase.from("fx_rates").upsert(
    {
      from_currency: "USD",
      to_currency: "CNY",
      as_of: asOf,
      rate: "7.20",
      source: "seed-dev",
    } as never,
    { onConflict: "from_currency,to_currency,as_of" }
  );
  if (fxErr) die(`fx_rates upsert failed: ${fxErr.message}`);
  console.log(`✓ Seeded USD→CNY fx_rates row`);

  // Step 8: seed a "yesterday" portfolio_value_snapshots row so the
  // Daily Snapshot card (Stage 2 J7) renders immediately in dev — no need
  // to wait 24h for the GitHub Actions cron to write a baseline.
  // We pick prices ~2% LOWER than the current seed so today's view shows a
  // ~+2% gain card (positive delta + colored mover chips).
  //
  // Per spec §UI contract: card compares against the most-recent snapshot
  // strictly BEFORE now. Use yesterday at 23:00 UTC — matches what the
  // production cron would have written.
  const yesterdayAt23UTC = (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    d.setUTCHours(23, 0, 0, 0);
    return d.toISOString();
  })();
  // Per-asset baseline values in USD native (~2% below current seed),
  // then converted to CNY @ 7.20 for the reporting-currency totals.
  const BASELINE = {
    AAPL: { shares: "10", priceNative: "185.79" }, // 189.50 × ~0.98
    MSFT: { shares: "5", priceNative: "412.05" }, // 420.30 × ~0.98
    NVDA: { shares: "8", priceNative: "857.50" }, // 875.00 × ~0.98
  } as const;
  const FX_USD_CNY = 7.2;
  const perAssetSnapshot = Object.entries(BASELINE).map(([sym, { shares, priceNative }]) => {
    const valueNative = Number(shares) * Number(priceNative);
    return {
      assetId: `US:${sym}`,
      shares,
      valueNative: valueNative.toFixed(2),
      currency: "USD",
      valueReporting: (valueNative * FX_USD_CNY).toFixed(2),
    };
  });
  const totalValueReporting = perAssetSnapshot
    .reduce((acc, a) => acc + Number(a.valueReporting), 0)
    .toFixed(2);
  // Cost basis: same shares × the original BUY prices from SEED_TRANSACTIONS,
  // converted at the same FX. (This is dev-fake; the real cron would track
  // cumulative cost properly. Stage 2 card only displays total/delta, not
  // cost-basis-derived numbers, so this approximation is harmless.)
  const totalCostBasisReporting = SEED_TRANSACTIONS.reduce((acc, tx) => {
    return acc + Number(tx.shares) * Number(tx.price_per_share) * FX_USD_CNY;
  }, 0).toFixed(2);

  const { error: snapErr } = await supabase.from("portfolio_value_snapshots").upsert(
    {
      portfolio_id: portfolioId,
      as_of: yesterdayAt23UTC,
      total_value: totalValueReporting,
      total_cost_basis: totalCostBasisReporting,
      reporting_currency: "CNY",
      per_asset: perAssetSnapshot,
      source: "manual",
    } as never,
    { onConflict: "portfolio_id,as_of" }
  );
  if (snapErr) die(`portfolio_value_snapshots upsert failed: ${snapErr.message}`);
  console.log(
    `✓ Seeded yesterday's snapshot (Daily Snapshot card baseline; ≈¥${totalValueReporting})`
  );

  console.log(
    `\n✅ Seed complete. Cold-start the app — Portfolio Tab should show:` +
      `\n   • Daily Snapshot card at top (≈ +2% gain vs yesterday's baseline)` +
      `\n   • Total value below + 3 holdings with fast cached quotes`
  );
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  die(`Seed crashed: ${msg}`);
});
