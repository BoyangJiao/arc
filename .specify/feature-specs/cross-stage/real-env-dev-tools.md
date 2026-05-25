# Feature: Real-data DEV environments (Real / Clean) — cross-stage tooling

- **Status**: Implemented — 6/6 commits landed locally on `dev/stage-3` 2026-05-25 (typecheck 6/6 ✅, mobile tests 28/28 ✅); pending user-side first-time setup (spec §J-RE.1) before Block D Phase 3
- **Author**: Claude Opus 4.7 (spec) — implementation owner Sonnet/Cursor
- **Created**: 2026-05-25
- **Implements**: dogfooding gate before Block D Phase 3 雪球对标 (S3-AC-D.1.9); satisfies constitution §核心原则 5 "scratch your own itch"
- **Conforms to**: ADR 007 (no auth bypass — both envs go through real `signInWithOtp` flow), constitution §Real-flow integrity, ADR 010 (cache trust)
- **Touches**: `apps/mobile/src/lib/auth.tsx`, `apps/mobile/src/lib/dev-tools/*`, `apps/mobile/src/components/DevToolsFab.tsx` (or wherever the FAB lives), `apps/mobile/.env.example`, `.env.dev.local`
- **Does NOT touch**: schema / migrations (user-scoped RLS already isolates by `user_id`); @arc/core; @arc/data-sources; Edge Functions
- **Depends on**: Block A-C done (real market APIs wired); existing seed scripts under `apps/mobile/src/lib/dev-tools/run-*-seed-client.ts`

---

## Why this exists

After Block C UAT, the product still has zero embodied feel for real-data accuracy because all prior testing rode synthetic seed scenarios. Block D Phase 3 (雪球对标 ≤1% error on 3 标的 ≥6 月) **requires** persistent real holdings, and dogfooding against Delta / 支付宝 surfaces edge cases (FX rounding, cost-basis drift, dividend timing) that seed data cannot generate.

We split DEV testing into two named environments:

- **Real Env** — the user's actual portfolio, persisted across Metro restarts forever. Hand-curated through the app UI; no DEV button can wipe it. This holds the 6-month dataset for Phase 3 verification.
- **Clean Env** — a one-click reset slate for onboarding flows, new-feature testing, and screen-recording for spec snapshots. All existing scenario buttons (`portfolios:*`, `watchlist:*`, `rebalance:*`, `welcome:*`, `crossMarket:*`) continue to land here.

---

## Resolved decisions (BoyangJiao 2026-05-25)

### 1. Env separation = two Gmail `+alias` auth users (NOT one user + flag)

- `DEV_REAL_EMAIL = cyberjby+arc-real@gmail.com`
- `DEV_CLEAN_EMAIL = cyberjby+arc-clean@gmail.com`

Rationale: watchlist, `welcome_seen`, `last-used-market`, color mode, reporting currency are **user-scoped**, not portfolio-scoped. Onboarding tests demand `welcome_seen=false` + zero portfolios; single-user "is_test_data" flags can't reset user-level state cleanly. Two auth users + existing RLS is zero-schema-change and bulletproof.

Existing `DEV_SEED_EMAIL` becomes an **alias for `DEV_CLEAN_EMAIL`** during the transition (back-compat with current scenario scripts); deprecation note in `.env.example`.

### 2. Reset Clean Env wipes EVERYTHING including `user_preferences`

Full new-user simulation: language, reporting currency, red-up/green-down, redacted, welcome-seen all reset to defaults. Lets us measure the entire onboarding flow including Settings discovery, not just the financial-data half.

### 3. Real Env guardrail = minimal (FAB scenario buttons hidden+tooltip when signed in as Real)

No double-confirm typing, no startup status bar, no empty-warning. Trusts the user not to misclick once seed buttons are visually disabled.

---

## User journey

### J-RE.1 — First-time setup (one-off)

1. User adds two `+alias` emails to `apps/mobile/.env` (gitignored)
2. User boots app → signs in as `+arc-clean` via OTP → app creates the Supabase auth user via existing magic-link flow → no scenario seeded → user is in Clean Env empty state
3. User opens DEV FAB → **Environment** section → "Switch to Real" → OTP flow with `+arc-real` → app creates second auth user → user in Real Env empty state
4. User walks through onboarding once in Real Env (录入真实持仓 / 设置 target allocation / 添加 watchlist)
5. Real Env is now seeded with real data; locked from this point on

### J-RE.2 — Daily real-use loop (Real Env)

