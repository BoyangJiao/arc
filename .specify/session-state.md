# Arc — Session State (Live)

> **READ THIS FIRST in every new AI session** (Cursor, Claude Code, Qoder, etc.).
>
> Update mechanism: `/checkpoint` (Cursor command or Claude skill).
>
> **Never write here:** API keys, JWTs, `DATABASE_URL`, `.env` contents, or other secrets.
>
> **Last updated**: 2026-05-18 by Claude Opus 4.7 (P1 Deno tests for dev-seed landed; Stage 2 priority confirmed: Daily Snapshot → Watchlist → Rebalance; CSV downgraded to Stage 3 末)

---

## You are here

| Field                 | Value                                                                                                                                                   |
| :-------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Active stage**      | **Stage 2 — in progress**                                                                                                                               |
| **Step**              | J7 Daily Snapshot done; dev-harness 5-commit batch landed; **P1 Deno tests for dev-seed handler added**; cron production go-live pending user CLI steps |
| **Branch**            | `dev/stage-2` (tracks `origin/dev/stage-2`) — uncommitted: dev-seed handler refactor + Deno tests + docs                                                |
| **Last commit**       | `12b106d` — chore(design): regenerate Pencil Stage 1 design file via deterministic script                                                               |
| **PR**                | Stage 2 work on `dev/stage-2`; Stage 1 PR #5 already merged                                                                                             |
| **CI status**         | Local monorepo typecheck ✅ / lint ✅ / test ✅ (all FULL TURBO cached this session)                                                                    |
| **Mobile dev server** | User local Metro; after overlay changes use **⌘D → Reload** (not ⌘R on iOS Simulator)                                                                   |

## Stage 2 — J7 Daily Snapshot progress

| Item                                                                  | Status                                                           |
| :-------------------------------------------------------------------- | :--------------------------------------------------------------- |
| DB migration `0003` (`portfolio_value_snapshots` + `per_asset` + RLS) | ✅ applied on dev Supabase (user ran SQL manually)               |
| `computeDailyDelta` + property tests                                  | ✅ committed                                                     |
| `DailySnapshotCard` + Portfolio Tab integration                       | ✅ committed                                                     |
| `daily-snapshot` Edge Function + GH Actions cron                      | ✅ committed (ADR 009)                                           |
| `seed:dev` + `--scenario` (6 UI states)                               | ✅ committed (`b86f66b` + later uncommitted enhancements)        |
| **S2-AC-1.1–1.5 UAT** (all `daily-snapshot:*` scenarios)              | ✅ **user verified 2026-05-17**                                  |
| S2-AC-1.6 / 1.7 (cron idempotent, no external API)                    | ⏳ not formally signed off                                       |
| S1-AC-5 (red-up/green-down via card)                                  | ✅ verified with `daily-snapshot:mixed-movers` + Settings toggle |

### Uncommitted work (this session — commit before next feature)

- **`supabase/functions/dev-seed/handler.ts`** — pure HTTP handler extracted from `index.ts` (DI for createClient / runSeedForUser / env)
- **`supabase/functions/dev-seed/index.ts`** — now thin shell that wires real deps into `makeHandler`
- **`supabase/functions/dev-seed/handler.test.ts`** — Deno unit tests, 18 cases covering all 5 security layers + happy path + JWT user-id smuggling defense
- **`supabase/functions/dev-seed/README.md`** — appended unit-test instructions (`brew install deno && pnpm test:functions`)
- **`supabase/functions/deno.json`** — Deno config + `@supabase/supabase-js` import map
- **`package.json`** — added `test:functions` + `functions:deploy:daily-snapshot` scripts
- **`docs/development-plan.md`** — Stage 2 priority reordered; CSV moved to Stage 3 末
- **`.specify/session-state.md`** — this file

## Testing harness (canonical docs)

| Layer        | Arc artifact                                                                                                                         |
| :----------- | :----------------------------------------------------------------------------------------------------------------------------------- |
| Strategy     | [`docs/testing-strategy.md`](../docs/testing-strategy.md)                                                                            |
| UAT commands | [`docs/dev-seed-cheatsheet.md`](../docs/dev-seed-cheatsheet.md)                                                                      |
| CLI          | `pnpm seed:default` / `pnpm seed:ds:*` (needs `DEV_SEED_EMAIL` in `.env.dev.local`)                                                  |
| IDE          | Cmd+Shift+P → Tasks: Run Task → Seed: …                                                                                              |
| Cursor       | `/seed-dev` + scenario name                                                                                                          |
| **App GUI**  | **Purple DEV floating button** (any screen) → scenario sheet; Settings → Dev tools still available                                   |
| Edge deploy  | `pnpm postinstall:supabase-cli` once → `pnpm supabase login` → `pnpm functions:secrets:dev-tools` → `pnpm functions:deploy:dev-seed` |

## Active blockers / waiting on user

- **Daily-snapshot cron production go-live**: user runs interactive Supabase CLI + GitHub secrets setup (steps in "Immediate next actions B" below). Cannot be automated from this side.
- **`brew install deno`** before running `pnpm test:functions` (Deno binary not yet on PATH; tests written + ready).
- **Optional**: formal sign-off S2-AC-1.6/1.7 (will be naturally satisfied once cron runs and `portfolio_value_snapshots` rows accumulate).

## Immediate next actions (next session, 按顺序)

**A. Commit the P1-tests batch (this session)**

Single commit recommended: `test(dev-seed): Deno unit tests for 5-layer security via injected deps`. Touches:

