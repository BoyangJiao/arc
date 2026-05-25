# Arc — Session State (Live)

> **READ THIS FIRST in every new AI session** (Cursor, Claude Code, Qoder, etc.).
>
> Update mechanism: `/checkpoint` (Cursor command or Claude skill).
>
> **Never write here:** API keys, JWTs, `DATABASE_URL`, `.env` contents, or other secrets.
>
> **Last updated**: 2026-05-25 by Claude Opus 4.7 — **Block C deferred review + Block D Phase 1 review LGTM 零 P0**；**ADR 012 升「已接受」**（方案 A + 附录 C 6 项 inline + 附录 B Local dev + 状态记录）；**`.specify/polish-backlog.md` 建立** Block E/F/Stage 4 三桶 11 item（Block E/F 起手必读）；**TWR spec §Phase 2 加 `valueAt` day-rounding hint**（12:00 UTC tx vs 23:00 UTC snapshot）；**Block D Phase 2 handoff prompt 就绪** `.specify/handoffs/cursor-stage-3-block-d-phase2-kickoff.md`（2 commits Sonnet，commit #5 day-rounding = Opus review 关键点）。**Next**: 用户起 Phase 2 Cursor 会话 + Phase 3 雪球对标准备 3 标的

---

## You are here

| Field                 | Value                                                                                                                                                                 |
| :-------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Active stage**      | **Stage 3 — Block C UAT ✅ + Block D Phase 1 ✅** (TWR algorithm + 21 property tests landed locally)                                                                  |
| **Step (Block C)**    | **UAT ✅ all S3-AC-C.1–C.12 passed**. Pending: user push → Opus review of #2/#4/#11 (charts / fallback / tx entry)                                                    |
| **Step (Block D)**    | **Phase 1 ✅ algorithm** (`@arc/core/returns/{cash-flow,twr,xirr}.ts` + 21 property tests). **Next** = Phase 2 (mobile hooks + UI 接入 — Sonnet/Cursor route per §七) |
| **Branch**            | `dev/stage-3` (**ahead 34** vs `origin/dev/stage-3` — incl. 4 Block D Phase 1 commits, 30 prior unpushed Block C polish + Block A/B/C feature commits)                |
| **Last commit**       | `d467b6e` `test(core): twr.property.spec.ts (21 properties) + xirr damping fix` (149/149 ✅ @arc/core)                                                                |
| **PR**                | 未开；建议 push 后开 `dev/stage-3 → main` PR 与 Block C review 同步进行                                                                                               |
| **CI status**         | `pnpm typecheck` 6/6 ✅ / `pnpm --filter @arc/core test` 149/149 ✅                                                                                                   |
| **Mobile dev server** | `pnpm mobile` → 8081；改 `.env` / migration 后 **Metro `--clear`**                                                                                                    |
| **Out of scope**      | Block E features (Inbox/AI/订阅/脱敏/价格异动)、Block F polish redesign + CSV、大陆 Auth (ADR 012 P1) 实现                                                            |

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

| Layer           | Arc artifact                                                                                                               |
| :-------------- | :------------------------------------------------------------------------------------------------------------------------- |
| Strategy        | [`docs/testing-strategy.md`](../docs/testing-strategy.md)                                                                  |
| UAT spec        | [`.specify/feature-specs/stage-2/watchlist-stage-2.md`](../.specify/feature-specs/stage-2/watchlist-stage-2.md) §S2-AC-2.x |
| UAT commands    | [`docs/dev-seed-cheatsheet.md`](../docs/dev-seed-cheatsheet.md)                                                            |
| CLI watchlist   | `pnpm seed:wl:empty` / `pnpm seed:wl:3` / `pnpm seed:wl:stale`                                                             |
| **App DEV FAB** | **功能 → 场景** — 自选场景走 App 内种子；每日快照仍要 Edge `dev-seed` deploy                                               |
| Edge deploy     | `pnpm functions:deploy:dev-seed` + `pnpm functions:secrets:dev-tools` (Daily Snapshot scenarios only)                      |

## Stage 3 — roadmap Accepted (2026-05-19)

完整路线图见 `.specify/feature-specs/stage-3/stage-3-roadmap.md`。6 个 Block 依赖排序 + 14 个决策锁定。

**Block 顺序**：A（多市场 adapters）→ B（多组合管理）→ C（详情页+图表）→ D（算法 Opus 主场）→ E（polish）→ F（CSV+P2）

**14 个决策摘要**（路线图 §七）：