1. User opens app → already signed in as `+arc-real` (Supabase session persisted in AsyncStorage)
2. Adds a transaction matching what they actually did in their brokerage today
3. Compares the daily snapshot card / TWR / valuations against Delta / 支付宝
4. Notes any discrepancy → switches to GitHub Issue or session-state notes

### J-RE.3 — Test a new feature (Clean Env reset)

1. User opens DEV FAB → **Environment** → "Switch to Clean"
2. (If Clean already has data from previous test) "Reset Clean Env" → confirm → all clean-user rows deleted + AsyncStorage cleared + QueryClient invalidated + route to `/welcome`
3. Walks the onboarding flow / new feature fresh
4. Switches back to Real when done

---

## Architecture

### File layout

```
apps/mobile/
├── .env.example                      ← + DEV_REAL_EMAIL / DEV_CLEAN_EMAIL example values
└── src/
    ├── lib/
    │   ├── auth.tsx                  ← (M) signInWithOtpCode unchanged; add optional currentEnvLabel helper
    │   ├── dev-tools/
    │   │   ├── env-mode.ts           ← (NEW) DevEnvMode = 'real' | 'clean' | 'unknown'; detect via session.user.email
    │   │   ├── run-reset-clean.ts    ← (NEW) deletes user-scoped rows + clears AsyncStorage; gated on email match
    │   │   ├── scenarios.ts          ← (M) add `requiredEnv: 'clean' | 'any'` per scenario (all current = 'clean')
    │   │   └── dev-tools-fab-store.ts ← (M) expose `envMode` selector
    └── components/
        └── DevToolsFab.tsx           ← (M) new top section "Environment" + signed-in email badge + Switch/Reset buttons; gate scenario list rendering by envMode
```

### New module: `env-mode.ts`

```ts
import { Constants } from "expo-constants";
export type DevEnvMode = "real" | "clean" | "unknown";

const REAL_EMAIL = Constants.expoConfig?.extra?.devRealEmail as string | undefined;
const CLEAN_EMAIL = Constants.expoConfig?.extra?.devCleanEmail as string | undefined;

export const detectEnvMode = (email: string | undefined): DevEnvMode => {
  if (!email) return "unknown";
  if (REAL_EMAIL && email.toLowerCase() === REAL_EMAIL.toLowerCase()) return "real";
  if (CLEAN_EMAIL && email.toLowerCase() === CLEAN_EMAIL.toLowerCase()) return "clean";
  return "unknown";
};

export const REAL_EMAIL_FROM_CONFIG = REAL_EMAIL;
export const CLEAN_EMAIL_FROM_CONFIG = CLEAN_EMAIL;
```

### New script: `run-reset-clean.ts` (sketch)

```ts
import { supabase } from "../supabase-client";
import { detectEnvMode } from "./env-mode";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient } from "@tanstack/react-query";

/** Hard preconditions — refuses to run if not signed in as Clean. */
export const resetCleanEnv = async (queryClient: QueryClient): Promise<void> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not signed in");
  if (detectEnvMode(user.email) !== "clean") {
    throw new Error(`refusing to reset — signed in as ${user.email}, not Clean Env`);
  }

  // RLS-mediated deletes (user.id auto-filtered)
  await supabase.from("watchlist_items").delete().eq("user_id", user.id);
  await supabase.from("portfolio_value_snapshots").delete().eq("user_id", user.id);
  await supabase
    .from("target_allocations")
    .delete()
    .in(
      "portfolio_id",
      (await supabase.from("portfolios").select("id").eq("user_id", user.id)).data?.map(
        (p) => p.id
      ) ?? []
    );
  await supabase.from("transactions").delete().eq("user_id", user.id);
  await supabase.from("portfolios").delete().eq("user_id", user.id);
  await supabase.from("user_preferences").delete().eq("user_id", user.id);

  // AsyncStorage — match the exact keys actually written
  const KEYS = [
    "active-portfolio-id",
    "welcome-seen",
    "color-mode",
    // last-used-market is per-portfolio; safe to bulk-clear matching prefix
  ];
  await AsyncStorage.multiRemove(KEYS);
  const allKeys = await AsyncStorage.getAllKeys();
  const lastUsedKeys = allKeys.filter((k) => k.startsWith("last-used-market-"));
  if (lastUsedKeys.length > 0) await AsyncStorage.multiRemove(lastUsedKeys);

  // TanStack — drop all cached queries
  queryClient.clear();
};
```

**RLS check**: every table above has `... WHERE user_id = auth.uid()` policies (migrations 0001-0013 audited). The `.eq("user_id", user.id)` filter is belt-AND-suspenders.

