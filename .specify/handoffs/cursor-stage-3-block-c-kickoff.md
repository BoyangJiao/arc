# Cursor 启动 prompt — Stage 3 Block C：持仓表 + 资产详情 + 多时段图表 + 跨市场交易录入

> 复制下方代码块到 Cursor Composer / Chat。该 prompt 不指定模型 —— Cursor auto 按 `CLAUDE.md §七 + §十二` 自评估路由（提示：13 commits 大部分 Sonnet 套路 UI/hook；**Opus 介入 3 处**：commit #2 `@arc/ui/charts/` wrapper 层架构 / commit #4 withFallback classifier 改 ADR 011 §决策三 / commit #11 cross-market tx entry post-batch review）。
>
> **前置依赖（已就绪）**：
>
> - Block A ✅（Tushare CN + AKShare HK/FUND）
> - Block B ✅（multi-portfolio + transfer + Insights 卡片仪表盘）
> - CoinGecko adapter ✅（commits b0a913c → 63ba43d；159/159 tests）
> - Block B UAT 5 sessions（用户跑中 / 已通过 / 阻塞 — Cursor 启动时 git status 看是否有未 commit 的 0012 portfolio_value_snapshots_user_insert_manual.sql）
> - Block C spec Accepted (13 决策；详见 `.specify/feature-specs/stage-3/holdings-and-transactions-stage-3.md`)

---

````
接力 Arc Stage 3 Block C —— 持仓表 + 资产详情 + 多时段图表 + 跨市场交易录入 commit 链。

## 必读（按此顺序，不要跳）

1. `CLAUDE.md` — 项目铁律（§三 工程铁律 + §五 monorepo 结构 + §七 模型分工 + §十二 自我路由）
2. `.specify/constitution.md` — P0 约束（Decimal everywhere / Immutability of transactions / Adapter 抽象边界 / Accent discipline ADR 008）
3. `.specify/session-state.md` — Stage 3 Block C 进度 + Active blockers
4. `.specify/feature-specs/stage-3/holdings-and-transactions-stage-3.md` — **本任务契约**（Status = Accepted，13 决策，13 commits 分 4 phase）
5. `docs/adr/011-multi-source-fallback-and-akshare.md` — 决策三 classifier 本 spec 要扩 `NotImplementedError → try-secondary`

## 关键 Block C 决策摘要（spec §Resolved decisions）

| #  | 决策                                                                                             |
| :- | :----------------------------------------------------------------------------------------------- |
| 1  | HeroUI Pro chart 走 `@arc/ui/charts/` 封装层；业务 `import { LineChart, AreaChart } from '@arc/ui'` |
| 2  | Time-range = `1D / 1W / 1M / 3M / YTD / 1Y / ALL`（无 1H，全 EOD）                                |
| 3  | Asset 详情 URL = `/asset/[market]/[symbol]`（两段，不 URL encode）                                |
| 4  | 持仓表按 `asset.market` 分组：US → CN → HK → FUND → CRYPTO → CASH                                 |
| 5  | 价格列双显（原始币种 + 报告币种）；同币种时单显                                                    |
| 6  | Tx entry 跨市场 = 单一路由 + 顶部 market chip + 内嵌 symbol picker（不开 5 个分立路由）           |
| 7  | AKShare wrapper 新增 `/api/search?market=CN\|HK\|FUND&q=...`                                     |
| 8  | Tx entry `trade_date` 用户可改（默认今天）；与 `created_at` 分离用于 Block D TWR                  |
| 9  | AllocationDonut 按 asset 分组（每持仓一段）                                                       |
| 10 | Time-range 默认 1M；切换不持久化                                                                  |
| 11 | SymbolPicker 默认 market = per-portfolio 上次记忆（AsyncStorage key `arc.lastUsedMarket.{portfolioId}`） |
| 12 | 持仓表 tap 整行 → `/asset/[market]/[symbol]`                                                     |
| 13 | Tx entry 录入完跳回 Portfolio Tab + "继续录入" 按钮可切到 C 模式（连录）                          |