| #      | 决策                                         | 影响                                                                                                                        |
| :----- | :------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------- |
| 1      | Block D 在 C 之后                            | property test 基于真实 UI 形态                                                                                              |
| 2      | 订阅 Stage 3 仅占位                          | Stage 4 接 IAP/Stripe                                                                                                       |
| 3      | AI 图标 chip preset                          | LLM 接入 V1.0+                                                                                                              |
| 4      | Inbox 空态先做                               | 价格异动后续填数据                                                                                                          |
| 5      | Offline 仅 MMKV 本地缓存读                   | 完整双向同步 → Stage 4                                                                                                      |
| **6**  | **Block C 全部走 HeroUI Pro chart 组件**     | line-chart / area-chart / bar-chart / chart-crosshair / chart-indicator —— 去掉双实现负担；donut 保留 react-native-svg 自绘 |
| **7**  | **CN/HK/FUND 主源 Tushare Pro 免费版**       | 付费版评估推后                                                                                                              |
| **8**  | **AKShare 作为候补**，推迟到 ADR 011         | 需自建 HTTP wrapper service / serverless + 法务地图复审                                                                     |
| **9**  | **天天基金 NAV adapter 放弃**                | Tushare Pro FUND 主供，AKShare 候补                                                                                         |
| **10** | **每 portfolio 独立现金 + 跨组合转账动作**   | J9 数据模型零改动；转账 = 两笔 transaction (SELL + BUY)                                                                     |
| **11** | **币种保持不自动换汇**                       | $5000 USD 转过去还是 USD 5000；换汇分两步用户主动                                                                           |
| **12** | **不允许做空现金**                           | 表单 inline validation：转出 ≤ 源 portfolio 余额                                                                            |
| **13** | **`notes` 字段标记 transfer**                | `transfer-out-to-{id}` / `transfer-in-from-{id}`                                                                            |
| **14** | **UI 落点 `/me/cash-balances` 加"转账"按钮** | 不开新路由                                                                                                                  |

## Stage 3 — Block A progress (started 2026-05-19；reshape 2026-05-20)

**Reshape 触发**：用户 2026-05-20 注册 Tushare 时实证免费版（20 积分）仅 A 股 daily 可访问 → spec / ADR 011 重写为 Phase 1A + Phase 2。

### Spec / ADR 状态

| Item                                                                                                   | Status                                                      |
| :----------------------------------------------------------------------------------------------------- | :---------------------------------------------------------- |
| `tushare-adapter-stage-3.md` Accepted — 15 决策（含 #14 HK=b + #15 QuotaError extends AdapterError）   | ✅ reshape 2026-05-20                                       |
| `docs/adr/011-multi-source-fallback-and-akshare.md` **Accepted** — Phase 2 升级为 Stage 3 Block A 必启 | ✅ 2026-05-20                                               |
| Cursor handoff prompt reshape（commit chain Phase 1A + Phase 2 全重写）                                | ✅ —— `.specify/handoffs/cursor-stage-3-block-a-kickoff.md` |

### Phase 1A — Tushare CN baseline

| Commit                                                                                                           | Status                              |
| :--------------------------------------------------------------------------------------------------------------- | :---------------------------------- |
| **#1–#9** Tushare client / resolver / CN adapter / registry / mobile env / CN+HK+FUND seeds + migration 0010 RLS | ✅ committed + **UAT CN 真实价** ✅ |
| **── Phase 1A DoD** ──                                                                                           | ✅                                  |

### Phase 2 — AKShare wrapper（ADR 011 §决策五 必启）

| Commit                                                                                                                                   | Status                                                                   |
| :--------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------- |
| **#10–#14** akshare-wrapper (Vercel `builds`+`routes`, `lib/`, ETF `fund_etf_hist_em`) + adapters + withFallback + registry + mobile env | ✅ deployed `arc-akshare-wrapper.vercel.app` + **UAT HK/FUND/510300** ✅ |
| **#15** docs(spec+adr+handoff) + session-state + valuation cache-miss fix                                                                | ✅ this checkpoint commit                                                |
| **── Phase 2 DoD** ──                                                                                                                    | ✅                                                                       |

## Stage 3 — Block B progress (multi-portfolio + transfer)

| Commit  | Item                                          | Status              |
| :------ | :-------------------------------------------- | :------------------ |
| **#1**  | migration 0011 `archived_at`                  | ✅ user applied SQL |
| **#2**  | `validateTransfer` + property tests           | ✅                  |
| **#3**  | Zustand/AsyncStorage + `useActivePortfolio`   | ✅                  |
| **#4**  | portfolios CRUD hooks                         | ✅                  |
| **#5**  | `/me/portfolios` + HardDeleteConfirmDialog    | ✅                  |
| **#6**  | PortfolioSwitcher (Portfolio Tab only)        | ✅                  |
| **#7**  | `useTransferBetweenPortfolios` + sheet        | ✅                  |
| **#8**  | cash-balances 转账入口                        | ✅                  |
| **#9**  | `useActivePortfolio` rewire + `?portfolioId=` | ✅ grep 零匹配      |
| **#10** | Insights 卡片仪表盘 + empty state             | ✅                  |
| **#11** | seed `portfolios:*` + DEV panel               | ✅                  |
| **#12** | session-state bump                            | ✅                  |

### Deferred to Stage 3 末 / Stage 4