### DEV FAB UI changes

Top section above existing **功能 → 场景** picker:

```
┌─ Environment ─────────────────────────────────┐
│ Signed in as: cyberjby+arc-real@gmail.com     │
│ Mode: 🟢 Real (persistent)                    │
│                                               │
│ [ Switch to Clean ]                           │
│                                               │
│ ⓘ Scenario buttons below are hidden in Real   │
│   env to prevent accidental data overwrite.   │
└───────────────────────────────────────────────┘

(scenario picker rendered iff envMode === 'clean')

┌─ Environment ─────────────────────────────────┐
│ Signed in as: cyberjby+arc-clean@gmail.com    │
│ Mode: 🟡 Clean (resettable)                   │
│                                               │
│ [ Switch to Real ]   [ 🗑 Reset Clean Env ]   │
└───────────────────────────────────────────────┘

┌─ 功能 → 场景（existing） ─────────────────────┐
│ 每日快照 / 组合 / 自选 / 再平衡 / Welcome / … │
└───────────────────────────────────────────────┘
```

`envMode === 'unknown'` (signed out, or signed in as a non-+arc email): show only env switcher; scenario list hidden with note "Sign in to Clean to seed scenarios."

### Switching mechanic

Switch action = `signOut()` → `signInWithOtpCode(targetEmail)` → user enters OTP from email → `verifyOtpCode(targetEmail, code)`. Same OTP flow already used elsewhere — zero new auth code. OPTIONAL: prefill the OTP entry screen with `targetEmail` so the user only types the 8-digit code.

### Env variables

`apps/mobile/.env.example`:

```bash
# Dev environments (real-data dogfooding — see .specify/feature-specs/cross-stage/real-env-dev-tools.md)
# Use Gmail +alias to keep one inbox; Supabase treats +alias as separate auth users.
DEV_REAL_EMAIL=youremail+arc-real@gmail.com
DEV_CLEAN_EMAIL=youremail+arc-clean@gmail.com

# Existing variable, kept for backward-compat with run-*-seed-client.ts scripts.
# Should equal DEV_CLEAN_EMAIL.
DEV_SEED_EMAIL=youremail+arc-clean@gmail.com
```

`apps/mobile/app.config.ts` (or similar) wires these into `Constants.expoConfig.extra.devRealEmail/devCleanEmail` for runtime read.

---

## Acceptance criteria (S3-AC-RE.x)

### S3-AC-RE.1 — First-boot Real Env path

**Given** fresh install, env vars set, no Supabase auth user exists yet
**When** user opens app → DEV FAB → "Switch to Real" → enters OTP from `+arc-real`
**Then** Supabase creates the auth user, app routes to `/welcome` (welcome_seen=false), envMode='real'
**And** the DEV FAB scenario buttons (`portfolios:*` etc.) are visually disabled with tooltip

### S3-AC-RE.2 — Persistent Real Env across Metro restart

**Given** signed in as `+arc-real` with N transactions + M portfolios saved
**When** Metro restart with `--clear`
**Then** app boots straight to Portfolio Tab (no welcome), session still alive
**And** all N tx / M portfolios load via existing queries
**And** envMode badge in DEV FAB shows 🟢 Real

### S3-AC-RE.3 — Reset Clean wipes everything for clean user only

**Given** signed in as `+arc-clean`; Real Env has its own data; Clean has 3 portfolios + 5 watchlist + targets
**When** DEV FAB → "Reset Clean Env" (no confirm dialog per §决策 3, just immediate)
**Then** all Clean user's `transactions / portfolio_value_snapshots / target_allocations / portfolios / watchlist_items / user_preferences` rows deleted
**And** AsyncStorage keys `active-portfolio-id / welcome-seen / color-mode / last-used-market-*` cleared
**And** QueryClient.clear() fired; route resets to `/welcome`
**And** **Real Env data UNCHANGED** (verify by signing back into Real → portfolios still there)

### S3-AC-RE.4 — Real Env scenario-button guard

**Given** signed in as `+arc-real`
**When** DEV FAB opens
**Then** all entries under **功能 → 场景** are either hidden OR rendered with `disabled` + tooltip "Switch to Clean env to seed scenarios"
**And** clicking a (disabled) scenario button does nothing — no network, no DB write

### S3-AC-RE.5 — Switch Real ↔ Clean preserves both envs' data

