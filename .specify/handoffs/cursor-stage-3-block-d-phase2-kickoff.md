# Cursor 启动 prompt — Stage 3 Block D Phase 2：TWR hooks + UI 挂数字

> 复制下方代码块到 Cursor Composer / Chat。该 prompt 不指定模型 —— Cursor auto 按 `CLAUDE.md §七 + §十二` 自评估（提示：2 commits 全部 Sonnet 套路 hooks + UI 挂数字；若 commit #5 `valueAt` day-rounding 边界反复改不对 → §十二 升 Opus）。
>
> **前置依赖（已就绪）**：
>
> - Block A/B/C UAT ✅
> - Block D Phase 1 ✅ landed (`1da6437` → `d467b6e`，4 commits)，149/149 tests
> - TWR spec Accepted（14 决策 + Phase 2 实施 hint 已写入 §Implementation plan §Phase 2）
> - Polish backlog 建立（`.specify/polish-backlog.md`），UI 微调项记录但不在 Phase 2 范围
> - ADR 012 已接受（不影响本 Phase）

---

````
接力 Arc Stage 3 Block D Phase 2 —— TWR hooks + UI 挂数字 commit 链（2 commits）。

## 必读（按此顺序，不要跳）

1. CLAUDE.md — §三 工程铁律 + §七 模型分工 + §十二 路由
2. .specify/constitution.md — P0 约束（Decimal everywhere / Immutability / Adapter 抽象边界）
3. .specify/session-state.md — Stage 3 Block D Phase 2 进度
4. .specify/feature-specs/stage-3/twr-stage-3.md — 本任务契约（14 决策 + Phase 2 实施 hint）
5. .specify/polish-backlog.md — UI 微调 backlog（确认本 Phase 不踩 backlog item；不要顺手 polish backlog 里的东西）

## Code context bundle（Repomix — 冷启动推荐）

```bash
pnpm ctx:feature twr
# → .specify/codectx/twr.xml（gitignored；attach 到 chat 或 pnpm ctx:feature twr --stdout | pbcopy）
```

Spec = intent；Repomix = 相关代码全文。两者互补，不互相替代。Config：`.specify/feature-specs/stage-3/twr.repomix.json`

## Phase 1 落地状态（不要重做）

- packages/core/src/returns/{cash-flow.ts, twr.ts, xirr.ts, types.ts, errors.ts, index.ts} 都已存在
- 接口：computePortfolioTwr({portfolioId, reportingCurrency, from, to, transactions, valueAt}) → TwrResult
- 接口：computeAssetTwr({assetId, portfolioId, from, to, transactions, priceAt}) → TwrResult
- 接口：computeMwr(cashFlows, options?) → MwrResult；ConvergenceError extends Error
- 21 个 property test + 23 个 unit test 全绿

## 任务 — TWR spec § Implementation plan Phase 2 共 2 个 commit

按顺序执行。每个 commit 末尾跑 `pnpm typecheck && pnpm lint && pnpm test`（全 6/6 + 绿）。

### commit #5 — `feat(mobile): use-asset-twr + use-portfolio-twr` 【⚠️ 关键边界看下方 hint】

- 新建 apps/mobile/src/lib/queries/use-asset-twr.ts
  - 输入 `{ portfolioId, assetId, range: TimeRange }`
  - 内部：`rangeToWindow(range)` → {from, to}（复用 apps/mobile/src/lib/time-range.ts，Block C 已有）
  - 内部：`useTransactions(portfolioId)` 拉 transactions（已有 hook）
  - 内部：`priceAt(date)` 闭包从 Block C 已有 historical price cache 取（asset 详情页已有 useHistoricalQuotes，extract priceAt 逻辑或 inline 同步查 priceCache）
  - 调 `computeAssetTwr({assetId, portfolioId, from, to, transactions, priceAt})` → 返回 `TwrResult`
  - useQuery key `["twr-asset", portfolioId, assetId, range]`
  - `staleTime: 5 * 60 * 1000`（与 price cache TTL 一致）