## 模板（必读 + 必照搬模式）

- `packages/ui/src/finance/DeviationDonut.tsx`（J9）—— commit #3 `AllocationDonut` extract 或 rename 复用同实现
- `packages/data-sources/src/adapters/coingecko/` —— adapter 形态参考（client + index + tests）
- `packages/data-sources/src/adapters/with-fallback.ts` —— commit #4 加 NotImpl → try-secondary 改这里
- `apps/mobile/app/insights/rebalance/setup.tsx` —— modal route 范式（commit #9 `/asset/[market]/[symbol]` 同模式）
- `apps/mobile/src/lib/queries/use-watchlist-quotes.ts` —— TanStack hook + adapter 调用 + 错误降级范式（commit #7 4 hooks 参照）
- `services/akshare-wrapper/api/quote.py` + `lib/akshare_client.py` —— Python handler 范式（commit #5 加 search.py 同模式）

## ⚠️ Migration 编号

Block B UAT prep 留了一个未 commit 的 `packages/db/drizzle/migrations/0012_portfolio_value_snapshots_user_insert_manual.sql`。**两种情况**：

- (a) 用户在你启动前已 commit 0012 → 本 spec commit #1 写 **0013**（spec §Data model 已写）
- (b) 用户决定回滚 0012 → 本 spec commit #1 写 **0012**

启动时跑 `ls packages/db/drizzle/migrations/` 看实际状态再决定。**默认假设 0012 会 commit（情况 a），所以本 prompt 全部用 0013**。

## 任务 — Block C spec § Implementation plan 13 commits（4 phases）

按 phase 顺序执行；同 phase 内 commit 可微调顺序但建议照编号。每个 commit 末尾跑 `pnpm typecheck && pnpm lint && pnpm test`（全 6/6 + 绿）。

### Phase 1 — Foundation（commits #1–#5）

#### commit #1 — `feat(db): migration 0013 assets CRYPTO insert RLS`

