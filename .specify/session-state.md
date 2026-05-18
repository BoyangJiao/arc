# Arc — Session State (Live)

> **READ THIS FIRST in every new AI session** (Cursor, Claude Code, Qoder, etc.).
>
> Update mechanism: `/checkpoint` (Cursor command or Claude skill).
>
> **Never write here:** API keys, JWTs, `DATABASE_URL`, `.env` contents, or other secrets.
>
> **Last updated**: 2026-05-18 by Cursor Composer (J8 Watchlist shipped + UAT fixes + dev tools two-level menu; uncommitted polish on `dev/stage-2`)

---

## You are here

| Field                 | Value                                                                                                                       |
| :-------------------- | :-------------------------------------------------------------------------------------------------------------------------- |
| **Active stage**      | **Stage 2 — J8 Watchlist UAT**                                                                                              |
| **Step**              | J7 ✅; J8 code **#1–#8 committed** (`082ab0e`); **UAT + uncommitted fixes** (add UX, dev tools menu, client watchlist seed) |
| **Branch**            | `dev/stage-2` — last commit `082ab0e`; **~10 files uncommitted** (see below)                                                |
| **Last commit**       | `082ab0e` — docs(spec): user-journeys J8 cache TTL                                                                          |
| **PR**                | Stage 2 on `dev/stage-2`; Stage 1 PR #5 merged                                                                              |
| **CI status**         | Local `pnpm typecheck` 6/6 ✅ (this checkpoint)                                                                             |
| **Mobile dev server** | User Metro; UI changes → **⌘D → Reload**                                                                                    |

## Stage 2 — J7 Daily Snapshot progress

| Item                                                                  | Status                                             |
| :-------------------------------------------------------------------- | :------------------------------------------------- |
| DB migration `0003` (`portfolio_value_snapshots` + `per_asset` + RLS) | ✅ applied on dev Supabase                         |
| `computeDailyDelta` + property tests                                  | ✅ committed                                       |
| `DailySnapshotCard` + Portfolio Tab integration                       | ✅ committed                                       |
| `daily-snapshot` Edge Function + GH Actions cron                      | ✅ committed (ADR 009)                             |
| `seed:dev` + `--scenario` (6 UI states)                               | ✅ committed                                       |
| **S2-AC-1.1–1.5 UAT**                                                 | ✅ user verified 2026-05-17                        |
| S2-AC-1.6 / 1.7 (cron idempotent, no external API)                    | ⏳ not formally signed off                         |
| S1-AC-5 (red-up/green-down via card)                                  | ✅ `daily-snapshot:mixed-movers` + Settings toggle |

## Stage 2 — J8 Watchlist progress (started 2026-05-18)

| Item                                                                       | Status                             |
| :------------------------------------------------------------------------- | :--------------------------------- |
| Feature spec (`watchlist-stage-2.md`) Accepted                             | ✅ `70bd38e`                       |
| Commit plan **#1–#8** (schema → core → adapter → UI → hooks → seed → docs) | ✅ `0b2c1fd` … `082ab0e`           |
| Migration **0004** applied on dev Supabase                                 | ✅ **user confirmed** (SQL Editor) |
| **UAT S2-AC-2.1–2.8**                                                      | ⏳ in progress                     |
| Post-ship fixes (**uncommitted**, typecheck ✅)                            | see §Uncommitted work              |

### Uncommitted work (checkpoint snapshot — commit before next PR slice)

| Area                 | Files                                                                                                         | What                                                                                                                      |
| :------------------- | :------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------ |
| **Add to watchlist** | `use-watchlist.ts`, `markets/search.tsx`, i18n                                                                | `assets` upsert `ignoreDuplicates: true` (RLS INSERT-only); search loading + `router.canGoBack()`; quote errors swallowed |
| **Dev tools UX**     | `scenarios.ts`, `DevToolsScenarioPanel.tsx`, `invoke-dev-seed.ts`, `run-watchlist-seed-client.ts` (new), i18n | Two-level menu: **功能 → 场景**; watchlist scenarios seed **on-device** (no Edge deploy)                                  |
| **Edge seed**        | `seed-core.ts`                                                                                                | Clearer error if `watchlist_items` table missing                                                                          |
| **Session**          | `.specify/session-state.md`                                                                                   | this checkpoint                                                                                                           |

Suggested commits (next session):

1. `fix(mobile): watchlist add UX + assets upsert ignoreDuplicates`
2. `feat(mobile): dev tools feature menu + client watchlist seed`

