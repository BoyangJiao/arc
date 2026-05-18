# Arc — Session State (Live)

> **READ THIS FIRST in every new AI session** (Cursor, Claude Code, Qoder, etc.).
>
> Update mechanism: `/checkpoint` (Cursor command or Claude skill).
>
> **Never write here:** API keys, JWTs, `DATABASE_URL`, `.env` contents, or other secrets.
>
> **Last updated**: 2026-05-18 by Cursor (checkpoint — J8 watchlist quote cache + UAT sim; large diff still uncommitted on `dev/stage-2`)

---

## You are here

| Field                 | Value                                                                                                                          |
| :-------------------- | :----------------------------------------------------------------------------------------------------------------------------- |
| **Active stage**      | **Stage 2 — J8 Watchlist UAT**                                                                                                 |
| **Step**              | J7 ✅; J8 **#1–#8 + J8 docs** committed; **watchlist hardening + UAT tooling** on branch (uncommitted — see §Uncommitted work) |
| **Branch**            | `dev/stage-2` — HEAD `8033535` (prior state-only checkpoint); **working tree dirty** (~20 paths)                               |
| **Last commit**       | `8033535` — chore(state): checkpoint — J8 UAT in progress + dev tools two-level menu                                           |
| **PR**                | Stage 2 on `dev/stage-2`; Stage 1 PR #5 merged                                                                                 |
| **CI status**         | Local `pnpm typecheck` 6/6 ✅ (this checkpoint)                                                                                |
| **Mobile dev server** | User Metro; UI changes → **⌘D → Reload**                                                                                       |

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

| Item                                                                       | Status                                       |
| :------------------------------------------------------------------------- | :------------------------------------------- |
| Feature spec (`watchlist-stage-2.md`) Accepted                             | ✅ `70bd38e`                                 |
| Commit plan **#1–#8** (schema → core → adapter → UI → hooks → seed → docs) | ✅ `0b2c1fd` … `082ab0e`                     |
| Migration **0004** applied on dev Supabase                                 | ✅ **user confirmed** (SQL Editor)           |
| **UAT S2-AC-2.1–2.3, 2.6, 2.7**                                            | ✅ user verified 2026-05-18                  |
| **UAT** quote error banner + **DEV「模拟自选限流」**                       | ✅ sim + real `RateLimitError` path          |
| **UAT S2-AC-2.4 / 2.5 / 2.8**                                              | ⏳ optional before merge (AV + logs / tests) |
| **Migration `0005`** (`change_percent` on `price_snapshots`)               | ⏳ apply on dev Supabase when ready          |
| **J8 polish + cache correctness** (**uncommitted**, `pnpm typecheck` ✅)   | see §Uncommitted work                        |

### Uncommitted work (checkpoint snapshot — squash / slice into PR commits)

| Area             | Paths (summary)                                                                                                                                                             | What                                                                                                                         |
| :--------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------- |
| **DB + cache**   | `0005_price_snapshots_change_percent.sql`, `packages/db/schema/price-snapshots.ts`, `price-cache.ts`, `persistent-market-cache.ts`, `types.ts` (`PriceQuote.changePercent`) | Round-trip 涨跌幅与 `price_snapshots` 列                                                                                     |
| **Quotes + UI**  | `use-watchlist-quotes.ts`, `use-watchlist.ts`, `watchlist-quote.ts`, `markets.tsx`                                                                                          | 缓存命中保留 `changePercent`；`AdapterError` **rethrow** 以便 TanStack `isError` + 下拉结束横幅；下拉结束再关 `forceRefresh` |
| **AV + fixture** | `alphavantage.ts`, `fixture-adapter.ts`, `alphavantage.spec.ts`                                                                                                             | `parseGlobalQuote` 把涨跌写入 `PriceQuote`                                                                                   |
| **Dev / seed**   | `watchlist-rate-limit-sim.ts`, `DevToolsScenarioPanel.tsx`, `run-watchlist-seed-client.ts`, `seed-core.ts`, `scenarios.ts`, `invoke-dev-seed.ts`                            | DEV 限流模拟开关；自选种子写 `change_percent`                                                                                |
| **i18n**         | `en.ts`, `zh.ts`                                                                                                                                                            | 横幅 + DEV 模拟文案                                                                                                          |
| **Other J8**     | `markets/search.tsx` 等                                                                                                                                                     | 仍含早期 add/search UX 改动（与上表一并提交前过 `git diff`）                                                                 |

Suggested commit slices (next session — 可调顺序):

1. `feat(db): migration 0005 price_snapshots change_percent + drizzle schema`
2. `feat(data-sources+mobile): quote cache carries changePercent; watchlist pull banner + refresh lifecycle`
3. `feat(mobile): dev watchlist rate-limit sim + seed change_percent + i18n`

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

- **Commit large J8 working tree** — quote/cache/migration + markets + dev sim + seeds + i18n (see §Uncommitted work); prefer 2–3 logical commits over one mega-diff.
- **Apply `0005`** on dev Supabase if not yet — client `select` includes `change_percent`; missing column → read errors.
- **`brew install deno`** — before `pnpm test:functions` locally.
- **Daily-snapshot cron go-live** — deferred to Stage 2 → main merge (2026-05-18).

## Immediate next actions (next session)

**1. `git add -p` / slice commits** — land §Uncommitted work (migration 0005 first if others depend on DB).

**2. Optional UAT before merge** — `.specify/feature-specs/watchlist-stage-2.md`: **S2-AC-2.4**（Tab 聚焦不重复打 AV / 超 5min 再拉）、**2.5**（下拉强制刷新）、**2.8**（搜索静态未命中 + AV 429；或依赖 `pnpm test` on data-sources）。UI polish 刻意后置。

**3. After J8 signed off** — `pnpm test` / `pnpm lint` green; consider J9 Rebalance or Stage 2 → `main` PR.

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

| File               | Status                                                                                               |
| :----------------- | :--------------------------------------------------------------------------------------------------- |
| `apps/mobile/.env` | Supabase + AV key                                                                                    |
| `.env.dev.local`   | `SUPABASE_DEV_*`, `DEV_SEED_EMAIL`                                                                   |
| Migrations         | `0001`–`0004` on dev (**0004 user-applied**); **`0005` apply when adopting `change_percent` column** |
| Supabase project   | `jdvlzkictwinkgcvgwew`                                                                               |
| Git branch         | `dev/stage-2`                                                                                        |

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