| Item                                                              | 阻塞条件                                                         |
| :---------------------------------------------------------------- | :--------------------------------------------------------------- |
| commit #3 `tools/refresh-tushare-basics.ts` 抓 stock_basic 等     | 用户升 ¥200 / 2000 积分                                          |
| commit #5 Tushare HK adapter                                      | 决策 14 锁定 Stage 3 不实施；Stage 4 评估                        |
| commit #6 Tushare FUND adapter (`fund_nav` OF / `fund_daily` ETF) | OF：用户升 2000 积分；ETF：评估 ¥500 / 5000 积分 vs AKShare 持续 |
| Live smoke：`HK:00700` / `FUND:*` via Tushare                     | 不发生 Stage 3                                                   |

**给下一个会话的 hand-off**：

- **Opus（用户已交接）**: review `dev/stage-3` Block A commit 链 → 起草 Block B `multi-portfolio-stage-3.md`
- **Cursor/Sonnet**: Block B spec Accepted 后按 commit 链实现（多组合 / 转账 — 见 roadmap Block B）
- **TWR/PA/Drawdown property tests** Block D Opus 主场（至少 20 个 property test）—— Stage 3 第 6-7 周启动
- **用户外部 todo**：
  1. Tushare token（commit #8 真实拉价依赖；commit #1-7 不需要）
  2. Vercel 账号 + `vercel login`（commit #10 必需）
  3. `docs/legal-risk-map.md` L3/L6/§六.6 复读（commit #10 前）
  4. **可选**：Stage 3 末决定是否升 ¥200/2000 积分（commit #3 + commit #6 OF 解锁）

## Stage 3 — Block C planning (2 specs Accepted 2026-05-20，串行 i)

**Reshape**: 原 Block C 仅"持仓表 + 详情页 + 图表"；扩展加入 (a) Block A 漏单 CoinGecko adapter；(b) 跨市场 transaction entry UI；(c) AKShare wrapper `/api/search` endpoint。原因：没有这些 Stage 3 DoD"自用 ≥ 4 周"无法启动。

### Specs Accepted

| Spec                                                                                      | 决策                                        | Commits | 估时    |
| :---------------------------------------------------------------------------------------- | :------------------------------------------ | :------ | :------ |
| `.specify/feature-specs/stage-3/coingecko-adapter-stage-3.md`（Block A 漏单）             | 6                                           | 6       | ~3-5h   |
| `.specify/feature-specs/stage-3/holdings-and-transactions-stage-3.md`（Block C expanded） | 13（8 architecture + 5 UX-level A/A/A/A/A） | 13      | ~17-22h |

### Phase 1 — CoinGecko (preflight to Block C)

| Commit                                                                                         | Status                                              |
| :--------------------------------------------------------------------------------------------- | :-------------------------------------------------- |
| #1–#6 (client / coin-id resolver + bundled top200 / adapter / registry / seed / session-state) | ✅ committed locally (`b0a913c` … `fd614c6`)        |
| Live smoke: DEV `default:crypto-only` → 真实 USD 价 + 24h 变动 + CNY 换算                      | ⏳ user UAT after `pnpm seed:crypto-only` once      |
| Phase 1 DoD                                                                                    | ✅ code complete — pending Opus review + live smoke |

### Phase 2 — Block C 主链（13 commits — 执行记录）

| #   | Git (short) | Commit message (摘要)                                    | Status                           |
| :-- | :---------- | :------------------------------------------------------- | :------------------------------- |
| 1   | `dc27321`   | `feat(db): migration 0013 assets CRYPTO insert RLS`      | ✅ code                          |
| 2   | `9ffcaf7`   | `feat(ui): @arc/ui/charts wrapper layer`                 | ✅ Opus review ⏳                |
| 3   | `5a92de3`   | `feat(ui): MarketChip, AllocationDonut, HoldingsTable…`  | ✅                               |
| 4   | `08e86f3`   | `feat(data-sources): NotImplementedError → withFallback` | ✅ Opus review ⏳                |
| 5   | `691b430`   | `feat(akshare-wrapper): /api/search`                     | ✅ code; **Vercel prod** ⏳ user |
| 6   | `6e0050f`   | `feat(data-sources): AKShare searchSymbols + wires`      | ✅                               |
| 7   | `924e89c`   | `feat(mobile): Block C query hooks + rangeToWindow`      | ✅                               |
| 8   | `6f49e4f`   | `feat(mobile): last-used-market AsyncStorage`            | ✅                               |
| 9   | `80a1cb1`   | `feat(mobile): asset detail page`                        | ✅                               |
| 10  | `afceffd`   | `feat(mobile): holdings table + NAV over-time card`      | ✅                               |
| 11  | `251fc11`   | `feat(mobile): cross-market tx entry`                    | ✅ Opus review ⏳                |
| 12  | `9a7e6ee`   | `feat(seed): multi-market-full + 30-days-history`        | ✅                               |
| 13  | `b2b6474`   | `docs(spec+session-state): Block C main chain complete`  | ✅                               |

