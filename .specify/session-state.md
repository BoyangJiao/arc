# Arc — Session State (Live)

> **READ THIS FIRST in every new AI session** (Cursor, Claude Code, Qoder, etc.).
>
> Update mechanism: `/checkpoint` (Cursor command or Claude skill).
>
> **Never write here:** API keys, JWTs, `DATABASE_URL`, `.env` contents, or other secrets.
>
> **Last updated**: 2026-05-18 by Claude Opus 4.7 (P1 Deno tests + Watchlist spec + watchlist_items schema/migration 0004 all committed; cron secrets rotated 3× → final value live on both sides; cron go-live decision = wait for Stage 2 → main merge; **Watchlist commit plan #2-#8 handing off to Sonnet (Cursor)**; CLAUDE.md §十二 "模型自我路由" rule added)

---

## You are here

| Field                 | Value                                                                                                                                       |
| :-------------------- | :------------------------------------------------------------------------------------------------------------------------------------------ |
| **Active stage**      | **Stage 2 — J8 Watchlist 启动**                                                                                                             |
| **Step**              | J7 ✅; J8 spec Accepted; commit plan #1 (db schema + migration 0004) landed; **#2-#8 handing off to Sonnet (Cursor)** per CLAUDE.md §十二   |
| **Branch**            | `dev/stage-2` (tracks `origin/dev/stage-2`) — 3 commits ahead this session; uncommitted: CLAUDE.md §十二 + AGENTS.md route rule + this file |
| **Last commit**       | `0b2c1fd` — feat(db): watchlist_items schema + migration 0004 + RLS                                                                         |
| **PR**                | Stage 2 work on `dev/stage-2`; Stage 1 PR #5 already merged                                                                                 |
| **CI status**         | Local monorepo typecheck ✅ / lint ✅ / test ✅ (all FULL TURBO cached this session)                                                        |
| **Mobile dev server** | User local Metro; after overlay changes use **⌘D → Reload** (not ⌘R on iOS Simulator)                                                       |

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

## Stage 2 — J8 Watchlist progress (started 2026-05-18)

| Item                                                                           | Status                                   |
| :----------------------------------------------------------------------------- | :--------------------------------------- |
| Feature spec (`watchlist-stage-2.md`) Accepted; 6 open questions locked        | ✅ committed (`70bd38e`)                 |
| **Commit plan #1** db schema + migration 0004 + RLS (3 policies)               | ✅ committed (`0b2c1fd`)                 |
| Apply 0004 to dev Supabase (SQL Editor)                                        | ⏳ **user task** — anytime before #5     |
| **Commit plan #2** `WatchlistRow` type in `@arc/core`                          | ⏳ → Sonnet                              |
| **Commit plan #3** AV `searchSymbols` + static-symbols fallback + test         | ⏳ → Sonnet                              |
| **Commit plan #4** `WatchlistRow` + `WatchlistEmptyState` in `@arc/ui/finance` | ⏳ → Sonnet                              |
| **Commit plan #5** `use-watchlist` + `use-watchlist-quotes` + Markets Tab      | ⏳ → Sonnet                              |
| **Commit plan #6** `/markets/search` modal + `use-symbol-search`               | ⏳ → Sonnet                              |
| **Commit plan #7** 3 watchlist seed scenarios + CLI shortcuts                  | ⏳ → Haiku (镜像 daily-snapshot:\* 模式) |
| **Commit plan #8** Update `user-journeys.md` J8 (drop "5s" claim)              | ⏳ → Haiku                               |

### Uncommitted work (this session — checkpoint commit)

- **`CLAUDE.md`** — added §十二 "模型自我路由（半自动）" rule (durable preference per 2026-05-18 conversation)
- **`AGENTS.md`** — added cross-tool pointer to §十二
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

- **Migration 0004 SQL apply** — paste `packages/db/drizzle/migrations/0004_watchlist_items.sql` into Supabase SQL Editor (dev project) and run. Verify: `SELECT count(*) FROM pg_policies WHERE tablename='watchlist_items'` → 3; `SELECT relrowsecurity FROM pg_class WHERE relname='watchlist_items'` → t. Non-blocking until commit plan #5 lands queries.
- **`brew install deno`** before `pnpm test:functions` runs (Deno not on PATH; tests landed + ready).
- **Daily-snapshot cron production go-live** — DEFERRED to Stage 2 → main merge (decision 2026-05-18). Supabase + GitHub secrets are configured and idle until then. `pnpm typecheck` / `lint` / `test` still green.

## Immediate next actions (next session, 按顺序)

**A. Commit the checkpoint files (this session — small)**

Single commit `docs(claude-md): add §十二 模型自我路由 + checkpoint session-state`. Touches:

- `CLAUDE.md` (§十二 new section)
- `AGENTS.md` (cross-tool pointer)
- `.specify/session-state.md` (this file)

**B. Hand-off to Sonnet (Cursor) — Watchlist commit plan #2-#8**

Per CLAUDE.md §七 + §十二, #2-#6 are RN/CRUD/adapter territory → Sonnet. #7-#8 are doc/seed mechanical → Haiku. Routing rationale:

| #   | Task                                                                                                                                                                                                                                                          | Model  |
| :-- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----- |
| #2  | `packages/core/src/domain/watchlist.ts` — `WatchlistRow` type (Decimal-typed quote sub-record, nullable, stale flag)                                                                                                                                          | Sonnet |
| #3  | `packages/data-sources/src/adapters/alphavantage.ts` — add `searchSymbols(query)` calling AV `SYMBOL_SEARCH`; `static-symbols.ts` top-200 US tickers JSON; new `searchSymbols` wraps static first, falls back to AV on zero matches; vitest for fallback path | Sonnet |
| #4  | `packages/ui/src/finance/WatchlistRow.tsx` + `WatchlistEmptyState.tsx` — presentational only, takes props; uses `useBusinessClasses().gain/loss/pnlNeutral`; mirror `DailySnapshotCard` structure                                                             | Sonnet |
| #5  | `apps/mobile/src/lib/queries/use-watchlist.ts` (list/add/remove TanStack hooks) + `use-watchlist-quotes.ts` (per-row quote, 5-min cache TTL, pull-to-refresh bypass) + replace `apps/mobile/app/(tabs)/markets.tsx` stub                                      | Sonnet |
| #6  | `apps/mobile/app/markets/search.tsx` modal route + `use-symbol-search.ts` (debounced 350ms) — already-in-watchlist results show ✓ + toast; AV 429 inline error                                                                                                | Sonnet |
| #7  | `supabase/functions/_shared/seed-core.ts` add 3 scenarios `watchlist:empty` / `watchlist:3-items` / `watchlist:stale-quotes`; `tools/seed-dev-data.ts` + `package.json` shortcuts                                                                             | Haiku  |
| #8  | `docs/user-journeys.md` J8 — replace "实时价 5s 内刷新" with cache-TTL semantics                                                                                                                                                                              | Haiku  |

**Switch-back-to-Opus triggers** (Sonnet/Haiku → 找 Opus 回来):

- #3 fallback edge case: 静态表非空但 AV 429 处理 / 大小写归一 反复改不对
- 任何 `packages/core/` 算法 (Stage 2 没 — Stage 3 TWR 才会触发)
- 用户改 J8 验收条款 (回到 spec 重谈)
- 安全审查 (Stage 2 末)

**C. After #2-#8 done** — manual UAT against S2-AC-2.1-2.8 (per spec §test plan), then either continue to Rebalance (J9) or open Stage 2 → main PR if Watchlist + Rebalance + Welcome all 绿.

**D. Pattern for future features**

Spec → schema/migration → core type → adapter → UI components → app hooks/pages → seed scenarios → doc收尾. New Edge Functions follow dev-seed `handler.ts` + `index.ts` split for testability. Model routing always evaluated at task boundary per §十二.

## Open decisions / questions

- **Resolved 2026-05-18**: Stage 2 order = Daily Snapshot ✅ → Watchlist → Rebalance → Welcome; CSV → Stage 3 末.
- **Resolved 2026-05-18**: cron go-live deferred to Stage 2 → main merge (no production users yet; secrets idle but configured).
- **Resolved 2026-05-18**: model routing = semi-automatic per CLAUDE.md §十二 (evaluate at task boundary; suggest don't switch unilaterally).
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
