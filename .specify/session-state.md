# Arc — Session State (Live)

> **READ THIS FIRST in every new AI session** (Cursor, Claude Code, Qoder, etc.).
>
> Update mechanism: `/checkpoint` (Cursor command or Claude skill).
>
> **Never write here:** API keys, JWTs, `DATABASE_URL`, `.env` contents, or other secrets.
>
> **Last updated**: 2026-05-19 by Cursor Composer — PR #7 merged；cron ✅；dev 默认 Finnhub（移除 fixture 开关）

---

## You are here

| Field                 | Value                                                                                          |
| :-------------------- | :--------------------------------------------------------------------------------------------- |
| **Active stage**      | **Stage 3 entry** — Finnhub + dev 全真实行情                                                   |
| **Step**              | PR #7 merged ✅；cron ✅；PR pending: 移除 fixture 开关 + seed 走 Finnhub                      |
| **Branch**            | `chore/dev-real-market-data-only`                                                              |
| **Last commit**       | 以 `git log -1 --oneline` 为准                                                                 |
| **PR**                | #7 merged (Finnhub)；open PR for real-market-data-only                                         |
| **CI status**         | GitHub API unavailable this checkpoint; local `pnpm --filter @arc/mobile exec tsc --noEmit` ✅ |
| **Mobile dev server** | Default **8081** (`pnpm mobile`); Expo Go **SDK 55**                                           |

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

| Item                                                                       | Status                                                 |
| :------------------------------------------------------------------------- | :----------------------------------------------------- |
| Feature spec (`watchlist-stage-2.md`) Accepted                             | ✅ `70bd38e`                                           |
| Commit plan **#1–#8** (schema → core → adapter → UI → hooks → seed → docs) | ✅ `0b2c1fd` … `082ab0e`                               |
| Migration **0004** applied on dev Supabase                                 | ✅ **user confirmed** (SQL Editor)                     |
| **UAT S2-AC-2.1–2.3, 2.6, 2.7**                                            | ✅ user verified 2026-05-18                            |
| **UAT** quote error banner + **DEV「模拟自选限流」**                       | ✅ sim + real `RateLimitError` path                    |
| **UAT S2-AC-2.4 / 2.5 / 2.8**                                              | ⏳ optional before merge (AV + logs / tests)           |
| **Migration `0005`** (`change_percent` on `price_snapshots`)               | ✅ **user confirmed applied** (SQL Editor, 2026-05-18) |
| **J8 polish + cache correctness**                                          | ✅ 与本 session UI polish 一并入库（见最新 commit）    |

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

| Item                                                           | Status                                                                                                                           |
| :------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------- |
| Feature spec (`welcome-stage-2.md`) Accepted 2026-05-19        | ✅                                                                                                                               |
| Commit **#1** `/welcome` route + i18n                          | ✅ `4ae3da6`                                                                                                                     |
| Commit **#2** `useMarkWelcomeSeen` + `_layout` gate            | ✅ `416148d`                                                                                                                     |
| Commit **#3** `welcome:fresh` / `welcome:seen` DEV client seed | ✅ `56de855`                                                                                                                     |
| Commit **#4** `user-journeys.md` J6 + session-state            | ✅ this checkpoint                                                                                                               |
| **UAT S2-AC-4.1–4.6**                                          | ✅ user verified 2026-05-19 (4.1–4.3 CTA/skip; 4.4 via restart; 4.5 lint:copy + disclaimer; 4.6 Mac 断网替代 Simulator 飞行模式) |

**Stage 2 DoD (four features)**：Daily Snapshot ✅ · Watchlist ✅ · Rebalance ✅ · Welcome ✅ — **可开 Stage 2 → `main` PR**。

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

- **`EXPO_PUBLIC_FINNHUB_API_KEY`** — 用户已配置于 `apps/mobile/.env` ✅。
- **Daily Snapshot cron** ✅（`verify_jwt=false` + secrets 对齐；GH `26095476933`）。
- **Dev 行情** — Settings「拉取真实行情」开关已移除；dev/prod 均 Finnhub + Frankfurter（dev = cache-first）。
- **`brew install deno`** — optional, before `pnpm test:functions` locally (J8 dev-seed handler tests).

## Immediate next actions (next session)

**1. ~~Fix Daily Snapshot cron~~** ✅ cron 冒烟通过（见上）；`supabase/config.toml` 需 merge 到 `main` 以免他人 redeploy 丢 `verify_jwt`。

**2. Merge `feat/finnhub-adapter`** — UAT：自选 NVDA/AAPL 价格 + 涨跌幅；Markets 下拉见 `finnhub.io` 请求。

**3. Stage 3 P0** — Tushare CN/HK、CoinGecko、基金净值；Performance Attribution / TWR。

**4. Switch-back-to-Opus triggers** (Stage 3):

