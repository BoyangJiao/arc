# Arc — Session State (Live)

> **READ THIS FIRST in every new AI session** (Cursor, Claude Code, Qoder, etc.).
>
> Update mechanism: `/checkpoint` (Cursor command or Claude skill).
>
> **Never write here:** API keys, JWTs, `DATABASE_URL`, `.env` contents, or other secrets.
>
> **Last updated**: 2026-05-17 by Cursor (Daily Snapshot UAT + dev testing harness + floating Dev Tools)

---

## You are here

| Field                 | Value                                                                                                         |
| :-------------------- | :------------------------------------------------------------------------------------------------------------ |
| **Active stage**      | **Stage 2 — in progress**                                                                                     |
| **Step**              | J7 Daily Snapshot **implemented + UAT signed off** (6 seed scenarios); **uncommitted** dev-tools overlay work |
| **Branch**            | `dev/stage-2` (tracks `origin/dev/stage-2`)                                                                   |
| **Last commit**       | `270b6da` — docs(adr-009): daily snapshot timing + cron + cache-reuse                                         |
| **PR**                | Stage 2 work on `dev/stage-2`; Stage 1 PR #5 merge status not re-verified this session                        |
| **CI status**         | Local mobile typecheck ✅ / lint ✅ (last run this session); full monorepo not re-run after all edits         |
| **Mobile dev server** | User local Metro; after overlay changes use **⌘D → Reload** (not ⌘R on iOS Simulator)                         |

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

- **`docs/testing-strategy.md`** — layered testing playbook
- **`docs/dev-seed-cheatsheet.md`** — persistent seed/UAT command reference
- **`supabase/functions/_shared/seed-core.ts`** — shared seed logic (CLI + Edge Function)
- **`supabase/functions/dev-seed/`** — dev-only seed Edge Function (`DEV_TOOLS_ENABLED=true`)
- **`pnpm seed:*` shortcuts**, `.vscode/tasks.json`, `.cursor/commands/seed-dev.md`
- **`DevToolsFloatingOverlay`** — global draggable purple DEV FAB + bottom sheet (`__DEV__`)
- i18n + settings link; `package.json` `postinstall:supabase-cli` + `pnpm supabase` via local binary

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

- **Commit** the uncommitted testing-harness + Dev Tools overlay batch when ready (large diff on `dev/stage-2`).
- **Optional**: formal sign-off S2-AC-1.6/1.7; Storybook P1 for `@arc/ui/finance`.

## Immediate next actions (next session, 按顺序)

1. **Commit** dev testing harness + floating Dev Tools + `seed-core` refactor (single or split PR).
2. **Stage 2 next module** (user to prioritize): Welcome J6 / Watchlist J8 / Rebalance J9 / CSV J10 — see `docs/development-plan.md` §七.
3. **Storybook** (P1): `DailySnapshotCard` 4 stories — Expo 54 + Uniwind spike, separate session.
4. When adding new features: extend `seed-core` scenarios + cheatsheet + FAB panel (pattern: `feature:state`, `pnpm seed:<abbr>:*`).

## Open decisions / questions

- Stage 2 priority order among Welcome / Watchlist / Rebalance / CSV (Daily Snapshot done).
- Whether to ADR the Dev Tools overlay + `dev-seed` Edge Function pattern (optional; cheatsheet + README exist).

## Critical mental model (gotchas easy to forget)

- **Decimal.js everywhere** — see `packages/core/__tests__/`.
- **Dev seed**: `service_role` only in CLI / Edge Function — never in app bundle. App uses user JWT → `dev-seed`.
- **Migration 0003 required** for Daily Snapshot seed (`per_asset` column); apply via SQL Editor if `seed` fails.
- **iOS Simulator refresh**: **⌘D → Reload** (⌘R is screenshot on user's machine).
- **DEV_SEED_EMAIL** in repo-root `.env.dev.local` powers `pnpm seed:*` without `--email`.
- **Supabase CLI**: `pnpm postinstall:supabase-cli` after `pnpm install` (pnpm blocks supabase postinstall by default).
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