**Block B UAT prep（同链，非 Block C 编号）**: `36b24bc` Portfolio tab header + migration **0012** `portfolio_value_snapshots_user_insert_manual`.

### Block C UAT — 前置（新会话第一件事）

| Step | 动作                                                                                                                         | 验证                                                            |
| :--- | :--------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------- |
| 0    | `apps/mobile/.env` 的 `EXPO_PUBLIC_SUPABASE_URL` ref = **`jdvlzkictwinkgcvgwew`**（与 SQL Editor 同一 project）              | Dashboard URL 一致                                              |
| 1    | Supabase SQL Editor 跑 **0012** + **0013**（文件含 `DROP POLICY IF EXISTS` 幂等；0013 可能有 destructive 警告 → dev 可 Run） | 0012 若报 policy exists → 已应用可跳过                          |
| 2    | `cd services/akshare-wrapper && vercel --prod`（commit #5 后）                                                               | `curl` `/api/search?market=CN&q=茅台` + token                   |
| 3    | `pnpm mobile -- --clear`；DEV 登录（邮箱 OTP）                                                                               | 冷启动无 Metro 旧 bundle 错                                     |
| 4    | DEV FAB → **组合** → **`portfolios:30-days-history`**（首选）或 `portfolios:multi-3` / `daily-snapshot:*`                    | Portfolio Tab Hero + 730 天曲线 / 多组合切换 / 日涨跌 edge case |

### Block C — Portfolio Hero UI/UX polish（2026-05-21，commit `7c7755b`）

**范围**：`PortfolioHeroSection`（L3 组合）+ `@arc/ui/charts/*` L2 polish（点阵 area fill、scrub 遮罩/日期、Segment 周期条）。**非**仅多组合 —— 凡 **Portfolio Tab + 当前 active portfolio** 均走新 Hero（单组合 / 多组合切换同样 UI）。

| 组件                    | 层           | 说明                                                              |
| :---------------------- | :----------- | :---------------------------------------------------------------- |
| `PortfolioHeroSection`  | L3 finance   | 总市值 + 变动行 + `AreaChart` + `TimeRangeSelector` + mover chips |
| `AreaChart` + L2 子模块 | L3/L2 charts | 点阵、scrub、涨跌色；HeroUI Pro 仅 L1 挂载                        |
| `DailySnapshotCard`     | L2（保留）   | Portfolio Tab **已不再渲染**；delta 类型仍复用                    |
| ADR 013                 | docs         | wrapper 所有权纪律                                                |

**DEV 场景（Hero UAT 首选）**：

| 场景                               | 覆盖                                                                                                  |
| :--------------------------------- | :---------------------------------------------------------------------------------------------------- |
| **`portfolios:30-days-history`**   | ✅ **最全**：多市场持仓 + 730 天 `portfolio_value_snapshots` + Hero chart/scrub                       |
| `portfolios:multi-3`               | 多组合 ▼ 切换（非全市场）                                                                             |
| `daily-snapshot:*`                 | 日涨跌 edge case（first-day / mixed-movers 等）；仍进 Portfolio Tab                                   |
| `default:cross-market` 等          | 单市场报价 smoke；**不**替代 30-days-history                                                          |
| ~~`portfolios:multi-market-full`~~ | 已从 DEV FAB 移除（被 30-days-history 严格覆盖）；CLI `pnpm seed:portfolios:multi-market-full` 仍可用 |

**UI polish 单独提交纪律（Opus Block C review 前必读）**：

1. Block C **L2/L3 UI/UX polish**（`packages/ui` charts/finance、`PortfolioHeroSection`）与 Opus 审查的 **adapter / RLS / hooks / core** 层 **正交** —— 可先 commit polish slice（已验证 `7c7755b`、`2c20863`、`8adf16f`）。
2. **提交前自检**：改动是否仅 UI + 薄 wiring（`index.tsx` props、`time-range.ts` UTC、`snapshotsToChartPoints.asOf`）？是 → 可提交。
3. **若触及** `data-sources`、`packages/core` 估值、`migration`、snapshot cron/query 契约 → **先通知用户**，由用户决定是否与 Opus review 并行或等 review 后再合。
4. Opus review 后若只改数据层，Hero 组件 **通常无需回滚**；最多同步 `ChartPoint` / hook 字段。

### Block C — Portfolio Tab polish（2026-05-22，commits `2c20863` + `8adf16f`）

| 项                                      | commit    | 说明                                                                                                                 |
| :-------------------------------------- | :-------- | :------------------------------------------------------------------------------------------------------------------- |
| Holdings 表 + typography + theme toggle | `2c20863` | HoldingRow 涨跌格式、`HoldingsMarketFilter`、Settings `setColorMode` 修 dark 拨两次                                  |
| soft-foreground 桥接 + 市场筛选 Hero    | `8adf16f` | `@theme inline` 整族 4 个 `*-soft-foreground` → Foundation；`portfolio-market-filter.ts` 同步 hero 总值/日涨跌/chart |

