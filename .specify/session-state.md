# Arc — Session State (Live)

> **READ THIS FIRST in every new AI session** (Cursor, Claude Code, Qoder, etc.).
>
> Update mechanism: `/checkpoint` (Cursor command or Claude skill).
>
> **Never write here:** API keys, JWTs, `DATABASE_URL`, `.env` contents, or other secrets.
>
> **Last updated**: 2026-05-18 by Claude Opus 4.7 (audit of Cursor's dev-harness; 5-commit split plan ready)

---

## You are here

| Field                 | Value                                                                                                                      |
| :-------------------- | :------------------------------------------------------------------------------------------------------------------------- |
| **Active stage**      | **Stage 2 — in progress**                                                                                                  |
| **Step**              | J7 Daily Snapshot UAT done; Cursor's dev-harness **audited + 5-commit split plan ready**; awaiting user "go" to apply      |
| **Branch**            | `dev/stage-2` (tracks `origin/dev/stage-2`) — 1 commit ahead (`1bb402d` Cursor checkpoint), large uncommitted batch on top |
| **Last commit**       | `1bb402d` — chore(state): Daily Snapshot UAT done, dev harness uncommitted (Cursor)                                        |
| **PR**                | Stage 2 work on `dev/stage-2`; Stage 1 PR #5 already merged                                                                |
| **CI status**         | Local monorepo typecheck ✅ / lint ✅ / test ✅ (all FULL TURBO cached this session)                                       |
| **Mobile dev server** | User local Metro; after overlay changes use **⌘D → Reload** (not ⌘R on iOS Simulator)                                      |

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

- **User go-ahead** to apply the 5-commit split (below) for the dev-harness batch.
- **Optional**: formal sign-off S2-AC-1.6/1.7; Storybook P1 for `@arc/ui/finance`.

## Immediate next actions (next session, 按顺序)

**A. Commit the dev-harness batch (5-commit split plan, 2026-05-18 audit)**

| #     | Commit                                                               | Scope                                                                                                                                                                                                                                                                                                                          |
| :---- | :------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** | `chore(gitignore): supabase CLI tmp + cheatsheet placeholder`        | Add `supabase/.temp/` to `.gitignore` (P2-3); replace hardcoded `jdvlzkictwinkgcvgwew` in `docs/dev-seed-cheatsheet.md` with `<your-project-ref>` (P2-4)                                                                                                                                                                       |
| **B** | `feat(dev-tools): shared seed-core + CLI extends to --scenario`      | `supabase/functions/_shared/seed-core.ts` + `tools/seed-dev-data.ts` + `package.json` (6 `seed:*` scripts) + `.env.dev.example`. **In this commit: delete `daily-snapshot:happy` from seed-core (P2-1 — dead alias of default; FE never invokes it)**                                                                          |
| **C** | `feat(dev-tools): dev-seed Edge Function (5-layer security)`         | `supabase/functions/dev-seed/` (new index.ts + README.md) + `package.json` `functions:*` scripts. Audit verified all 5 defenses (prod URL block / `DEV_TOOLS_ENABLED` gate / Bearer auth / scenario whitelist / user-scoped via JWT). **P1**: add Deno unit tests post-cron-deploy (not blocking commit)                       |
| **D** | `feat(dev-tools): in-app FAB + ScenarioPanel + /me/dev-tools + docs` | `apps/mobile/app/me/dev-tools.tsx` + `apps/mobile/src/components/dev-tools/` + `apps/mobile/src/lib/dev-tools/` + root `_layout.tsx` overlay mount + `settings.tsx` CTA + i18n + `.vscode/tasks.json` + `.cursor/commands/seed-dev.md` + `docs/testing-strategy.md` + `docs/dev-seed-cheatsheet.md` + feature-spec + CLAUDE.md |
| **E** | `chore(design): regenerate Pencil Stage 1 design file`               | `tools/generate-stage1-design-pen.mjs` + `docs/design/Arc stage1 design.pen`. **Independent** of dev-harness — Stage 1 cleanup, separate commit                                                                                                                                                                                |

Order: A → B → C → D → E. Verify `pnpm typecheck` / `lint` / `test` after each.

**B. Production cron go-live (when ready)**

1. `brew install supabase/tap/supabase` (one-time)
2. `openssl rand -hex 32` → save the secret
3. `supabase link --project-ref jdvlzkictwinkgcvgwew && supabase secrets set DAILY_SNAPSHOT_SECRET=<secret>`
4. `supabase functions deploy daily-snapshot`
5. GitHub repo Settings → Secrets: `SUPABASE_DAILY_SNAPSHOT_URL` + `DAILY_SNAPSHOT_SECRET`
6. GitHub Actions → Daily Snapshot → Run workflow → verify response

**C. Stage 2 next module**

User to prioritize: Welcome J6 / Watchlist J8 / Rebalance J9 / CSV J10 — see `docs/development-plan.md` §七. Default recommendation: **CSV J10** (biggest self-use unlock; aligns with "scratch your own itch").

**D. Pattern for future features**

Extend `seed-core` scenarios + cheatsheet + FAB panel using `feature:state` naming + `pnpm seed:<abbr>:*` aliases.

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