- `supabase/functions/dev-seed/handler.ts` (new — extracted handler)
- `supabase/functions/dev-seed/index.ts` (now wires deps into makeHandler)
- `supabase/functions/dev-seed/handler.test.ts` (new — 18 Deno tests)
- `supabase/functions/dev-seed/README.md` (test instructions appended)
- `supabase/functions/deno.json` (new — Deno config + import map)
- `package.json` (`test:functions` + `functions:deploy:daily-snapshot`)
- `docs/development-plan.md` (CSV → Stage 3 末)
- `.specify/session-state.md` (this file)

Optionally split docs (CSV reprioritization) into its own commit if you prefer clean atomic history.

**B. Production cron go-live (USER — interactive CLI; do this next)**

```bash
# 1) Supabase CLI auth (one-time)
pnpm supabase login                                  # browser OAuth flow
pnpm supabase link --project-ref jdvlzkictwinkgcvgwew

# 2) Generate + store the shared secret on Supabase
SECRET=$(openssl rand -hex 32)
echo "Copy this to GitHub secrets in step 4: $SECRET"
pnpm supabase secrets set DAILY_SNAPSHOT_SECRET=$SECRET

# 3) Deploy the Edge Function
pnpm functions:deploy:daily-snapshot

# 4) Configure GitHub Actions secrets
#    Repo Settings → Secrets and variables → Actions → New repository secret:
#      SUPABASE_DAILY_SNAPSHOT_URL = https://jdvlzkictwinkgcvgwew.supabase.co/functions/v1/daily-snapshot
#      DAILY_SNAPSHOT_SECRET       = <the SECRET printed in step 2>

# 5) Smoke test
#    GitHub → Actions → "Daily Snapshot" → Run workflow → "Run workflow"
#    Verify: workflow goes green; "Edge Function response" shows portfoliosProcessed >= 1
#    Then SELECT portfolio_id, as_of, total_value FROM portfolio_value_snapshots ORDER BY as_of DESC LIMIT 5;
```

**C. Stage 2 next module (priority confirmed 2026-05-18)**

**Daily Snapshot ✅ → Watchlist (next) → Rebalance → Welcome**. CSV moved to Stage 3 末 (see `docs/development-plan.md`).

Watchlist plan: create `.specify/feature-specs/watchlist-stage-2.md` (`/(tabs)/markets` list + `/markets/search` AV modal + `watchlist_item` table + Drizzle migration 0004).

**D. Pattern for future features**

Extend `seed-core` scenarios + cheatsheet + FAB panel using `feature:state` naming + `pnpm seed:<abbr>:*` aliases. New Edge Functions should follow the dev-seed `handler.ts` + `index.ts` split so they're unit-testable.

## Open decisions / questions

- **Resolved 2026-05-18**: Stage 2 order = Daily Snapshot ✅ → Watchlist → Rebalance → Welcome; CSV → Stage 3 末.
- Whether to ADR the Dev Tools overlay + `dev-seed` Edge Function pattern (optional; cheatsheet + README exist).
- Whether to add Deno test coverage to the daily-snapshot Edge Function as well (currently no unit tests; high-leverage if we refactor it through the same `handler.ts` split pattern — defer until first bug).

## Critical mental model (gotchas easy to forget)

- **Decimal.js everywhere** — see `packages/core/__tests__/`.
- **Dev seed**: `service_role` only in CLI / Edge Function — never in app bundle. App uses user JWT → `dev-seed`.
- **Migration 0003 required** for Daily Snapshot seed (`per_asset` column); apply via SQL Editor if `seed` fails.
- **iOS Simulator refresh**: **⌘D → Reload** (⌘R is screenshot on user's machine).
- **DEV_SEED_EMAIL** in repo-root `.env.dev.local` powers `pnpm seed:*` without `--email`.
- **Supabase CLI**: `pnpm postinstall:supabase-cli` after `pnpm install` (pnpm blocks supabase postinstall by default).
- **`daily-snapshot:happy` is a dead alias** in `seed-core.ts` — exact clone of `default`, FE never invokes it. Schedule to delete in commit B above.
- **`supabase/.temp/`** appears after `pnpm supabase` runs; add to `.gitignore` (commit A above) so it doesn't keep showing up in `git status`.
- All prior Stage 1 gotchas still apply (FixtureAdapter, @arc/ui imports, OTP 8-digit, etc.).

## Active env / config snapshot

| File                | Status                                                              |
| :------------------ | :------------------------------------------------------------------ |
| `apps/mobile/.env`  | Supabase + AV key                                                   |
| `.env.dev.local`    | `SUPABASE_DEV_*`, `DEV_SEED_EMAIL` (user: cyberjby@gmail.com)       |
| Migrations          | `0001`–`0003` on dev project (`0003` user-confirmed applied)        |
| Supabase project    | `jdvlzkictwinkgcvgwew`                                              |
| `DEV_TOOLS_ENABLED` | User should set via `pnpm functions:secrets:dev-tools` after deploy |
| Git branch          | `dev/stage-2`                                                       |

## Recent ADRs (most relevant first)

| ADR     | Topic                                                          |
| :------ | :------------------------------------------------------------- |
| **009** | Daily Snapshot timing (23:00 UTC) + cron + cache-only snapshot |
| 008     | FixtureAdapter + Settings market-data toggle                   |
| 007     | Dev auth + seed SQL injection                                  |
| 006     | `@arc/ui` layering                                             |

## How to use this file

1. Read CLAUDE.md → this file → relevant feature-spec.
2. For Daily Snapshot UAT: `docs/dev-seed-cheatsheet.md` or purple **DEV** FAB.
3. End session: `/checkpoint`.