- 新建 apps/mobile/src/lib/queries/use-portfolio-twr.ts
  - 输入 `{ portfolioId, range: TimeRange }`
  - 内部：`reportingCurrency` 从 usePortfolio 拿
  - 内部：`valueAt(date)` 闭包优先读 portfolio_value_snapshots 表，缺日 fallback `computeValuationAtDate`（Block C 已有）
  - 调 `computePortfolioTwr(...)` → 返回 `TwrResult`
  - useQuery key `["twr-portfolio", portfolioId, range]`

⚠️ **关键边界 — day-rounding（TWR spec §Implementation plan §Phase 2 hint）**：

Phase 1 `cash-flow.ts` 用真实 tradeDate timestamp 作 boundary（tx entry 写入 `T12:00:00Z`，spec §决策 8）。`portfolio_value_snapshots` 写入时间 `T23:00:00Z`（per ADR 009）。两者**不直接对齐**。

**`valueAt(date)` / `priceAt(date)` hook 必须做 day-rounding**：

```ts
const priceAt = (t: Date): Decimal => {
  const dayKey = t.toISOString().slice(0, 10); // YYYY-MM-DD
  const snapshot = priceSnapshots.find(s => s.asOf.slice(0, 10) === dayKey);
  if (!snapshot) {
    // 前向填充：找 dayKey 之前最近的 snapshot（决策 12 fallback）
    const prior = priceSnapshots
      .filter(s => s.asOf.slice(0, 10) < dayKey)
      .sort((a, b) => b.asOf.localeCompare(a.asOf))[0];
    if (!prior) throw new Error(`no historical price for ${assetId} on ${dayKey}`);
    return new Decimal(prior.price);
  }
  return new Decimal(snapshot.price);
};
````

`valueAt` 同模式，但读 `portfolio_value_snapshots` 表 + 缺日 fallback `computeValuationAtDate(portfolio_id, dayKey)`（Block C 已有 helper）。

**单测要点**：mock `valueAt` 接收 3 种 timestamp（`T12:00:00Z` / `T23:00:00Z` / `T00:00:00Z`）→ 都返回同一 EOD value。

**不要**用 timestamp `>=` `<=` 直接比 snapshot.snapshot_date —— 12:00 UTC vs 23:00 UTC 会落错 sub-period。

### commit #6 — `feat(ui+mobile): TwrInlineLabel + 3 处 UI 接入`

- 新建 packages/ui/src/finance/TwrInlineLabel.tsx
  - props `{ result: TwrResult | undefined, range: TimeRange, loading?: boolean }`
  - 显示：`{rangeLabel} TWR：{±X.XX%}`（gain/loss 色via `useBusinessClasses`）
  - 错误处理：loading=true → skeleton；result=undefined（hook throwed ConvergenceError）→ 显示 "—"（**不**让 NaN 透到 UI；spec §S3-AC-D.1.8）
  - 旁边可选 ⓘ tooltip → tap 弹 sheet "时间加权收益率（剔除入金时点影响）"（i18n 字符串）

- 修改 apps/mobile/app/asset/[market]/[symbol].tsx
  - 在"我的持仓"区底部加 `<TwrInlineLabel result={twr.data} range={range} loading={twr.isLoading} />`
  - 共用 detail page 已有 segmented control 的 range state

- 修改 apps/mobile/app/(tabs)/index.tsx（Portfolio Tab）
  - PortfolioValueOverTimeCard 头部右侧加 TwrInlineLabel；range state 与 area-chart 时段联动

- 修改 apps/mobile/src/components/PortfolioInsightCard.tsx
  - 在偏离 % 旁边加一行 TwrInlineLabel，range 默认 "1M"（与决策 10 一致）

- 新增 i18n strings (packages/i18n/src/locales/{en,zh}.ts) ~6 条：
  - `twr.label`: "TWR" / "时间加权收益率"
  - `twr.tooltip`: "Time-weighted return (excludes funding timing impact)" / "剔除入金时点影响"
  - `twr.unavailable`: "—" (statically "—" no translation but reserve key)
  - `range.{1D,1W,1M,3M,YTD,1Y,ALL}` (复用 Block C 已有)

## 路线图边界（不要超出本 Phase 范围）

- **不要**改 Phase 1 的 `returns/*.ts`（算法已稳定 149/149）
- **不要**实施 Performance Attribution 或 Drawdown spec（Block D Phase 3 = 雪球对标；PA/Drawdown 是独立 spec 后续起）
- **不要**改 Block C UI flow / layout（polish backlog 里 F1 的事）
- **不要**修 polish backlog 里 Block E/F 桶的任何 item —— **逐项见 `.specify/polish-backlog.md`**
- **不要**碰 ADR 012 / Auth / portfolio CRUD

## 路由自评估（每个 commit 边界做一次，按 §十二）

- commit #5 `valueAt` day-rounding 如果反复改不对（特别是前向填充 + 缺日 fallback edge）→ §十二 升 Opus
- commit #5 其余路径 / commit #6 全部 → Sonnet 套路 hook + UI

## Hand-off 回 Opus 的触发点

- 完成 commit #5 → ping Opus review（关键：`valueAt` day-rounding 是否正确处理 12:00 UTC vs 23:00 UTC）
- 完成 commit #6 → ping Opus + 用户协作进 Phase 3（雪球对标，3 个真实标的，spec §决策 14）

## DoD（本 Phase 结束 = TWR 数字落地 3 处 UI）

- commit #5 + #6 merged 进 `dev/stage-3`
- `pnpm typecheck` 6/6 ✅ / `pnpm test` 全绿（不引入新 property tests，但 hook 单测覆盖 day-rounding + Loading + ConvergenceError 三个状态）
- 真实 UAT：用户 Block C 已录入 5 市场 + 历史交易 → 进 Asset Detail / Portfolio Tab / Insights → 3 处都能看到 TWR 数字
- ConvergenceError 路径：录入极端 cash flow（如某 portfolio 单日全部 SELL CASH 清空）→ MWR 失败 → UI 显示 "—"，**不**白屏 / **不** NaN

完成后 ping Opus → Phase 3 雪球对标（用户准备 3 个标的，建议 1 CN + 1 US + 1 ETF/FUND；Arc 录入相同 transactions → 跑 TWR → 误差 ≤ 1.0% per 标的，截图存档 `docs/dod-verification/`）。

## 当前已知 Active blockers

- 无（Phase 1 已 landed，Block C UAT ✅，无外部依赖）

开始吧：先 `git status` 看 working tree；如果干净，起 commit #5 实施计划（特别是 `valueAt` 闭包代码 + day-rounding helper）让我（用户）拍板。

````

---

## 用户使用说明

1. **打开 Cursor**，新建 Composer / Chat 会话
2. **粘贴上面 ` ``` ` 框内的全部内容**
3. Cursor 第一步输出 commit #5 实施计划 + day-rounding 处理代码片段 → 你拍板（特别看 `valueAt` 是否做了 day-rounding）→ 写代码
4. commit #5 推完 → 切回 Claude Code 让 Opus review（day-rounding 是关键 review 点）
5. commit #6 推完 → ping Opus + 准备进 Phase 3 雪球对标

## 三人分工速查（Block D Phase 2）

| 角色            | 当前任务                                                                                              |
| :-------------- | :---------------------------------------------------------------------------------------------------- |
| **你 (BoyangJiao)** | (1) 准备雪球 3 标的真实持仓（≥ 6 月历史，建议 1 CN + 1 US + 1 ETF/FUND）；(2) commit #5 review；(3) Phase 3 雪球对标用户协作 |
| **Cursor (Sonnet)** | commit #5 (hooks + day-rounding) → commit #6 (TwrInlineLabel + 3 处 UI 接入)                          |
| **Claude (Opus, 后续会话)** | (1) commit #5 day-rounding review；(2) commit #6 review；(3) Phase 3 雪球对标算法侧；(4) Block D 收尾后起 Performance Attribution + Drawdown spec Phase 1 |
````
