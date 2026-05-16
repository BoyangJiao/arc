# Arc — Session State (Live)

> **READ THIS FIRST in every new AI session** (Cursor, Claude Code, Qoder, etc.).
>
> This file is the single living snapshot of "where we are right now". It's
> intentionally short and high-frequency-update. Stable rules go in
> `constitution.md`; permanent decisions in `docs/adr/`; per-feature contracts
> in `feature-specs/`. This file answers: **"if I dropped in cold, what would
> I need to know to keep working?"**
>
> Update mechanism: `/checkpoint` (Cursor command or Claude skill — see `.claude/skills/checkpoint/`)
> at end of major work blocks, OR before context window fills.
>
> **Never write here:** API keys, JWTs, `DATABASE_URL`, `.env` contents, or other secrets
> (this file is committed to Git).
>
> **Last updated**: 2026-05-17 by Claude Opus 4.7 (Stage 1 sign-off + merge prep)

---

## You are here

| Field                 | Value                                                                                                                                           |
| :-------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Active stage**      | **Stage 1 → Stage 2 transition**                                                                                                                |
| **Step**              | Stage 1 ✅ SIGNED OFF — merging dev/stage-1 → main, then opening dev/stage-2                                                                    |
| **Branch**            | `dev/stage-1` clean + pushed; about to merge to `main`                                                                                          |
| **Last commit**       | `f819520` — chore(mobile): metro monorepo paths                                                                                                 |
| **PR**                | [#5](https://github.com/BoyangJiao/arc/pull/5) — ready to merge                                                                                 |
| **CI status**         | Local typecheck ✅ / lint ✅ (6/6 packages) / test ✅ (47 + 14 + 31)                                                                            |
| **Mobile dev server** | 用户本地 Metro；改 `.env` / 切 dev toggle 后建议 `--clear` 重启                                                                                 |
| **gh CLI**            | Installed at `~/.local/bin/gh` (v2.92.0); user revoked all PATs 2026-05-17 — re-create one with `repo` scope when next needed for `gh` commands |

## Stage 1 — SIGNED OFF (2026-05-17)

| #   | Step                                                                           | Status  |
| :-- | :----------------------------------------------------------------------------- | :------ |
| 1   | Drizzle DB schema + RLS + Supabase migrations                                  | ✅ done |
| 2   | Auth (OTP code primary; magic link secondary; PKCE deep link)                  | ✅ done |
| 3   | Data source adapters (Alpha Vantage US + Frankfurter FX + cache + tests)       | ✅ done |
| 4   | 5 real pages (Portfolio Tab, detail, add-tx modal, Settings, Me + tabs layout) | ✅ done |
| 5   | Business token system + ESLint guard                                           | ✅ done |

### S1-AC sign-off table

| AC      | Journey                                 | Result                                   | Verified by                                                                      |
| :------ | :-------------------------------------- | :--------------------------------------- | :------------------------------------------------------------------------------- |
| S1-AC-1 | J1 — First-time login                   | ✅ user verified                         | Manual (2026-05-17)                                                              |
| S1-AC-2 | J2 — Add transaction → CNY market value | ✅ user verified                         | Manual (2026-05-17)                                                              |
| S1-AC-3 | J3 — Switch reporting currency          | ✅ user verified                         | Manual (2026-05-17)                                                              |
| S1-AC-4 | J4 — Switch language zh ↔ en            | ✅ user verified                         | Manual (2026-05-17)                                                              |
| S1-AC-5 | J5 — Red-up/green-down toggle           | ⏸ deferred to Stage 2                    | User decision — needs charts / Daily Snapshot for meaningful visual verification |
| S1-AC-6 | Build & deploy                          | ✅ web bundle clean; TestFlight optional | Local `expo export` + gates                                                      |

### Stage 1 outcome summary

- 3 Tab skeleton + Me full-screen page + transaction form sheet + auth gating
- Real Alpha Vantage + Frankfurter data flow end-to-end (Decimal everywhere)
- @arc/ui interface layer with 8 sub-layers (ADR 006) — business code zero direct 3rd-party imports
- Dev experience: FixtureAdapter behind Settings toggle (ADR 008) — 90% of dev runs zero-network
- Tests: 92 total (core 31 + data-sources 47 + ui 14)
- Lint: enforced across all 6 workspaces (one ESLint config, one CI check)

### ADRs landed in Stage 1

| ADR      | Topic                                                               |
| :------- | :------------------------------------------------------------------ |
| 001      | Tech Stack (Expo + Supabase + Drizzle + decimal.js)                 |
| 002      | UI library decision (HeroUI Native + Pro + Uniwind + Tailwind v4)   |
| 003 v3.1 | Design Tokens 架构（Foundation 直消费 + Business 平行）             |
| 004      | Avatar generation (dicebear gradient)                               |
| 005      | Tailwind v4 OKLCH 色阶系统                                          |
| 006      | `@arc/ui` 分层 + 非 HeroUI 组件归位规范（Header Atoms / Sheet 等）  |
| 007      | Dev Auth 持久化 + 种子数据 SQL 注入策略（real-flow integrity 铁律） |
| 008      | Dev 行情数据策略：FixtureAdapter + Settings 双档开关                |

## Active blockers / waiting on user

- **None.** Stage 1 signed off. Ready to merge → main → open dev/stage-2.

## Immediate next actions (next session, 按顺序)

1. **Merge `dev/stage-1` → `main`** (merge commit, preserve history). PR #5 closes.
2. **Create `dev/stage-2` from updated main**; push origin.
3. **Stage 2 planning**: prioritize the 4 big modules listed in dev plan §七:
   - Daily Snapshot card (Portfolio Tab top)
   - CSV import (FAB Sheet)
   - Markets Tab Watchlist (lightweight)
   - Insights Tab Rebalance basics (target allocation + 行动单)
4. Discuss S1-AC-5 verification path — likely lands naturally with Daily Snapshot

## Open decisions / questions for user (Stage 2 onset)

- Stage 2 priority order across the 4 modules (BoyangJiao to decide; Daily Snapshot is the natural first since it gives users a reason to open the app daily — per development-plan.md §七 Stage 2 goal)
- Whether to add the suggested follow-up smoke-test workflow (live-vs-fixture contract assertion) — defer until first regression appears

## Critical mental model (gotchas easy to forget)

- **Decimal.js everywhere**: any financial number is Decimal, never `number`. ESLint catches; tests catch (`packages/core/__tests__/decimal.spec.ts`).
- **Asset ID immutable**: `market:symbol` (e.g., `US:AAPL`); written via `composeAssetId()` from `@arc/core`. Never reassign.
- **Business tokens for gain/loss**: business code does NOT use `text-success` / `text-danger` directly for PnL. Use `useBusinessClasses()` from `@arc/ui`.
- **HeroUI Foundation only**: no Tailwind built-in colors (`bg-red-500` etc.) in business code. ESLint enforces.
- **i18n required**: no hardcoded user-facing strings. Use `t()` from `@arc/i18n`. Add to both `zh.ts` and `en.ts` simultaneously.
- **Market data toggle**: dev default is **fixture mode** (zero network). Toggle in Me → Settings to switch real ↔ fixture. Production builds force live regardless. See ADR 008.
- **Real-flow integrity (铁律 3.5)**: no `if (DEV) return mock` short-circuits in hooks. Implementation-layer swap (FixtureAdapter) is OK, hook-layer mock is not.
- **Supabase RLS**: migrations 0001 (assets INSERT) + 0002 (price_snapshots / fx_rates RLS) both applied. Stage 4 will move cache writes to Edge Function.
- **Pro components via subpath**: `import { EmptyState } from "heroui-native-pro/empty-state"` — top-level `import { X } from "heroui-native-pro"` pulls chart-indicator → requires @shopify/react-native-skia → bundle fails.
- **heroui-native-pro postinstall**: needs `HEROUI_AUTH_TOKEN` (CI) or macOS keychain login (`npx heroui-pro login`, dev). CI reads token from GitHub Secret `HEROUI_AUTH_TOKEN`.
- **OTP length 8**: this Supabase project (jdvlzkictwinkgcvgwew) is configured for 8-digit; code accepts 6-10.
- **SafeAreaView is NOT Uniwind-aware**: 用 `<Screen>` from `@arc/ui`, not raw SafeAreaView. ESLint enforces in apps/.
- **expo-blur 不兼容 SDK 54**: 已移除；FloatingTabBar 用 HeroUI Surface 半透明胶囊。
- **.env.dev.local at repo root** (NOT under apps/mobile/): Metro parses .env-named files under apps/ as JS source; repo-root location sidesteps that.
- **.claude/settings.local.json is gitignored**: per-dev permissions can contain shell command literals (incl. secrets); never tracked.

## Active env / config snapshot

| File                         | Status                                                                                 |
| :--------------------------- | :------------------------------------------------------------------------------------- |
| `apps/mobile/.env`           | Supabase + AV key; `MARKET_DATA_POLICY` removed (replaced by Settings toggle, ADR 008) |
| `.env.dev.local` (repo root) | service_role for `pnpm seed:dev`; user maintains locally                               |
| Migrations applied           | `0001` assets INSERT; `0002` price_snapshots / fx_rates RLS                            |
| Supabase project             | `jdvlzkictwinkgcvgwew` (Tokyo, Postgres 17.6.1, ACTIVE_HEALTHY)                        |
| Supabase Auth redirect URLs  | Configured: `arc://auth/callback`, `arc://**`, `exp://**/--/auth/callback`, etc.       |
| Supabase SMTP                | Resend configured (custom SMTP enabled)                                                |
| GitHub branch                | `dev/stage-1` ready to merge to `main`                                                 |
| GitHub Actions               | Pre-push Quality Gate + Supabase weekly heartbeat (lands on `main` post-merge)         |
| Husky                        | pre-commit (secret scan + prettier on staged) + post-checkout/merge (sync skills)      |
| Stop hook                    | `.claude/hooks/quality-gate.sh` runs typecheck + tests on AI signal completion         |

## Recent ADRs (most relevant first)

| ADR      | Topic                                                |
| :------- | :--------------------------------------------------- |
| 008      | Dev 行情数据策略：FixtureAdapter + Settings 双档开关 |
| 007      | Dev Auth 持久化 + 种子数据 SQL 注入策略              |
| 006      | `@arc/ui` 分层架构 + 非 HeroUI 组件归位              |
| 005      | Tailwind v4 OKLCH 色阶系统                           |
| 003 v3.1 | Design Tokens 架构                                   |
| 004      | Avatar generation (dicebear)                         |
| 002      | UI library decision                                  |
| 001      | Tech stack                                           |

## How to use this file

**Starting a new session?**

1. Read CLAUDE.md (project rules)
2. Read this file (current state)
3. Read most recent feature-spec relevant to next action
4. Begin work — you're caught up

**Ending a session (or context near full)?**

- Invoke `/checkpoint` skill → updates this file with latest state
- Commit the update
- Safe to close session

**Major step boundary?**

- After completing a Stage step or major refactor, manually update §"You are here", §"Recent decisions", §"Stage progress" before commit
