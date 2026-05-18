# Arc — Session State (Live)

> **READ THIS FIRST in every new AI session** (Cursor, Claude Code, Qoder, etc.).
>
> Update mechanism: `/checkpoint` (Cursor command or Claude skill).
>
> **Never write here:** API keys, JWTs, `DATABASE_URL`, `.env` contents, or other secrets.
>
> **Last updated**: 2026-05-18 by Claude Opus 4.7 (J9 commit plan #1–#4 landed by Cursor; **#2–#3 algorithm + property tests committed by Opus**; #5–#10 UI/hooks/seed/docs handing off to Cursor)

---

## You are here

| Field                 | Value                                                                                                                                             |
| :-------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Active stage**      | **Stage 2 — J9 Rebalance (in progress)**                                                                                                          |
| **Step**              | J8 ✅; J9 spec Accepted (`b5e662e`); commit plan **#1, #2, #3, #4** done; **#5–#10 (UI + hooks + cash form + seed + docs) handing off to Cursor** |
| **Branch**            | `dev/stage-2` — HEAD `3752491`; working tree clean                                                                                                |
| **Last commit**       | `3752491` — feat(core): fill in computeRebalance + validateTargetAllocations + rounding (J9)                                                      |
| **PR**                | Stage 2 on `dev/stage-2`; Stage 1 PR #5 merged                                                                                                    |
| **CI status**         | Local `pnpm typecheck` 6/6 ✅ (this checkpoint)                                                                                                   |
| **Mobile dev server** | User Metro; UI changes → **⌘D → Reload**                                                                                                          |

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

| Item                                                                       | Status                                                    |
| :------------------------------------------------------------------------- | :-------------------------------------------------------- |
| Feature spec (`watchlist-stage-2.md`) Accepted                             | ✅ `70bd38e`                                              |
| Commit plan **#1–#8** (schema → core → adapter → UI → hooks → seed → docs) | ✅ `0b2c1fd` … `082ab0e`                                  |
| Migration **0004** applied on dev Supabase                                 | ✅ **user confirmed** (SQL Editor)                        |
| **UAT S2-AC-2.1–2.3, 2.6, 2.7**                                            | ✅ user verified 2026-05-18                               |
| **UAT** quote error banner + **DEV「模拟自选限流」**                       | ✅ sim + real `RateLimitError` path                       |
| **UAT S2-AC-2.4 / 2.5 / 2.8**                                              | ⏳ optional before merge (AV + logs / tests)              |
| **Migration `0005`** (`change_percent` on `price_snapshots`)               | ✅ **user confirmed applied** (SQL Editor, 2026-05-18)    |
| **J8 polish + cache correctness**                                          | ⏳ **commit slices #1–#3** this session (was uncommitted) |

### J8 wrap-up commits (2026-05-18 — three slices)

1. `feat(db): migration 0005 …` — `0005_price_snapshots_change_percent.sql` + Drizzle schema
2. `feat(data-sources+mobile): …` — quote cache `changePercent`, watchlist pull/banner lifecycle, `markets` + `search`
3. `feat(mobile+seed): …` — DEV rate-limit sim, client/Edge seed `change_percent`, dev panel + i18n + `seed-core` prettier fix + this `session-state` bump

_(Prior “uncommitted work” table superseded by the above.)_

## Stage 2 — J9 Rebalance progress (started 2026-05-18)

| Item                                                                                                                       | Status                                                      |
| :------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------- |
| Feature spec (`rebalance-stage-2.md`) Accepted — 4 structural + 6 tactical decisions locked                                | ✅ `b5e662e`                                                |
| **Commit plan #1** migration 0006/0007/0008 + `target_allocations` Drizzle schema + CASH market                            | ✅ `e1caaf7` + `10d656d` (split for PG `ALTER TYPE` gotcha) |
| Migration 0006 / 0007 / 0008 applied on dev Supabase                                                                       | ✅ **user confirmed**                                       |
| **Commit plan #4** CASH price adapter (`createCashPriceAdapter`) + registry + tests                                        | ✅ `85301fe`                                                |
| **Commit plan #2** `rebalance/rounding.ts` (per-market step-size + truncate toward zero)                                   | ✅ `3752491`                                                |
| **Commit plan #3** `rebalance/index.ts` fill in + property tests (26 tests, all green)                                     | ✅ `3752491`                                                |
| **Commit plan #5** `TargetAllocationForm` + `DeviationDonut` + `DeviationBar` + `RebalanceActionList` in `@arc/ui/finance` | ⏳ next batch (Cursor)                                      |
| **Commit plan #6** `use-target-allocations` + `use-rebalance` hooks + Insights Tab integration                             | ⏳ next batch (Cursor)                                      |
| **Commit plan #7** `/insights/rebalance/setup` modal + `/insights/rebalance/actions` screen                                | ⏳ next batch (Cursor)                                      |
| **Commit plan #8** `/me/cash-balances` form (writes BUY/SELL on CASH:\* assets)                                            | ⏳ next batch (Cursor)                                      |
| **Commit plan #9** 4 seed scenarios + Dev panel feature group registration                                                 | ⏳ next batch (Cursor)                                      |
| **Commit plan #10** `pnpm lint:copy` script + `user-journeys.md` J9 sync                                                   | ⏳ next batch (Cursor)                                      |

**Core algorithm contract** (locked):

- `computeRebalance(holdings, valuations, targets) → ReadonlyArray<DeviationItem>` (Stage 2 ignores holdings param; reserved for Stage 3)
- `validateTargetAllocations(targets) → ReadonlyArray<TargetAllocationError>` — structured error codes (`empty` / `duplicate_asset` / `percent_out_of_range` / `sum_not_100`)
- `roundShares(raw, market, currency)` truncates **toward zero** (positive: floor, negative: ceil-toward-zero); decimals per market+currency table

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

- **No active blockers.** Migrations 0001–0008 all applied on dev Supabase; working tree clean; `pnpm typecheck` / `lint` / `test` (73 tests) all green.
- **`brew install deno`** — before `pnpm test:functions` locally (J8 dev-seed handler tests).
- **Daily-snapshot cron go-live** — deferred to Stage 2 → main merge (2026-05-18).

## Immediate next actions (next session)

**1. Cursor — J9 commit plan #5–#10** (UI + hooks + cash form + seed + docs). 见下方 §"J9 hand-off prompt for Cursor"。`@arc/core` 算法层已固定，下游只读 `DeviationItem` / `TargetAllocationError` 契约。

**2. After #5–#10 done** — manual UAT against S2-AC-3.1 / 3.2 / 3.4 / 3.5 / 3.6 / 3.7 / 3.8（3.3 已由 26 property/example tests 覆盖）。

**3. Stage 2 → `main` PR** — Daily Snapshot ✅ + Watchlist ✅ + Rebalance ✅ + Welcome 后即可开 PR；Welcome 仍按 development-plan.md 排期。

**4. Switch-back-to-Opus triggers** for J9 implementation:

- UI 组件库要重新设计抽象（compound components / render props）
- DeviationDonut 在 Web 上渲染失败需要拆 Recharts/Victory（spec §4 风险）
- Sonnet 在 sum-to-100 form validation 上反复改不对
- `pnpm lint:copy` 实现思路有歧义

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
- **Migration 0005** optional until client deploys `change_percent` read/write; apply before shipping watchlist quote cache to shared dev DB.
- **`use-watchlist-quotes`**: `catch` + `return null` = TanStack **success** → no `isError` → **no pull banner**. **`AdapterError` 子类必须 rethrow**（限流/网络/404 等）才能统计失败 + 显示横幅。
- **Markets 下拉**: `forceRefresh` 在 **`isFetching` 结束** 后关闭，勿用短 `setTimeout`，否则 `queryKey` 切回会只吃缓存并丢涨跌展示路径。
- All prior Stage 1 gotchas still apply (FixtureAdapter, @arc/ui imports, OTP 8-digit, etc.).

## Active env / config snapshot

| File               | Status                                                           |
| :----------------- | :--------------------------------------------------------------- |
| `apps/mobile/.env` | Supabase + AV key                                                |
| `.env.dev.local`   | `SUPABASE_DEV_*`, `DEV_SEED_EMAIL`                               |
| Migrations         | `0001`–`0005` on dev (**0004–0005 user-applied** via SQL Editor) |
| Supabase project   | `jdvlzkictwinkgcvgwew`                                           |
| Git branch         | `dev/stage-2`                                                    |

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