**Given** Real Env has data set X; Clean Env has data set Y (or empty)
**When** user switches Real → Clean → Real over the course of a session
**Then** Real Env's X is byte-identical before and after the round-trip
**And** Clean Env's Y is byte-identical before and after the round-trip
**And** No data crosses the user boundary (RLS verified)

---

## Implementation plan

> Routing: **Sonnet/Cursor 首选** (RN UI + auth flow + seed script — CLAUDE.md §七). ~3-4h estimate.

### Commit chain

1. **`feat(mobile): env-mode detection + .env DEV_REAL_EMAIL / DEV_CLEAN_EMAIL`** — `env-mode.ts` + `app.config.ts` wiring + `.env.example` update. No UI yet.
2. **`feat(mobile): run-reset-clean.ts + RLS-mediated user-scoped delete script`** — pure script + unit test (Vitest, mocking supabase client) covering "refuses when not Clean" + "deletes all expected tables."
3. **`feat(mobile): DEV FAB Environment section + env switcher + reset button`** — UI changes in `DevToolsFab.tsx`. Switch = signOut+signInWithOtpCode prefilled.
4. **`feat(mobile): gate scenarios.ts entries by envMode === 'clean'`** — add `requiredEnv: 'clean' | 'any'` field; gate scenario rendering; tooltip when disabled.
5. **`test(mobile): reset-clean smoke + envMode unit + S3-AC-RE.4 button-guard`** — Vitest cases under `apps/mobile/src/lib/__tests__/`.
6. **`docs(spec+state): real-env feature ready, Phase 3 dependency unblocked`** — bump session-state with "Real Env onboarding queued" + spec status → Accepted/Implemented.

### Verification gates (per commit)

- `pnpm typecheck` 6/6 ✅
- `pnpm --filter @arc/mobile test` (existing 16 + new ones) ✅
- After commit #3: manual smoke — open DEV FAB, see env badge, verify Switch action triggers OTP flow
- After commit #5: manual S3-AC-RE.1/.2/.3/.4/.5 sign-off

### Out of scope

- **Schema changes**: zero (user-scoped RLS already covers isolation)
- **Edge Functions**: zero
- **Onboarding flow itself**: unchanged; this spec only sets up the testbed
- **Production builds**: DEV FAB already excluded from prod via existing `if (__DEV__)` guard
- **Sentry tagging by env**: future polish (FU-RE.1 below)

---

## Risks

| Risk                                                                                       | Likelihood | Impact                       | Mitigation                                                                                                                                                                       |
| :----------------------------------------------------------------------------------------- | :--------- | :--------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User accidentally clicks Reset while in Real Env                                           | Low        | HIGH (loses 6-month dataset) | §决策 3 button is only visible in Clean Env; Real Env shows NO reset UI. Decision 3 traded extra friction (typing RESET) for trust+simplicity. Revisit if first-incident occurs. |
| Switching auth users invalidates fxCache / priceCache shared at app-singleton level        | Med        | Med (stale data flash)       | QueryClient.clear() on every env switch; ADR 010 stale-quote detection catches the rest                                                                                          |
| Gmail +alias not accepted by Supabase auth (some providers strip)                          | Low        | Med (blocks setup)           | Verify during commit #1 manual smoke; fallback to two distinct emails                                                                                                            |
| `app.config.ts` reading `process.env` doesn't flow to runtime `Constants.expoConfig.extra` | Med        | Med                          | Verify via `console.log(Constants.expoConfig?.extra)` in commit #1; existing `EXPO_PUBLIC_*` env vars use a different bridge — pattern needs to match                            |

---

## Known limitations / follow-ups

- **FU-RE.1** Tag Sentry events with `env: real | clean` so production crash reports auto-filter dev noise (Stage 4 observability pass)
- **FU-RE.2** Add a "Export Real Env data" DEV button (JSON dump of transactions for offline backup before risky migrations)
- **FU-RE.3** Snapshot Real Env weekly into a separate backup table (Phase 3 confidence — if user accidentally edits real data, restore last good)
- **FU-RE.4** Convert Real Env onboarding into the canonical "design-snapshot" target for Block F polish PR review

---

## Hand-off to Sonnet/Cursor

See [`.specify/handoffs/cursor-real-env-dev-tools-kickoff.md`](../../handoffs/cursor-real-env-dev-tools-kickoff.md) — copy that block into a fresh Sonnet/Cursor chat.

---

## Next after this spec

User manually walks J-RE.1 first-time setup (likely a Saturday afternoon: re-enter Delta/支付宝 positions into Real Env). Block D Phase 3 雪球对标 then runs against this Real Env data with no further infra work.