**Token 根因（必读）**：HeroUI `theme.css` 的 `--color-*-soft-foreground` 不读 Arc `@layer theme` 的 `--*-soft-foreground`；className 走 `--color-*`。见 ADR 003 §双命名空间 + `DESIGN-TOKENS.md` §Tailwind 桥接清单。

**工作区未 commit（UAT / Opus 仍待）**：US adapter、Finnhub/AV 历史价、migration 0012/0013 补丁、seed 扩展、`asset/[symbol]` 等 —— 见 `git status`。

### Block C UAT — S3-AC-C 清单 ✅ (user verified 2026-05-24)

所有 C.1–C.12 通过签 off。无回归 bug。详细 AC 契约见 `holdings-and-transactions-stage-3.md §S3-AC-C`。

| AC       | 测什么                                 | 状态 |
| :------- | :------------------------------------- | :--- |
| **C.1**  | 持仓表 market 分组 + 双币种            | ✅   |
| **C.2**  | tap 行 → `/asset/CN/600519`            | ✅   |
| **C.3**  | 详情 1M→1Y 重拉 historical             | ✅   |
| **C.4**  | tx entry CN 搜「茅台」→ AKShare search | ✅   |
| **C.5**  | CRYPTO BUY → ensureAsset + tx          | ✅   |
| **C.6**  | trade_date 可 back-date ≠ created_at   | ✅   |
| **C.7**  | per-portfolio last-used market         | ✅   |
| **C.8**  | Insights donut 按 asset 权重           | ✅   |
| **C.9**  | Portfolio area-chart + Hero scrub      | ✅   |
| **C.10** | search 503 限流 UI 保留旧结果          | ✅   |
| **C.11** | Tushare CN NotImpl → AKShare fallback  | ✅   |
| **C.12** | 详情「我的持仓」盈亏色                 | ✅   |