## Testing harness (canonical docs)

| Layer           | Arc artifact                                                                                               |
| :-------------- | :--------------------------------------------------------------------------------------------------------- |
| Strategy        | [`docs/testing-strategy.md`](../docs/testing-strategy.md)                                                  |
| UAT spec        | [`.specify/feature-specs/watchlist-stage-2.md`](../.specify/feature-specs/watchlist-stage-2.md) §S2-AC-2.x |
| UAT commands    | [`docs/dev-seed-cheatsheet.md`](../docs/dev-seed-cheatsheet.md)                                            |
| CLI watchlist   | `pnpm seed:wl:empty` / `pnpm seed:wl:3` / `pnpm seed:wl:stale`                                             |
| **App DEV FAB** | **功能 → 场景** — 自选场景走 App 内种子；每日快照仍要 Edge `dev-seed` deploy                               |
| Edge deploy     | `pnpm functions:deploy:dev-seed` + `pnpm functions:secrets:dev-tools` (Daily Snapshot scenarios only)      |

## Active blockers / waiting on user

- **Commit uncommitted J8 polish** — UAT fixes + dev tools menu not yet on git (see table above).
- **`brew install deno`** — before `pnpm test:functions` locally.
- **Daily-snapshot cron go-live** — deferred to Stage 2 → main merge (2026-05-18).

## Immediate next actions (next session)

**1. Commit uncommitted work** (two logical commits suggested in table above).

**2. Continue J8 UAT** — spec `.specify/feature-specs/watchlist-stage-2.md`:

- DEV FAB → **自选** → `自选 3 只` / `自选为空` / `自选过期报价` (no Edge deploy needed for watchlist)
- Or CLI: `pnpm seed:wl:*`
- **S2-AC-2.1**: search add → loading → auto-close → row visible; cold restart persists
- Settings fixture toggle OFF for most flows; ON for cache TTL / AV tests

**3. After S2-AC-2.x green** — J9 Rebalance or Stage 2 → main PR.

## Open decisions / questions

- **Resolved 2026-05-18**: Watchlist DEV seed in App uses **client JWT path** for `watchlist:*` only; portfolio reset scenarios still need Edge Function.
- **Resolved 2026-05-18**: Dev tools UI = **two-level** (feature picker → scenarios), not flat list.
- Whether to ADR Dev Tools overlay + dual seed paths (optional).
- `daily-snapshot:happy` dead alias in `seed-core.ts` — delete when touching seed next.

## Critical mental model (gotchas easy to forget)

- **Decimal.js everywhere** — see `packages/core/__tests__/`.
- **`assets` upsert**: RLS allows INSERT only → use `{ onConflict: "id", ignoreDuplicates: true }` or UPDATE fails on seeded symbols (AAPL/NVDA).
- **Watchlist dev seed**: purple DEV **自选** scenarios = `run-watchlist-seed-client.ts` (user JWT); does **not** reset portfolio. Daily Snapshot scenarios = Edge `dev-seed`.
- **Dev seed**: `service_role` only in CLI / Edge — never in app bundle.
- **iOS Simulator refresh**: **⌘D → Reload** (⌘R = screenshot).
- **Migration 0004** required for watchlist table + DEV watchlist seed.
- All prior Stage 1 gotchas still apply (FixtureAdapter, @arc/ui imports, OTP 8-digit, etc.).

## Active env / config snapshot

| File               | Status                                               |
| :----------------- | :--------------------------------------------------- |
| `apps/mobile/.env` | Supabase + AV key                                    |
| `.env.dev.local`   | `SUPABASE_DEV_*`, `DEV_SEED_EMAIL`                   |
| Migrations         | `0001`–`0004` on dev project (**0004 user-applied**) |
| Supabase project   | `jdvlzkictwinkgcvgwew`                               |
| Git branch         | `dev/stage-2`                                        |

## Recent ADRs (most relevant first)

| ADR     | Topic                                                          |
| :------ | :------------------------------------------------------------- |
| **009** | Daily Snapshot timing (23:00 UTC) + cron + cache-only snapshot |
| 008     | FixtureAdapter + Settings market-data toggle                   |
| 007     | Dev auth + seed SQL injection                                  |
| 006     | `@arc/ui` layering                                             |

## How to use this file

1. Read CLAUDE.md → this file → `watchlist-stage-2.md` if doing J8 UAT.
2. DEV FAB: pick **自选** or **每日快照**, then a scenario.
3. End session: `/checkpoint`.
