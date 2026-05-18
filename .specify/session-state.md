# Arc — Session State (Live)

> **READ THIS FIRST in every new AI session** (Cursor, Claude Code, Qoder, etc.).
>
> Update mechanism: `/checkpoint` (Cursor command or Claude skill).
>
> **Never write here:** API keys, JWTs, `DATABASE_URL`, `.env` contents, or other secrets.
>
> **Last updated**: 2026-05-19 by Cursor Auto (J6 Welcome #1–#4 landed; Stage 2 four-feature DoD ready for → main PR)

---

## You are here

| Field                 | Value                                                                                          |
| :-------------------- | :--------------------------------------------------------------------------------------------- |
| **Active stage**      | **Stage 2 — wrap-up → `main` PR**                                                              |
| **Step**              | J7–J9 ✅; **J6 Welcome** commit plan **#1–#4** ✅; **UAT J6 AC-4.1–4.6** ⏳ user sign-off      |
| **Branch**            | `dev/stage-2` — HEAD `56de855` (+ any prior uncommitted J9 UAT fixes in tree)                  |
| **Last commit**       | `56de855` — feat(seed): welcome dev scenarios + dev panel feature group                        |
| **PR**                | Stage 2 on `dev/stage-2`; Stage 1 PR #5 merged                                                 |
| **CI status**         | GitHub API unavailable this checkpoint; local `pnpm --filter @arc/mobile exec tsc --noEmit` ✅ |
| **Mobile dev server** | User Metro; UI changes → **⌘D → Reload**                                                       |

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

| Item                                                                                                                       | Status                                                                   |
| :------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------- |
| Feature spec (`rebalance-stage-2.md`) Accepted — 4 structural + 6 tactical decisions locked                                | ✅ `b5e662e`                                                             |
| **Commit plan #1** migration 0006/0007/0008 + `target_allocations` Drizzle schema + CASH market                            | ✅ `e1caaf7` + `10d656d` (split for PG `ALTER TYPE` gotcha)              |
| Migration 0006 / 0007 / 0008 applied on dev Supabase                                                                       | ✅ **user confirmed**                                                    |
| **Commit plan #4** CASH price adapter (`createCashPriceAdapter`) + registry + tests                                        | ✅ `85301fe`                                                             |
| **Commit plan #2** `rebalance/rounding.ts` (per-market step-size + truncate toward zero)                                   | ✅ `3752491`                                                             |
| **Commit plan #3** `rebalance/index.ts` fill in + property tests (26 tests, all green)                                     | ✅ `3752491`                                                             |
| **Commit plan #5** `TargetAllocationForm` + `DeviationDonut` + `DeviationBar` + `RebalanceActionList` in `@arc/ui/finance` | ✅ `23b2eb7`                                                             |
| **Commit plan #6** `use-target-allocations` + `use-rebalance` hooks + Insights Tab integration                             | ✅ `8c0936f`                                                             |
| **Commit plan #7** `/insights/rebalance/setup` modal + `/insights/rebalance/actions` screen                                | ✅ `5cf545a`                                                             |
| **Commit plan #8** `/me/cash-balances` form (writes BUY/SELL on CASH:\* assets)                                            | ✅ `fa9caab`                                                             |
| **Commit plan #9** 4 seed scenarios + Dev panel feature group registration                                                 | ✅ `57b4380`                                                             |
| **Commit plan #10** `pnpm lint:copy` script + `user-journeys.md` J9 sync                                                   | ✅ `dbe4807`                                                             |
| **UAT bugfix** DeviationBar RN 高度撑满屏（`h-2` 失效 → 固定 8px + 按 \|deviation\| 画条）                                 | ✅ 代码已改，**未 commit**                                               |
| **UAT bugfix** rebalance DEV 三场景 targets 相同 + fixture 忽略 DB 报价 → 场景无差异                                       | ✅ `rebalance-seed-plans.ts` + `warmRebalanceMarketCache`，**未 commit** |
| **Migration 0009** `assets` RLS 允许 authenticated INSERT `CASH`（DEV seed 写 CASH 资产）                                  | ⏳ SQL 文件已写，**用户需在 Supabase 执行**                              |

## Stage 2 — J6 Welcome progress (2026-05-19)

| Item                                                           | Status                                                                          |
| :------------------------------------------------------------- | :------------------------------------------------------------------------------ |
| Feature spec (`welcome-stage-2.md`) Accepted 2026-05-19        | ✅                                                                              |
| Commit **#1** `/welcome` route + i18n                          | ✅ `4ae3da6`                                                                    |
| Commit **#2** `useMarkWelcomeSeen` + `_layout` gate            | ✅ `416148d`                                                                    |
| Commit **#3** `welcome:fresh` / `welcome:seen` DEV client seed | ✅ `56de855`                                                                    |
| Commit **#4** `user-journeys.md` J6 + session-state            | ✅ this checkpoint                                                              |
| **UAT S2-AC-4.1–4.6**                                          | ⏳ user (DEV Welcome → fresh/seen, CTA/skip, `/welcome` defense, airplane mode) |

**Stage 2 DoD (four features)**：Daily Snapshot ✅ · Watchlist ✅ · Rebalance ✅ · Welcome ✅ — **ready to open Stage 2 → `main` PR** after J6 UAT.

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

- **Migration 0009** — run `packages/db/drizzle/migrations/0009_assets_authenticated_insert_cash.sql` on dev Supabase before rebalance DEV seed (否则 CASH 资产 INSERT 可能 RLS 失败；客户端 seed 已改为只 upsert 美股，但 0009 仍建议执行）。
- **Rebalance UAT** — 切换 DEV 场景后 Insights **下拉刷新**；验证 aligned（全灰 <5%）/ mild（AAPL+MSFT 黄）/ heavy（NVDA+MSFT 红）。
- **`brew install deno`** — before `pnpm test:functions` locally (J8 dev-seed handler tests).
- **Daily-snapshot cron go-live** — deferred to Stage 2 → main merge (2026-05-18).

## Immediate next actions (next session)

**1. Commit UAT bugfix bundle** (when user asks):

- `packages/ui/src/finance/DeviationBar.tsx`
- `apps/mobile/src/lib/dev-tools/rebalance-seed-plans.ts` + `run-rebalance-seed-client.ts`
- `supabase/functions/_shared/seed-core.ts` + `packages/i18n` rb\* hints
- `packages/db/drizzle/migrations/0009_assets_authenticated_insert_cash.sql`

**2. User** — apply migration **0009** on dev Supabase; DEV → 再平衡 → 依次 seed aligned / mild / heavy → Insights 下拉刷新 → sign off S2-AC-3.x.

**3. Stage 2 → `main` PR** — after J6 UAT AC-4.x ✅ (Welcome DEV → fresh → Reload → CTA/skip → 重启不进 Welcome).

**4. Switch-back-to-Opus triggers** (if still needed):

- DeviationDonut Web 渲染失败需拆 Recharts/Victory（spec §4 风险）
- sum-to-100 表单校验反复失败

## Open decisions / questions

- **Resolved 2026-05-18**: Watchlist DEV seed in App uses **client JWT path** for `watchlist:*` only; portfolio reset scenarios still need Edge Function.
- **Resolved 2026-05-18**: Dev tools UI = **two-level** (feature picker → scenarios), not flat list.
- **Resolved 2026-05-18 (J9 UAT)**: Rebalance DEV 场景漂移应靠 **不同 `target_allocations`**（在 fixture 固定价下算出 ±7% / ±15%），不能只改 DB NVDA 价；seed 后须 **`warmRebalanceMarketCache()`**（fixture 模式不读 Supabase `price_snapshots`）。
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
- **Rebalance DEV seed**: `rebalance:aligned|mild-drift|heavy-drift` 共用同一组 holdings；fixture 当前配置 ≈ **11.85 / 13.14 / 43.76 / 31.25**（见 `rebalance-seed-plans.ts`）。切换场景后 invalidate queries + 预热 `priceCache`/`fxCache`。
- **`DeviationBar` (RN)**: 勿用 `h-2` + `h-full` 撑条高 — 用固定 `8px`；条宽按 `|deviationPercent|` 而非 `currentPercent`。
- All prior Stage 1 gotchas still apply (FixtureAdapter, @arc/ui imports, OTP 8-digit, etc.).

## Active env / config snapshot

| File               | Status                                                             |
| :----------------- | :----------------------------------------------------------------- |
| `apps/mobile/.env` | Supabase + AV key                                                  |
| `.env.dev.local`   | `SUPABASE_DEV_*`, `DEV_SEED_EMAIL`                                 |
| Migrations         | `0001`–`0008` applied; **`0009` pending** (CASH assets INSERT RLS) |
| Supabase project   | `jdvlzkictwinkgcvgwew`                                             |
| Git branch         | `dev/stage-2`                                                      |

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