- TWR / MWR 算法（property tests 强需求）
- Performance Attribution 算法
- 任何动到 @arc/core 的迁移或不变性条款

## Open decisions / questions

- **Resolved 2026-05-18**: Watchlist DEV seed in App uses **client JWT path** for `watchlist:*` only; portfolio reset scenarios still need Edge Function.
- **Resolved 2026-05-18**: Dev tools UI = **two-level** (feature picker → scenarios), not flat list.
- **Resolved 2026-05-18 (J9 UAT)**: Rebalance DEV 场景漂移应靠 **不同 `target_allocations`**（在 fixture 固定价下算出 ±7% / ±15%），不能只改 DB NVDA 价；seed 后须 **`warmRebalanceMarketCache()`**（fixture 模式不读 Supabase `price_snapshots`）。
- **Resolved 2026-05-19 (UI polish)**: `/me` 拆 **嵌套 Stack**（`app/me/_layout.tsx`）— 根仅 `slide_from_left` + `animationMatchesGesture` + `fullScreenGestureEnabled`；子页自右 push。`InScreenHeader` 增加 `density: comfortable` 用于 modal（如自选搜索）。Tab 滚动底缘 `TabScrollShadow`（`ScrollShadow` + `LinearGradient`）。`@arc/eslint-plugin-token-discipline` + ADR 008 / DESIGN-TOKENS 同步。

## Critical mental model (gotchas easy to forget)

- **Decimal.js everywhere** — see `packages/core/__tests__/`.
- **`assets` upsert**: RLS allows INSERT only → use `{ onConflict: "id", ignoreDuplicates: true }` or UPDATE fails on seeded symbols (AAPL/NVDA).
- **Watchlist dev seed**: purple DEV **自选** scenarios = `run-watchlist-seed-client.ts` (user JWT); does **not** reset portfolio. Daily Snapshot scenarios = Edge `dev-seed`.
- **Dev seed**: `service_role` only in CLI / Edge — never in app bundle.
- **iOS Simulator refresh**: **⌘D → Reload** (⌘R = screenshot).
- **Migration 0004** required for watchlist table + DEV watchlist seed.
- **Migration 0005** optional until client deploys `change_percent` read/write; apply before shipping watchlist quote cache to shared dev DB.
- **`/me` 导航**：根栈 `name="me"` + `animation: slide_from_left` + `animationMatchesGesture: true` + `fullScreenGestureEnabled: true` → LTR 下**右缘向左滑**关闭整个 Me；`app/me/_layout.tsx` 子栈内子页（设置等）默认 **自右 push**，左缘右滑返回上一层。
- **`use-watchlist-quotes`**: `catch` + `return null` = TanStack **success** → no `isError` → **no pull banner**. **`AdapterError` 子类必须 rethrow**（限流/网络/404 等）才能统计失败 + 显示横幅。
- **Markets 下拉**: `forceRefresh` 在 **`isFetching` 结束** 后关闭，勿用短 `setTimeout`，否则 `queryKey` 切回会只吃缓存并丢涨跌展示路径。
- **Rebalance DEV seed**: `rebalance:aligned|mild-drift|heavy-drift` 共用同一组 holdings；fixture 当前配置 ≈ **11.85 / 13.14 / 43.76 / 31.25**（见 `rebalance-seed-plans.ts`）。切换场景后 invalidate queries + 预热 `priceCache`/`fxCache`。
- **`DeviationBar` (RN)**: 勿用 `h-2` + `h-full` 撑条高 — 用固定 `8px`；条宽按 `|deviationPercent|` 而非 `currentPercent`。
- All prior Stage 1 gotchas still apply (FixtureAdapter, @arc/ui imports, OTP 8-digit, etc.).
- **Expo SDK 55** (2026-05-19): `expo@~55`, RN **0.83.6**, React **19.2**; `app.json` 已移除 `newArchEnabled` / `edgeToEdgeEnabled`（SDK 55 默认）；monorepo 启用 `experiments.autolinkingModuleResolution`；根 `pnpm.overrides` 钉住 `react@19.2.0`。勿扫 **8082** 等非 Arc Metro 二维码（会报 SDK 54 不兼容）。

## Active env / config snapshot

| File               | Status                                               |
| :----------------- | :--------------------------------------------------- |
| `apps/mobile/.env` | Supabase + **需加** `EXPO_PUBLIC_FINNHUB_API_KEY`    |
| `.env.dev.local`   | `SUPABASE_DEV_*`, `DEV_SEED_EMAIL`                   |
| Migrations         | `0001`–`0009` applied ✅ (user confirmed 2026-05-19) |
| Supabase project   | `jdvlzkictwinkgcvgwew`                               |
| Git branch         | `feat/finnhub-adapter`                               |

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
