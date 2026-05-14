# Arc — Session State (Live)

> **READ THIS FIRST in every new Claude Code session.**
>
> This file is the single living snapshot of "where we are right now". It's
> intentionally short and high-frequency-update. Stable rules go in
> `constitution.md`; permanent decisions in `docs/adr/`; per-feature contracts
> in `feature-specs/`. This file answers: **"if I dropped in cold, what would
> I need to know to keep working?"**
>
> Update mechanism: invoke the `/checkpoint` skill (see `.claude/skills/checkpoint/`)
> at end of major work blocks, OR before context window fills.
>
> **Last updated**: 2026-05-14 by Claude Sonnet 4.6

---

## You are here

| Field                 | Value                                                                                                                                                                        |
| :-------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Active stage**      | Stage 1 (MVP-0 端到端骨架)                                                                                                                                                   |
| **Step**              | 3 of 5 done; **step 4 next** (5 真实页面)                                                                                                                                    |
| **Branch**            | `dev/stage-1`                                                                                                                                                                |
| **Last commit**       | `dc426f1` — feat(data-sources) Stage 1 step 3                                                                                                                                |
| **CI status**         | ⚠️ All recent runs failing on `pnpm install --frozen-lockfile` (heroui-native-pro postinstall needs `HEROUI_AUTH_TOKEN`); fix in progress this session — see Action #1 below |
| **Mobile dev server** | Metro task `by8u91639` running (8081); Expo Go can connect                                                                                                                   |

## Stage 1 step progress

| #   | Step                                                                           | Status      | Commits               |
| :-- | :----------------------------------------------------------------------------- | :---------- | :-------------------- |
| 1   | Drizzle DB schema + RLS + Supabase migrations                                  | ✅ done     | `00bbd2b`             |
| 2   | Auth (OTP code primary; magic link secondary; PKCE deep link)                  | ✅ done     | `ade7787` → `3da0fb8` |
| 3   | Data source adapters (Alpha Vantage US + Frankfurter FX + cache + 31 tests)    | ✅ done     | `dc426f1`             |
| 4   | 5 real pages (Portfolio Tab, detail, add-tx modal, Settings, Me + tabs layout) | ⏳ **next** | —                     |
| 5   | Business token system + ESLint guard                                           | ✅ done     | `5d398af`             |

Stage 1 complete = 4 done. Currently 4/5 done, just step 4 left.

## Recent decisions (last 7 days)

- **OTP code primary, magic link secondary** — Mac browser can't bridge `exp://` deep links to iOS sim's Expo Go; OTP works everywhere. Magic link upgrades to primary at Stage 4 standalone build (ADR'd in `feature-specs/auth-magic-link.md`).
- **8-digit OTP, not 6** — Supabase project `jdvlzkictwinkgcvgwew` is configured for 8 (cloud default varies). Code accepts 6-10, server validates exact length.
- **Frankfurter (not exchangerate.host) for FX** — exchangerate.host now requires API key; Frankfurter is fully free + no key + ECB rates. Decision in `feature-specs/data-sources-stage-1.md` §2.
- **Stage 4 will move cache writes to Edge Function** — current Stage 1 client writes to `price_snapshots` / `fx_rates` fail RLS (public-read + service-role-write); we swallow + log warning. Acceptable for Stage 1 since TanStack Query in-memory cache covers single-session.
- **Screen primitive in `@arc/ui`** — every screen uses `<Screen>` for safe-area + scroll; backlog item: replace raw RN TextInput with HeroUI's TextField/OtpInput in step 4.

## Active blockers / waiting on user

- **None right now**, just user verification of Arc loading after Metro restart.

## Immediate next actions (this session)

1. ✅ Fix CI workflow: add `--ignore-scripts` to install, run `pnpm test` for all workspaces (this session, in progress)
2. ✅ Restore heroui-native-pro postinstall artifacts (this session, done — keychain creds were already there)
3. ⏳ User verifies Arc loads in Expo Go with Live Data Preview Card (AAPL price + USD/CNY rate)
4. ⏳ Push CI fix → confirm GitHub Actions green
5. ⏳ Then: start Stage 1 step 4

## Open decisions / questions for user

- None right now (all step 4 design questions to be raised when step 4 starts)

## Critical mental model (gotchas easy to forget)

- **Decimal.js everywhere**: any financial number is Decimal, never `number`. ESLint catches; tests catch (`packages/core/__tests__/decimal.spec.ts`).
- **Asset ID immutable**: `market:symbol` (e.g., `US:AAPL`); written via `composeAssetId()` from `@arc/core`. Never reassign.
- **Business tokens for gain/loss**: business code does NOT use `text-success` / `text-danger` directly for PnL. Use `useBusinessClasses()` from `@arc/ui`. ESLint will eventually enforce; for now CR.
- **HeroUI Foundation only**: no Tailwind built-in colors (`bg-red-500` etc.) in business code. ESLint enforces.
- **i18n required**: no hardcoded user-facing strings. Use `t()` from `@arc/i18n`. Add to both `zh.ts` and `en.ts` simultaneously.
- **Supabase RLS**: client writes to `price_snapshots`/`fx_rates` will fail (expected); reads work for everyone. Stage 4 fixes via Edge Function.
- **heroui-native-pro postinstall**: needs `HEROUI_AUTH_TOKEN` (CI) or macOS keychain login (`npx heroui-pro login`, dev). CI reads token from GitHub Secret `HEROUI_AUTH_TOKEN` (CI/CD token from heroui.pro/dashboard, NOT Personal Token).
- **OTP length 8**: this Supabase project (jdvlzkictwinkgcvgwew) is configured for 8-digit; code accepts 6-10.
- **Expo Go quirk**: Mac browser cannot trigger `exp://` deep link to sim. Use OTP code flow for dev. Magic link only works in standalone build (Stage 4).

## Active env / config snapshot

| File                        | Status                                                                           |
| :-------------------------- | :------------------------------------------------------------------------------- |
| `apps/mobile/.env`          | exists locally; Supabase URL/anon-key + Alpha Vantage key set; gitignored        |
| Supabase project            | `jdvlzkictwinkgcvgwew` (Tokyo, Postgres 17.6.1, ACTIVE_HEALTHY)                  |
| Supabase Auth redirect URLs | Configured: `arc://auth/callback`, `arc://**`, `exp://**/--/auth/callback`, etc. |
| Supabase SMTP               | Resend configured (custom SMTP enabled)                                          |
| GitHub branch               | `dev/stage-1` (3 commits ahead of main on first commit, now ~10 ahead)           |
| GitHub Actions              | Pre-push Quality Gate (push + PR triggers)                                       |
| Husky                       | pre-commit (prettier on staged) + post-checkout/merge (sync skills)              |
| Stop hook                   | `.claude/hooks/quality-gate.sh` runs typecheck + tests on AI signal completion   |

## Recent ADRs (most relevant first)

| ADR            | Topic                                                             |
| :------------- | :---------------------------------------------------------------- |
| 005            | Tailwind v4 OKLCH 色阶系统                                        |
| 003 v3.1       | Design Tokens 架构（Foundation 直消费 + Business 平行）           |
| 004            | Avatar generation (dicebear gradient)                             |
| 002 (branch A) | UI library decision (HeroUI Native + Pro + Uniwind + Tailwind v4) |
| 001            | Tech stack (Expo + Supabase + Drizzle + decimal.js)               |

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