- 新建 `packages/db/drizzle/migrations/0013_assets_authenticated_insert_crypto.sql`:
  ```sql
  CREATE POLICY "assets_authenticated_insert_crypto"
    ON "assets"
    FOR INSERT
    TO authenticated
    WITH CHECK (market = 'CRYPTO');
````

- **用户操作**：Supabase SQL Editor 执行；commit message 标 "User must apply migration 0013 in dev Supabase"

#### commit #2 — `feat(ui): @arc/ui/charts/ wrapper layer (LineChart / AreaChart / ChartCrosshair / TimeRangeSelector)`【**Opus review 推荐**】

- 新建 `packages/ui/src/charts/`：
  - `LineChart.tsx`：subpath import `heroui-native-pro/line-chart`，props 接收 `data: Array<{x: number, y: number}>` + `color` + `height`
  - `AreaChart.tsx`：subpath import `heroui-native-pro/area-chart`，渐变 fill 由组件内 default token（不让业务传颜色，统一 ADR 003 v3.1 Business token）
  - `ChartCrosshair.tsx`：subpath import `heroui-native-pro/chart-crosshair`
  - `TimeRangeSelector.tsx`：segmented control `1D | 1W | 1M | 3M | YTD | 1Y | ALL` + `defaultValue="1M"` + `onChange`
  - `index.ts`：flat barrel + 加入 `packages/ui/src/index.ts`
- **subpath import 纪律照 Stage 3 roadmap §决策 6**：勿从 `heroui-native-pro` 顶层 import（chart-indicator 依赖 skia，顶层 import 会被 Metro 贪婪解析失败）
- 测试：snapshot 测试可选；架构对了不强求

#### commit #3 — `feat(ui): MarketChip + AllocationDonut + HoldingsTable + HoldingRow`

- 新建 `packages/ui/src/finance/MarketChip.tsx`：props `{ market: Market }` → 显示 US/CN/HK/FUND/CRYPTO/CASH 中文 + accent-soft 背景（ADR 008 chip 用 soft tint）
- 新建 `packages/ui/src/finance/AllocationDonut.tsx`：从 J9 `DeviationDonut` 抽出（保留 `DeviationDonut` 不变；`AllocationDonut` 是按 asset 分组的简化版，无 target 偏离概念）；props `{ slices: Array<{label: string, value: Decimal, color?: string}> }`
- 新建 `packages/ui/src/finance/HoldingRow.tsx`：单行 presenter — symbol + name + shares + 价值双列（spec UI contract）
- 新建 `packages/ui/src/finance/HoldingsTable.tsx`：按 market 分组渲染 + section header 含小计 + 折叠 state；接收 `holdings + reportingCurrency + onRowPress(assetId)`

#### commit #4 — `feat(data-sources): with-fallback classifier add NotImplementedError → try-secondary`【**Opus review 推荐**；ADR 011 §决策三 同步】

- 修改 `packages/data-sources/src/adapters/with-fallback.ts` `defaultFallbackClassifier`：
  ```ts
  if (err instanceof NotImplementedError) return "try-secondary";
  ```
  插入位置：`RateLimitError / QuotaError` check 之后；`NetworkError` 之前。
- 删除现有硬 guard `!(err instanceof NotFoundError) && !(err instanceof ParseError)` —— spec §决策三 已说 classifier 是 single source of truth；defaults 已包含 bubble for these，不需要硬 guard
- 修改 `packages/data-sources/__tests__/with-fallback.spec.ts`：
  - 在 classifier table.each 加一行 `[new NotImplementedError("p", "searchSymbols"), "try-secondary"]`
  - 加 `primary NotImpl → secondary` integration test
- 修改 `docs/adr/011-multi-source-fallback-and-akshare.md` §决策三表格：补一行 `NotImplementedError → try-secondary`，对应注释"Tushare CN searchSymbols stub fallback to AKShare"

#### commit #5 — `feat(akshare-wrapper): /api/search endpoint + lib search_cn/hk/fund`

- 新建 `services/akshare-wrapper/api/search.py`（结构同 quote.py / historical.py，复用 P1-2/P1-3 错误拆分模式 + `_require_token`）
- 修改 `services/akshare-wrapper/lib/akshare_client.py` 加 `fetch_search(market, q)`：
  - `CN`: `ak.stock_zh_a_spot_em()` → 模块级 `_DF_CACHE = {"cn_spot": (df, ts)}` 24h TTL → filter by 代码 or 名称 → 取 8 条 → 返回 `[{assetId, symbol, name, market: "CN", currency: "CNY"}]`
  - `HK`: `ak.stock_hk_spot_em()` 同模式
  - `FUND`: `ak.fund_name_em()` 同模式
- 修改 `services/akshare-wrapper/vercel.json` `builds` + `routes` 加 search.py
- **用户操作**: 完成后 `cd services/akshare-wrapper && vercel --prod` 重部署 + 验证：
  ```bash
  curl -H "X-Arc-Token: $TOKEN" "https://arc-akshare-wrapper.vercel.app/api/search?market=CN&q=茅台"
  ```
  期望返回 JSON 数组含 `CN:600519` 贵州茅台
- 修改 `services/akshare-wrapper/README.md` API 表加一行 `/api/search`

### Phase 2 — Cross-market read（commits #6–#8）

#### commit #6 — `feat(data-sources): akshare client searchSymbols + per-market adapter wires`

- 修改 `packages/data-sources/src/adapters/akshare/client.ts`：`AkshareClient` 接口加 `searchSymbols(market, q)` → call `/api/search`
- 修改 `adapters/akshare/{cn,hk,fund}.ts`：每个 adapter 实现 `searchSymbols: (q) => client.searchSymbols(market, q)`
- Tushare CN adapter (`adapters/tushare/cn.ts`) 仍抛 NotImpl（不变；commit #4 已让 withFallback fallback 到 AKShare CN search）
- 修改 `__tests__/akshare-client.spec.ts` + adapter spec 加 search 路径 test

#### commit #7 — `feat(mobile): 4 query hooks`

- 新建 `apps/mobile/src/lib/queries/use-symbol-search-cross-market.ts`：debounce 350ms + `enabled: query.length >= 2` + 调 `registry.resolvePriceAdapter(market).searchSymbols(query)` + RateLimit/Quota → 返回空（caller UI 显示 inline error，与 J8 watchlist 同模式）
- 新建 `apps/mobile/src/lib/queries/use-historical-quotes.ts`：`{ assetId, range: TimeRange }` → `rangeToWindow(range)` 计算 from/to → `adapter.fetchHistorical(symbol, from, to)` → `staleTime: 5 * 60 * 1000`
- 新建 `apps/mobile/src/lib/queries/use-asset-detail.ts`：返回 `{ asset, latestQuote, holdings, costBasis, unrealizedPnL }`；用现有 `usePrice` + asset row + 当前 active portfolio holdings 拼装
- 新建 `apps/mobile/src/lib/queries/use-portfolio-value-snapshots.ts`：读 `portfolio_value_snapshots` 表 + `WHERE portfolio_id = activeId AND snapshot_date BETWEEN ?`
- `rangeToWindow` helper 放 `apps/mobile/src/lib/time-range.ts`：`1D → today / 1W → -7d / 1M → -30d / 3M → -90d / YTD → Jan 1 / 1Y → -365d / ALL → 2020-01-01`

#### commit #8 — `feat(mobile): last-used-market AsyncStorage store + per-portfolio key`

- 新建 `apps/mobile/src/lib/store/last-used-market.ts`：单纯 AsyncStorage 读写（不用 Zustand —— 这是 per-call lookup 不是 reactive state）
  - `getLastUsedMarket(portfolioId): Promise<Market | null>` reads `arc.lastUsedMarket.{portfolioId}`
  - `setLastUsedMarket(portfolioId, market): Promise<void>`
  - `clearLastUsedMarket(portfolioId): Promise<void>`（portfolio 永久删除时调）

### Phase 3 — UI（commits #9–#11）

#### commit #9 — `feat(mobile): /asset/[market]/[symbol] detail page`

- 新建 `apps/mobile/app/asset/[market]/[symbol].tsx`：
  - 顶部：name + ticker + 当前价 + 24h 变动 chip（color via `useBusinessClasses()` gain/loss/neutral）+ asOf timestamp
  - 中部：`<TimeRangeSelector value={range} onChange={setRange} />` + `<LineChart data={historicalQuotes} />`
  - 底部："我的持仓"区：持有 / 平均成本 / 当前价值 / 未实现盈亏（双币种）
  - "+ 录入此资产交易" CTA → `router.push("/portfolio/[id]/transactions/new?prefillMarket=...&prefillSymbol=...")`（commit #11 实现 prefill 解析）

#### commit #10 — `feat(mobile): Portfolio Tab integrate HoldingsTable + PortfolioValueOverTimeCard`

- 新建 `packages/ui/src/finance/PortfolioValueOverTimeCard.tsx`：area-chart + 时间段 selector + peak/trough 标注
- 修改 `apps/mobile/app/(tabs)/index.tsx`（Portfolio Tab）：
  - 顶部加 `<PortfolioValueOverTimeCard portfolioId={activeId} />`
  - 下方加 `<HoldingsTable holdings={...} reportingCurrency={...} onRowPress={(assetId) => router.push("/asset/[market]/[symbol]", { ... })} />`
  - 既有 `DailySnapshotCard` / `InsightsActiveRebalancePanel` 位置可视情况调整
- 持仓数据：`useActivePortfolio()` → `usePortfolioHoldings(activeId)`（已存在 Block B）→ HoldingsTable

#### commit #11 — `feat(mobile): SymbolPicker + MarketSelector + /portfolio/[id]/transactions/new rewrite`【**Opus post-batch review 推荐**】

- 新建 `apps/mobile/src/components/MarketSelector.tsx`：horizontal scroll `<MarketChip>` selector × 5 (US/CN/HK/FUND/CRYPTO)；props `{ value: Market, onChange }`
- 新建 `apps/mobile/src/components/SymbolPicker.tsx`：搜索框 + debounce + `<FlatList>` results + tap → callback；接 `useSymbolSearchCrossMarket(market, query)`
- 重写 `apps/mobile/app/portfolio/[id]/transactions/new.tsx`：
  - State machine: step 1 (market + symbol pick) → step 2 (form fields)
  - URL query 支持 `?prefillMarket=CN&prefillSymbol=600519`（asset detail 跳进来时直接到 step 2）
  - 表单：type (BUY/SELL/DIVIDEND/SPLIT picker) / shares / price_per_share / currency (从 asset.currency default + readonly) / fee / trade_date (HeroUI Pro DatePicker) / notes
  - submit：调用 `ensureAsset({id: "{market}:{symbol}", market, symbol, name, currency})` upsert + `transactions.insert()` + onSuccess invalidate + toast + 跳回 Portfolio Tab + "继续录入" 按钮（决策 13 C 模式）
- `last-used-market` 集成：tx entry 打开时读 `getLastUsedMarket(portfolioId)` → 默认 chip；用户切 chip 后 `setLastUsedMarket(portfolioId, market)`

### Phase 4 — Seed + 收尾（commits #12–#13）

#### commit #12 — `feat(seed): multi-market + 30-days-history scenarios`

- `supabase/functions/_shared/seed-core.ts` + `tools/seed-dev-data.ts` 增加：
  - `portfolios:multi-market-full`: 单 portfolio 含 US (AAPL/NVDA) + CN (600519/000001) + HK (00700) + FUND (510300) + CRYPTO (BTC/ETH) + CASH:USD/CNY 各 ≥1 持仓
  - `portfolios:30-days-history`: 上面基础上 + 30 天 `portfolio_value_snapshots` 历史数据点（为 area-chart UAT）
- DEV 面板挂载

#### commit #13 — `docs(spec+adr+session-state)`

- spec status 已 Accepted；本 commit 仅 bump session-state Block C progress 表 → 全 ✅
- ADR 011 §决策三 已在 commit #4 同步改
- session-state next step：Block D `twr-stage-3.md`（Opus 主场）

## 路线图边界（不要超出本 Block C 范围）

- **不要**改 `transactions` / `assets` / `portfolios` schema（除 commit #1 RLS migration）
- **不要**实施 Block D 算法（TWR / Performance Attribution / Drawdown）
- **不要**碰 Inbox / AI 占位 / 订阅 / 数字脱敏 / 价格异动（Block E）
- **不要**做 CSV 导入导出（Block F2）
- **不要**实施跨组合再平衡（Stage 4 PRO 占位卡已在 Block B 落地）
- **不要**碰 Block A adapters (Tushare/AKShare/CoinGecko/Finnhub) — 已稳定
- **不要**实施 `bar-chart` / `chart-indicator`（Block D / Stage 4）

## 路由自评估（每个 commit 边界做一次，按 §十二）

- commit #1 (migration) → Sonnet 直白
- commit #2 (charts wrapper) → Sonnet；**HeroUI Pro chart subpath import 在 RN web Metro 解析失败是已知风险**（spec §Risks 第一项）；若多次改不对，按 §十二 升 Opus
- commit #3 (UI components extract) → Sonnet 套路 UI
- commit #4 (withFallback classifier) → Sonnet 但 invariant 简单；如 ADR 011 §决策三 表格更新逻辑反复改 → 升 Opus
- commit #5 (AKShare wrapper Python) → Sonnet 但模块级 `_DF_CACHE` 24h TTL 实现要小心（用闭包或 dict + timestamp tuple）
- commit #6 (AKShare client + per-market wire) → Sonnet
- commit #7 (4 hooks) → Sonnet；rangeToWindow 边界 case (YTD = Jan 1 of CURRENT year) 容易出错，跑 test 验证
- commit #8 (AsyncStorage store) → Sonnet 套路
- commit #9 (asset detail page) → Sonnet UI
- commit #10 (Portfolio Tab integrate) → Sonnet；HoldingsTable + PortfolioValueOverTimeCard 视觉布局可能要反复调，但不阻塞 Block D
- commit #11 (tx entry rewrite) → Sonnet；state machine + URL query prefill 是非平凡逻辑，**Opus post-batch review**
- commit #12 (seed) → Haiku 套路；30 天历史数据用 `Math.random()` 在合理 range 生成（10-15% 日波动是常见）
- commit #13 (docs) → Haiku

## Hand-off 回 Opus 的触发点

- commit #2 完成 → Opus review HeroUI Pro chart wrapper 是否单 ADR
- commit #4 完成 → Opus review ADR 011 §决策三 表格更新 + with-fallback.spec.ts 新 case
- commit #11 完成 → Opus review tx entry state machine + URL prefill + ensureAsset 逻辑
- 其余 commits 可 batch 完后整体 review（与 Block B 同模式）

## DoD（本 Block C 结束 = 真闭环可以跑 Stage 3 自用 4 周）

- commits #1-13 全部 merged 进 `dev/stage-3`
- Migration 0013 用户已在 dev Supabase 跑通
- AKShare wrapper Vercel prod 包含 `/api/search` endpoint
- UAT pass:
  - 录入 US/CN/HK/FUND/CRYPTO 5 个市场各 ≥1 个持仓 ✅
  - 持仓表多市场分组 + 双币种正确 ✅
  - tap 持仓行 → asset 详情页 + 时间段切换 + 历史曲线 ✅
  - Portfolio Tab 累计净值 area-chart ✅
  - CN search 走 AKShare wrapper（验证 NotImpl → fallback 路径）✅
  - tx entry CRYPTO BUY → ensureAsset 自动 ✅
- `pnpm typecheck` 6/6 ✅ / `pnpm lint` 6/6 ✅ / `pnpm test` ✅
- `session-state.md` Block C 表格全部 ✅
- **下一站 = Block D `twr-stage-3.md` Opus 起草**

## 当前已知 Active blockers

- Migration 0013 用户需在 Supabase SQL Editor 执行（commit #1 后）
- AKShare wrapper 需 redeploy（commit #5 后；用户 `vercel --prod`）
- Block B UAT 5 sessions（用户跑 / 不阻塞 Block C 起步；Block C UAT 时若 portfolios CRUD 有 bug 影响测试可回头 fix）

开始吧。先 `git status` 看是否有遗留改动；再 `ls packages/db/drizzle/migrations/` 确认是否已有 0012 commit（决定本 spec 用 0012 还是 0013，**默认 0013**）；再起 commit #1 实施计划让我（用户）拍板。

````

---

## 用户使用说明

1. **打开 Cursor**，新建 Composer / Chat 会话
2. **粘贴上面 ` ``` ` 框内的全部内容**
3. Cursor 第一步会输出 commit #1 实施计划 → 你拍板（"OK" 或纠正）→ 写代码
4. 4 个 phase 中间不强制 ping Opus，**3 个关键 review 点**：commit #2 / #4 / #11 完成后告诉 Cursor "提交后 ping Opus"
5. 全部 13 commits 完成 → Opus 整体 review + Block D handoff

## 三人分工速查（Block C）

| 角色            | 当前任务                                                                                                       |
| :-------------- | :------------------------------------------------------------------------------------------------------------- |
| **你 (BoyangJiao)** | (1) 跑 Block B UAT 收尾；(2) commit #1 后 Supabase SQL Editor 跑 migration 0013；(3) commit #5 后 `vercel --prod` AKShare wrapper redeploy；(4) commit #2/#4/#11 完成时切回 Claude Code 让 Opus review |
| **Cursor (Sonnet)** | 13 commits 顺序实施；遇 §十二 升级信号主动告知                                                                  |
| **Claude (Opus, 本会话)** | (1) commit #2 charts wrapper review；(2) commit #4 classifier + ADR 011 review；(3) commit #11 tx entry review；(4) Block C 收尾后起 Block D specs（TWR + Performance Attribution + Drawdown） |
````