**Next on Block C track**: user push the 34 ahead commits → 起 Opus 会话 review `9ffcaf7` (#2 charts) / `08e86f3` (#4 fallback) / `251fc11` (#11 tx entry).

### 关键路径（修 bug 时）

| 领域              | 路径                                                                                                                                        |
| :---------------- | :------------------------------------------------------------------------------------------------------------------------------------------ |
| Spec / AC         | `.specify/feature-specs/stage-3/holdings-and-transactions-stage-3.md`                                                                       |
| Kickoff           | `.specify/handoffs/cursor-stage-3-block-c-kickoff.md`                                                                                       |
| Portfolio Tab     | `apps/mobile/app/(tabs)/index.tsx`, **`PortfolioHeroSection`**, `HoldingsTable`                                                             |
| Asset 详情        | `apps/mobile/app/asset/[market]/[symbol].tsx`, hooks `use-asset-detail`, `use-historical-quotes`                                            |
| Tx 录入           | `apps/mobile/app/portfolio/...` tx entry 路由, `use-transactions`, `use-symbol-search-cross-market`                                         |
| Charts            | `packages/ui/src/charts/*`                                                                                                                  |
| Search / fallback | `with-fallback.ts`, `services/akshare-wrapper/api/search.py`                                                                                |
| Seed              | `run-portfolios-seed-client.ts`, DEV panel **`portfolios:30-days-history`**（CLI 仍可用 `pnpm seed:portfolios:multi-market-full` 轻量种子） |
| Migrations        | `0012_portfolio_value_snapshots_user_insert_manual.sql`, `0013_assets_authenticated_insert_crypto.sql`                                      |

## Stage 3 — Block D Phase 1 progress (2026-05-24) ✅

TWR algorithm layer 全栈落地，纯 `@arc/core`，未碰 UI / hooks / adapters。

| Commit    | Title (摘要)                                                      | Files | Tests added              |
| :-------- | :---------------------------------------------------------------- | :---- | :----------------------- |
| `1da6437` | `feat(core): returns/cash-flow.ts + types.ts + errors.ts`         | 5     | 19 (cash-flow detection) |
| `e2399c4` | `feat(core): returns/twr.ts (Modified Dietz simplified)`          | 4     | 10 (twr unit)            |
| `3b71170` | `feat(core): returns/xirr.ts (Newton-Raphson MWR)`                | 3     | 5 (xirr unit)            |
| `d467b6e` | `test(core): twr.property.spec.ts (21 properties) + xirr damping` | 2     | 21 (property) + 1 sanity |

**Total**: 14 files / +2083 / -28 ; `pnpm --filter @arc/core test` **149/149 ✅** ; `pnpm typecheck` **6/6 ✅**.

### Algorithm contract (locked — Phase 2 hooks consume these signatures)

- `computePortfolioTwr(input: PortfolioTwrInput): TwrResult` — `valueAt(date)` returns EOD-after-CF; chain strips CF from intermediate sub-period ends; same-currency CF filter via `reportingCurrency`
- `computeAssetTwr(input: AssetTwrInput): TwrResult` — every BUY/SELL of asset is a CF; `valueAt` derived from `computeSharesAt × priceAt`
- `computeMwr(cashFlows, options?): MwrResult` — Newton-Raphson with damping (next-r ≤ -1 → step halfway to -0.999); throws `ConvergenceError` on empty / zero-spread / iteration-cap / zero-derivative
- `computeSharesAt(transactions, assetId, date)` + `getAssetFirstBuyDate(transactions, assetId)` — exported for PA spec reuse
- `Decimal.set({ precision: 28 })` declared in `returns/index.ts` (spec §决策 7); existing 113 prior tests pass at 28-digit precision

### 雪球对标准备清单 (Phase 3 — user 配合)

- 3 标的 ≥ 6 个月真实持仓（建议 1 CN + 1 US + 1 ETF/FUND 覆盖跨币种）
- 真实 transactions 在 Arc 录入（Block C tx entry 已支持）
- Arc TWR vs 雪球 TWR 截图存档 `docs/dod-verification/twr-snowball-{ticker}-{date}.png`
- 误差 ≤ 1.0% per 标的 (Stage 3 DoD-hard)

### Phase 2 follow-ups (Opus review of commits #5+#6, 2026-05-25)

P0/P1 fixes folded into the review pass (commit #5 FX historical-rate violation + missing `twr-window.spec.ts`; commit #6 B1 Insights TWR hidden in no-targets branch). Remaining follow-ups (non-blocking, see `twr-stage-3.md §Known limitations`):

- **FU-1** Batch fallback adapter fetches when ≥ 10 holdings × ≥ 5 fallback days
- **FU-2** Reroute `console.warn` → Sentry (Stage 4 observability)
- **FU-3** Clamp non-ALL `from` to `earliestPortfolioTradeDate`; surface evaluated period in UI label
- **FU-4** Revisit `FX_LOOKBACK_DAYS=7` if long bank-holiday stretches start triggering "—" in practice
- **FU-5** Unify `useAssetTwr` price fetch with `useHistoricalQuotes` via a `lookbackDays` option (currently two parallel adapter calls per Asset detail mount)

### Phase 2 hand-off prompt (复制到新 Sonnet/Cursor Chat)

```
接力 Arc Stage 3 Block D TWR Phase 2（mobile hooks + UI 接入）。

必读：CLAUDE.md → .specify/session-state.md §Block D Phase 1 → twr-stage-3.md §"Implementation plan Phase 2".

Phase 1 已落地 4 commits（cash-flow/twr/xirr/property tests，149/149 ✅）；
本会话不动 @arc/core，只在 apps/mobile + packages/ui/finance 加 2 hooks + 1 内嵌组件 + 3 处页面挂数字。

commit chain：
  #5 feat(mobile): use-asset-twr + use-portfolio-twr (TanStack hooks，wrap snapshot + computeValuationAtDate fallback；valueAt 按 spec §决策 3 优先读 portfolio_value_snapshots)
  #6 feat(ui+mobile): TwrInlineLabel 组件 + Portfolio Tab Hero 接入 + Asset detail 接入 + Insights 卡接入 + i18n 6 strings

按 spec §UI contract J15a/b/c 三处接入位置；时段联动复用 Block C `rangeToWindow` helper。
不 push；每 commit 末 pnpm typecheck 6/6 + pnpm test 全绿。
```

## Active blockers / waiting on user

- **Migration `0010`** `assets` CN/HK/FUND INSERT RLS — ✅ user applied (SQL Editor)
- **`EXPO_PUBLIC_TUSHARE_TOKEN` + `EXPO_PUBLIC_AKSHARE_WRAPPER_*`** — ✅ `apps/mobile/.env`（改 env 须保存 + 重启 Metro）
- **AKShare wrapper** — ✅ Vercel prod + token；Stage 4 前评估迁国内云（阿里云/火山）降延迟
- **¥200 / 2000 Tushare 积分** — 可选；解锁 commit #3 `stock_basic` + commit #6 FUND OF
- **`EXPO_PUBLIC_FINNHUB_API_KEY`** — ✅
- **Daily Snapshot cron** ✅（`verify_jwt=false` + secrets 对齐；GH `26095476933`）
- **Dev 行情** — Settings「拉取真实行情」开关已移除；dev/prod 均 Finnhub + Frankfurter（dev = cache-first）
- **`brew install deno`** — optional, before `pnpm test:functions` locally (J8 dev-seed handler tests)

## Immediate next actions (next session)

**Track A — Block C 收尾（用户主导）**

1. `git push origin dev/stage-3`（34 ahead；含 Block C 主链 + Hero polish + Block D Phase 1）
2. 起 Opus 会话 review Block C 三个 deferred commits（`9ffcaf7` charts wrapper / `08e86f3` `NotImplementedError → withFallback` / `251fc11` cross-market tx entry）+ ADR 012 提议复审
3. 评估开 `dev/stage-3 → main` Stage 3 partial PR（Block A/B/C + Block D algorithm，Phase 2/3 后续 PR）

**Track B — Block D Phase 2（Sonnet/Cursor，新会话）**

1. 用 §Phase 2 hand-off prompt 起 Sonnet/Cursor 会话
2. 实施 commit #5/#6（hooks + UI 挂数字）
3. UAT：Asset detail "1Y TWR：+X.XX%" 联动 / Portfolio Tab Hero "YTD TWR" 显示 / Insights 卡 "1月 TWR"

**Track C — Block D Phase 3（用户 + Opus）**

1. 用户选 3 标的 ≥ 6 月真实持仓（建议 1 CN + 1 US + 1 ETF/FUND）
2. 雪球 TWR 截图 + Arc 录入相同 transactions
3. 截图存档 `docs/dod-verification/twr-snowball-{ticker}-{date}.png` + 误差 ≤ 1.0%

**Track D — Block D specs 余下两条（Opus）**

1. PA spec implementation Phase 1 — 复用 `computeSharesAt` + sub-period contribution
2. Drawdown spec implementation Phase 1 — 基于 `portfolio_value_snapshots` 时序

**暂缓**：ADR 012 接受、大陆 Auth 实现。

**Switch-back-to-Opus triggers** (Stage 3):

- TWR / MWR 算法（property tests 强需求）
- Performance Attribution 算法
- 任何动到 @arc/core 的迁移或不变性条款

## Open decisions / questions

- **Resolved 2026-05-18**: Watchlist DEV seed in App uses **client JWT path** for `watchlist:*` only; portfolio reset scenarios still need Edge Function.
- **Resolved 2026-05-18**: Dev tools UI = **two-level** (feature picker → scenarios), not flat list.
- **Resolved 2026-05-18 (J9 UAT)**: Rebalance DEV 场景漂移应靠 **不同 `target_allocations`**（在 fixture 固定价下算出 ±7% / ±15%），不能只改 DB NVDA 价；seed 后须 **`warmRebalanceMarketCache()`**（fixture 模式不读 Supabase `price_snapshots`）。
- **Resolved 2026-05-19 (UI polish)**: `/me` 拆 **嵌套 Stack**（`app/me/_layout.tsx`）— 根仅 `slide_from_left` + `animationMatchesGesture` + `fullScreenGestureEnabled`；子页自右 push。`InScreenHeader` 增加 `density: comfortable` 用于 modal（如自选搜索）。Tab 滚动底缘 `TabScrollShadow`（`ScrollShadow` + `LinearGradient`）。`@arc/eslint-plugin-token-discipline` + ADR 008 / DESIGN-TOKENS 同步。
- **Resolved 2026-05-19 (ADR 010 dev cache trust)**: 四条 cache-first 读路径（`use-watchlist-quotes` / `use-portfolio-valuation` / `use-price` / `validate-us-symbol`）统一使用 `apps/mobile/src/lib/stale-quote.ts` 的 `isStaleQuoteSource`。`STALE_SOURCES = {seed-dev, fixture, alphavantage}` 或 `changePercent == null` → 不信任缓存、触发 Finnhub。`CACHE_FIRST_READ_FRESHNESS_MS` 保留 `Infinity`（24h freshness 与 dev 永不自动网络的设计冲突，收回）。DEV watchlist seed 假数据 **保留**（stale-quote 场景需要），仅加注释说明。
- **Resolved 2026-05-20 (Block A)**: Tushare 免费版仅 A 股 daily；HK/FUND 主源 AKShare Vercel wrapper；场内 ETF（510300）用 `fund_etf_hist_em` 非 `stock_zh_a_hist`；`apps/mobile/.env` AKShare 行须落盘否则 Metro 不加载；cache-first 组合估值对 **cache miss** 自动补网拉价。
- **Resolved 2026-05-21 (Block C Hero)**: Portfolio Tab 用 **`PortfolioHeroSection`** 替代 `DailySnapshotCard` + `PortfolioValueOverTimeCard` 叠 Card；chart polish 在 `@arc/ui/charts` L2（ADR 013）。**全局**：active portfolio 不论单/多组合均同一 Hero UI。
- **Resolved 2026-05-22 (Token dual-namespace)**: HeroUI `@theme inline static` 的 `--color-*` 与 Arc `@layer theme` 的 `--*` 是两条通道；`*-soft-foreground` 等 Calculated Variables 须 `global.css` `@theme inline` 桥接。整族 accent/success/danger/warning 已桥接；接新组件见 DESIGN-TOKENS §Tailwind 桥接清单。
- **Resolved 2026-05-21 (UI commit discipline)**: Block C UI/UX polish 可单独 commit，若仅 L2/L3 + 薄 wiring；触及 data-sources/core/migration 先问用户再 commit。

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
- **缓存信任 (ADR 010)**: dev `cache-first` 不再无条件信任 cache。`source ∈ {seed-dev, fixture, alphavantage}` 或 `changePercent == null` → 走 Finnhub。新写一个 cache-first 读路径必须 `import { isStaleQuoteSource } from "../stale-quote"` 并在 `priceCache.get` 之后过滤，否则 HOOD/AAPL/MSFT/NVDA 类 bug 会复发。
- **`DeviationBar` (RN)**: 勿用 `h-2` + `h-full` 撑条高 — 用固定 `8px`；条宽按 `|deviationPercent|` 而非 `currentPercent`。
- All prior Stage 1 gotchas still apply (FixtureAdapter, @arc/ui imports, OTP 8-digit, etc.).
- **Expo SDK 55** (2026-05-19): `expo@~55`, RN **0.83.6**, React **19.2**; `app.json` 已移除 `newArchEnabled` / `edgeToEdgeEnabled`（SDK 55 默认）；monorepo 启用 `experiments.autolinkingModuleResolution`；根 `pnpm.overrides` 钉住 `react@19.2.0`。勿扫 **8082** 等非 Arc Metro 二维码（会报 SDK 54 不兼容）。
- **AKShare wrapper (Vercel)**: 纯 Python 子项目须 `vercel.json` **`builds` + `routes`**（勿仅用 `functions` glob）；共享代码放 `lib/` 勿放 `api/_shared/`。Hobby 冷启动慢；跨市场 4 标的串行拉价 UI 全表「加载中」直到最慢一只返回。
- **Portfolio Hero**: `import { PortfolioHeroSection } from '@arc/ui'` — 业务页不拼 chart 子组件。DEV 全量 UAT → **`portfolios:30-days-history`**（FAB **组合** → 落地 Portfolio Tab）。
- **Market filter hero**: `selectedMarketFilters` 非空时 hero 总值/日涨跌/chart 经 `portfolio-market-filter.ts` 重算（与 holdings 表一致）。
- **Tailwind soft-foreground**: 改 `@layer theme` 的 `--accent-soft-foreground` 不够；须 `global.css` `@theme inline` 桥接 `--color-*-soft-foreground`（见 ADR 003）。
- **Cross-market DEV seed**: `default:cn-only|hk-only|fund-only|cross-market|crypto-only` 走 **App 内 JWT**（`run-cross-market-seed-client.ts`），非 Edge `dev-seed`。CRYPTO 资产行首次需 `pnpm seed:crypto-only`（service_role）或 Block C migration 0013。

## Active env / config snapshot

| File               | Status                                                                                            |
| :----------------- | :------------------------------------------------------------------------------------------------ |
| `apps/mobile/.env` | Supabase + Finnhub + **Tushare + AKShare wrapper URL/token**（gitignored）                        |
| `.env.dev.local`   | `SUPABASE_DEV_*`, `DEV_SEED_EMAIL`                                                                |
| Migrations         | `0001`–`0010` ✅；**0012** manual snapshot insert、**0013** CRYPTO assets — **UAT 前用户 SQL** ⏳ |
| AKShare wrapper    | `https://arc-akshare-wrapper.vercel.app` + `AKSHARE_WRAPPER_TOKEN` on Vercel                      |
| Supabase project   | `jdvlzkictwinkgcvgwew`                                                                            |
| Git branch         | `dev/stage-3`                                                                                     |

## Recent ADRs (most relevant first)

| ADR     | Topic                                                                                             |
| :------ | :------------------------------------------------------------------------------------------------ |
| **013** | `@arc/ui` wrapper 所有权 + chart L2 polish（Portfolio Hero 落地）— **已接受**                     |
| **012** | 双区域 Auth + 数据驻留（大陆微信/手机/邮箱，P1 BFF + Supabase session）— **提议，待 Opus review** |
| **011** | 多源 fallback + AKShare wrapper（Stage 3 HK/FUND primary）— **已接受 + Phase 2 已实施**           |
| 010     | Dev cache trust strategy (`isStaleQuoteSource` 共享 helper；Infinity freshness)                   |
| 009     | Daily Snapshot timing (23:00 UTC) + cron + cache-only snapshot                                    |
| 008     | FixtureAdapter + Settings market-data toggle（fixture 路径已退役）                                |
| 007     | Dev auth + seed SQL injection                                                                     |
| 006     | `@arc/ui` layering                                                                                |

## How to use this file

1. **Block C UAT 会话**: CLAUDE.md → this file §Block C UAT → `holdings-and-transactions-stage-3.md` §S3-AC-C.
2. DEV FAB: **组合** → **`portfolios:30-days-history`**（Hero 全量 UAT）；日涨跌 edge → **每日快照** 组。
3. End session: `/checkpoint`.
