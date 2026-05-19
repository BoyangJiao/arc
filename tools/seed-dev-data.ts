/**
 * tools/seed-dev-data.ts — CLI wrapper for shared dev seed (see supabase/functions/_shared/seed-core.ts).
 *
 * Usage:
 *   pnpm seed:dev [--email <your-email>] [--mode reset|append] [--scenario <name>]
 *   pnpm seed:default | pnpm seed:ds:*   # shortcuts — email from DEV_SEED_EMAIL
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { argv, exit } from "node:process";
import { createClient } from "@supabase/supabase-js";

import {
  SCENARIOS,
  SeedError,
  runSeedForUser,
  type Scenario,
  type UsMarketPrices,
} from "../supabase/functions/_shared/seed-core.ts";
import { fetchFinnhubUsQuotes } from "./fetch-finnhub-us-quotes.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");
const ENV_FILE = resolve(REPO_ROOT, ".env.dev.local");
const MOBILE_ENV_FILE = resolve(REPO_ROOT, "apps/mobile/.env");

interface SeedArgs {
  email: string;
  mode: "reset" | "append";
  scenario: Scenario;
}

function parseArgs(env: Record<string, string>): SeedArgs {
  let email: string | undefined;
  let mode: SeedArgs["mode"] = "reset";
  let scenario: Scenario = "default";

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
    } else if (arg === "--scenario") {
      const v = argv[++i];
      if (!isScenario(v)) {
        die(
          `Invalid --scenario "${v}".\n  Known scenarios:\n    ${SCENARIOS.map(
            (s) => `• ${s}`
          ).join("\n    ")}`
        );
      }
      scenario = v;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      exit(0);
    }
  }

  if (!email) {
    email = env.DEV_SEED_EMAIL?.trim() || undefined;
  }
  if (!email) {
    die(
      "Missing --email and DEV_SEED_EMAIL is not set in .env.dev.local.\n" +
        "  Either: pnpm seed:dev --email <you@dev.com> …\n" +
        "  Or add DEV_SEED_EMAIL=you@dev.com to .env.dev.local (see .env.dev.example)"
    );
  }
  return { email, mode, scenario };
}

function isScenario(v: string | undefined): v is Scenario {
  return typeof v === "string" && (SCENARIOS as readonly string[]).includes(v);
}

function printHelp() {
  console.log(`
Arc dev seed — inject portfolio + transactions for a dev user.

Usage:
  pnpm seed:dev [--email <email>] [--scenario <name>]
  pnpm seed:default | pnpm seed:ds:gain | …

Shortcuts (require DEV_SEED_EMAIL in .env.dev.local):
  pnpm seed:default | pnpm seed:ds:gain | pnpm seed:ds:loss
  pnpm seed:ds:mixed | pnpm seed:ds:first-day | pnpm seed:ds:empty

See docs/dev-seed-cheatsheet.md for scenario descriptions.
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

function normalizeSupabaseUrl(raw: string): string {
  let url = raw.trim().replace(/\/+$/, "");
  while (/^https?:\/\/https?:\/\//i.test(url)) {
    url = url.replace(/^https?:\/\//i, "");
  }
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url;
}

async function main() {
  const env = loadEnvFile(ENV_FILE);
  const args = parseArgs(env);

  const url = normalizeSupabaseUrl(env.SUPABASE_DEV_URL ?? "");
  const key = (env.SUPABASE_DEV_SERVICE_ROLE_KEY ?? "").trim();

  if (!env.SUPABASE_DEV_URL?.trim()) die("SUPABASE_DEV_URL missing in .env.dev.local (repo root)");
  if (!key) die("SUPABASE_DEV_SERVICE_ROLE_KEY missing in .env.dev.local (repo root)");

  if (/prod|production/i.test(url)) {
    die(`Refusing to run: SUPABASE_DEV_URL contains "prod" (${url}). This script is dev-only.`);
  }
  if (!key.startsWith("eyJ")) {
    die("SUPABASE_DEV_SERVICE_ROLE_KEY does not look like a JWT (expected to start with 'eyJ').");
  }

  console.log(`→ Target:   ${url}`);
  console.log(`→ User:     ${args.email}`);
  console.log(`→ Mode:     ${args.mode}`);
  console.log(`→ Scenario: ${args.scenario}`);

  if (args.mode === "append" && args.scenario !== "default") {
    console.warn(
      `⚠ --mode append + --scenario ${args.scenario}: use --mode reset for predictable UI state.`
    );
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

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

  let usMarketPrices: UsMarketPrices | undefined;
  const mobileEnv = existsSync(MOBILE_ENV_FILE) ? loadEnvFile(MOBILE_ENV_FILE) : {};
  const finnhubKey = (
    env.EXPO_PUBLIC_FINNHUB_API_KEY ??
    mobileEnv.EXPO_PUBLIC_FINNHUB_API_KEY ??
    ""
  ).trim();
  if (finnhubKey) {
    console.log("→ Fetching live US marks from Finnhub…");
    usMarketPrices = await fetchFinnhubUsQuotes(finnhubKey);
  } else {
    console.warn(
      "⚠ EXPO_PUBLIC_FINNHUB_API_KEY missing (apps/mobile/.env) — seed uses fallback marks"
    );
  }

  try {
    const result = await runSeedForUser(
      supabase,
      { userId: user.id, scenario: args.scenario, mode: args.mode, usMarketPrices },
      (line) => console.log(line.startsWith("✓") || line.startsWith("↷") ? line : `  ${line}`)
    );
    console.log(
      `\n✅ Seed complete. In simulator: ⌘D → Reload (or cold-start app) — Portfolio Tab should show:`
    );
    for (const line of result.expectedUi) {
      console.log(`   • ${line}`);
    }
  } catch (err) {
    const msg =
      err instanceof SeedError ? err.message : err instanceof Error ? err.message : String(err);
    die(msg);
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  die(`Seed crashed: ${msg}`);
});
