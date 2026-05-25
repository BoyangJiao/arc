# Feature: Performance Attribution (per-asset contribution to portfolio return) — Stage 3 Block D

- **Status**: Accepted — 9 resolved decisions (6 architecture + 3 UX locked 2026-05-24 BoyangJiao approved A/A/A)
- **Author**: Claude Opus 4.7 (draft) — review/accept pending
- **Created**: 2026-05-24
- **Implements**: `.specify/feature-specs/stage-3/stage-3-roadmap.md` §Block D 第二项
- **Conforms to**: `.specify/constitution.md` (Decimal everywhere), ADR 006 (`@arc/ui` layering)
- **Touches**: `packages/core/returns/` (扩展 + ~10 property tests), `packages/ui/finance` (1 new bar chart + list card), `apps/mobile` (Insights Tab 新增 PA card)
- **Depends on**: `twr-stage-3.md` Accepted（PA 复用 TWR sub-period 收益）；Block C real holdings ready

---

## Why this feature exists

TWR 告诉用户"我整体收益 12.34%"。PA 告诉用户"**为什么**是 12.34% — 哪些资产拉高了，哪些拖累了"。

参考 Delta app `投资组合表现 [PRO+]` card：横向 bar chart 每条 = 一个 asset 的贡献百分点（正贡献绿 / 负贡献红，按贡献绝对值排序）。这是自用阶段最重要的"复盘"工具 —— Stage 3 自用 4 周后用户回看哪些决策对、哪些错。

---

## User journey (J16)

### J16a — Insights Tab 新增 "贡献分析" 卡

**Given** Insights Tab 已有 per-portfolio rebalance summary cards（Block B）
**When** 选某张 portfolio card → tap "贡献分析 →"
**Then** 进入 `/insights/attribution/[portfolioId]` 详情页
**And** 顶部时间段 segmented control（1M / 3M / YTD / 1Y / ALL；与 TWR 时段一致）
**And** 中部水平 bar chart：每条 = 一个 asset；x 轴为 "对组合收益的贡献 %"；正绿 / 负红；按 |contribution| 降序
**And** 底部 list："Top 3 贡献者" + "Top 3 拖累者" + 各显 asset name + symbol + contribution % + asset's own TWR
**And** 重对总和："累计贡献 +X.XX% / 组合 TWR +Y.YY%（差 <0.5% = ✅，差 ≥0.5% = ⓘ 显示对账提示）"

---

## Resolved decisions

### 1. 算法 = Brinson 简化（仅 asset-level contribution，无 sector / allocation 分层）

```
contribution_i = average_weight_i × return_i

where:
  average_weight_i = mean of (asset_i_value / portfolio_total_value) over sub-periods
  return_i = computeAssetTwr(asset_i, from, to)  ← 复用 TWR spec §6 asset-level

portfolio_return ≈ Σ contribution_i + reconciliation_error
```

reconciliation_error 来自 cross-product terms（cash flow + 时间分布交互）。Stage 3 简化版预期 < 0.5%；若 > 0.5% UI 显示 ⓘ 提示。

### 2. Weight = avg-of-daily

`average_weight_i = (1/N) × Σ_{d=from}^{to} (asset_i_value_at_d / portfolio_value_at_d)`

N = 时段天数。`asset_i_value_at_d` 用 Block C `priceAt(d) × shares_at_d`；`portfolio_value_at_d` 用 TWR spec §3 同源数据。

性能：N 天 × M assets = O(N×M) Decimal 操作；100 天 × 20 assets = 2000 次乘除 ≈ 50ms ok。

### 3. CASH:\* 显示在 list（contribution = 0%）

CASH 持仓 contribution 实际为 0（CASH 价格 = 1，return = 0）；但占组合权重应显示，让用户知道"哪些钱没工作"。bar chart 不画 0 行；list 末尾单独一段"现金部分 X% 权重 / 0% contribution"。

### 4. Reconciliation 误差显示

若 `|Σ contributions - portfolio_TWR| < 0.5%` → 静默隐藏（视为算法精度足够）
若 ≥ 0.5% → UI 显示 ⓘ "对账提示：累计 vs 组合 TWR 差 X.XX%，可能由跨子区间复合误差产生"

> 这是诚实路径 —— 不掩盖真实计算限制；用户看到 ⓘ 知道这是 Stage 3 简化算法，Stage 4 可升 True Brinson 两层分解。

### 5. Top N = 默认 3，可展开看全部

bar chart 默认显示 top 8 by `|contribution|`（避免 50 资产组合 bar 挤）；list "Top 3 贡献者 / 拖累者"；末尾 "查看全部 N 条贡献 →" 链接展开。

### 6. UI 接入位置 = Insights Tab + 独立路由

Insights Tab 每张 portfolio card 加 "贡献分析 →" CTA → 跳 `/insights/attribution/[portfolioId]`。不在 Insights Tab 内联渲染（避免 Insights Tab 信息过载）。

---

## Locked 2026-05-24 (BoyangJiao approved A/A/A)

### 决策 7 — bar chart 底层 = HeroUI Pro `bar-chart`（A）

复用 Block C `@arc/ui/charts/` wrapper 层；新增 `BarChart.tsx` 同模式 subpath import。不自绘 SVG。

### 决策 8 — 时段切换不持久化（A）

每次进 `/insights/attribution/[portfolioId]` 默认 1Y（与 TWR 决策 10 不持久化策略一致）。

### 决策 9 — CASH:\* 不合并显示（A）

CASH:USD / CASH:CNY / CASH:HKD 各显一行；让用户看清不同币种现金占比。

<!-- 原 Open questions 3 条已 locked 全 A，决策 7-9 above；详细 trade-off 参考下方 history -->

## Open questions (locked above, kept for history)

1. **bar chart 底层 = HeroUI Pro `bar-chart` vs `react-native-svg` 自绘**
   - **(A) HeroUI Pro `bar-chart`（推荐）** — Block C 已引 HeroUI Pro chart wrapper layer (`@arc/ui/charts/`)，加 BarChart 同模式
   - (B) 自绘 — 控制力强但偏离决策 6（chart 走 Pro）
   - **推荐 A**

2. **时段切换持久化**
   - **(A) 不持久化（推荐）** — 每次进页面回到默认 1Y（与 TWR 决策 10 一致）
   - (B) 全局持久化 — 复杂度高
   - **推荐 A**

3. **跨币种 CASH:\* 是否合并**
   - **(A) 不合并（推荐）** — CASH:USD / CASH:CNY / CASH:HKD 各显一行，让用户看清不同币种现金占比
   - (B) 合并显示 "现金总占比 X%" — 简洁但信息丢失
   - **推荐 A**

**Recommendation 组合**: A/A/A

---

## Data model

零变更。复用 transactions + price_snapshots + portfolio_value_snapshots + assets。

### `@arc/core` 新增

```ts
// packages/core/src/returns/attribution.ts
export interface AssetContribution {
  readonly assetId: string;
  readonly assetName: string;
  readonly averageWeight: Decimal;     // 0-1
  readonly assetReturn: Decimal;       // TWR for asset
  readonly contribution: Decimal;      // averageWeight × assetReturn
}

export interface AttributionResult {
  readonly contributions: ReadonlyArray<AssetContribution>;  // sorted desc by |contribution|
  readonly portfolioTwr: Decimal;
  readonly sumContributions: Decimal;
  readonly reconciliationError: Decimal;  // sumContributions - portfolioTwr
  readonly subPeriods: number;
}

export const computeAttribution = (input: {
  portfolioId: string;
  from: Date;
  to: Date;
  transactions: ReadonlyArray<Transaction>;
  assets: ReadonlyArray<Asset>;
  priceAt: (assetId: string, date: Date) => Decimal;
  fxAt: (from: Currency, to: Currency, date: Date) => Decimal;
  reportingCurrency: Currency;
}): AttributionResult => { ... };
```

---

## Architecture

```
packages/core/src/returns/
└── attribution.ts                ← computeAttribution + 内部 helpers

packages/core/__tests__/
├── attribution.spec.ts           ← unit tests (~6)
└── attribution.property.spec.ts  ← property tests (~10)

apps/mobile/
├── app/insights/attribution/[portfolioId].tsx  ← 详情页
└── src/lib/queries/use-attribution.ts          ← TanStack hook

packages/ui/src/
├── charts/BarChart.tsx           ← HeroUI Pro bar-chart wrapper（新加）
└── finance/AttributionList.tsx   ← Top contributors / detractors list

apps/mobile/src/components/PortfolioInsightCard.tsx  ← 加 "贡献分析 →" CTA

packages/i18n/src/locales/{en,zh}.ts  ← ~8 strings
```

---

## Acceptance criteria (S3-AC-D.2.x)

### S3-AC-D.2.1 — 单一持仓 portfolio：贡献 = 该 asset 的 TWR

**Given** Portfolio 只持有 100% NVDA（无 cash，无其他 asset）
**When** 求 YTD attribution
**Then** `contributions.length === 1`
**And** `contributions[0].contribution === portfolioTwr`（误差 < 1e-9）

### S3-AC-D.2.2 — 双持仓 50/50：贡献和 ≈ portfolio TWR

**Given** 期初 50/50 NVDA/AAPL，期间无 cash flow
**When** 求 YTD attribution
**Then** `Σ contributions === sumContributions`
**And** `|sumContributions - portfolioTwr| < 0.5%`（reconciliationError）

### S3-AC-D.2.3 — Cash 不进 bar chart

**Given** 50/50 NVDA + CASH:USD
**When** 求 attribution
**Then** `contributions` 含 CASH:USD 行（average_weight ≈ 0.5, contribution ≈ 0）
**And** UI bar chart 不绘 CASH 行；list 末尾段落显示

### S3-AC-D.2.4 — 排序 by |contribution|

**Given** 5 资产 contributions = [+5%, -3%, +1%, -4%, +0.2%]
**Then** sorted: [+5%, -4%, -3%, +1%, +0.2%]（按绝对值降序）

### S3-AC-D.2.5 — Reconciliation 提示触发

**Given** 因跨币种 + 频繁 cash flow 导致 sumContributions - portfolioTwr = 0.6%
**Then** UI 显示 ⓘ 提示 "对账差 0.6%"
**Given** 差 = 0.3%
**Then** ⓘ 不显示

### S3-AC-D.2.6 — 跨币种 portfolio attribution

**Given** Portfolio (CNY) 持 NVDA (USD) + 600519 (CNY)
**When** 求 attribution
**Then** NVDA contribution 内部用历史 fx_rates 换算到 CNY 后计算 weight
**And** 600519 contribution 直接 CNY 不换算

---

## Property tests (~10)

| 类别                | 数量 | 覆盖                                                           |
| :------------------ | :--- | :------------------------------------------------------------- |
| 单资产恒等          | 2    | 100% 单资产 → contribution = portfolio TWR / 100% CASH → 0%    |
| 排序不变            | 2    | sorted desc by abs(contribution) / sorted is stable            |
| Reconciliation 边界 | 2    | 无 cash flow → error < 0.1% / 多 cash flow → error 可能 < 0.5% |
| Decimal 边界        | 2    | 极小 weight (1e-10) 不溢出 / 大 weight (0.999) 计算稳定        |
| 跨币种              | 2    | reporting=CNY 持 USD 资产 / fx_rates 缺日前向填充              |

---

## UI contract

```
/insights/attribution/[portfolioId]
┌─────────────────────────────────────────────────┐
│ ← 贡献分析 — 美股账户                              │
│ [ 1M | 3M | YTD ▼ | 1Y | ALL ]                  │
│                                                 │
│ 组合 YTD TWR：+12.34%                            │
│                                                 │
│  NVDA      ████████████ +6.20%                  │
│  AAPL      ████ +2.10%                          │
│  600519   █ +0.80%                              │
│  HOOD     ▌-1.10%                                │
│  TSLA     ███ -3.40%                             │
│                                                 │
│ 累计贡献 +12.10% / 组合 TWR +12.34%（差 0.24% ✅）  │
│                                                 │
│ ── Top 3 贡献者 ──                                │
│ NVDA  Nvidia        权重 28%  收益 +22.1%  +6.20% │
│ AAPL  Apple         权重 21%  收益 +10.0%  +2.10% │
│ 600519 贵州茅台      权重 15%  收益 +5.3%   +0.80% │
│                                                 │
│ ── Top 3 拖累者 ──                                │
│ TSLA  Tesla         权重 12%  收益 -28.3%  -3.40% │
│ HOOD  Robinhood     权重 8%   收益 -13.7%  -1.10% │
│ ...                                             │
│                                                 │
│ 现金部分 16% 权重 / 0% 贡献                       │
│                                                 │
│ ⓘ 计算基于 TWR sub-period 复合；不构成投资建议      │
└─────────────────────────────────────────────────┘
```

---

## Implementation plan

> Routing: Opus（算法 + property tests）/ Sonnet（UI）
> 估时：~5-7h Opus + 3-4h Sonnet = **~10h**

1. **`feat(core): returns/attribution.ts + types`** — `computeAttribution` + Brinson 简化算法 — Opus
2. **`test(core): attribution.property.spec.ts ≥ 10 tests`** — Opus
3. **`feat(ui): @arc/ui/charts/BarChart wrapper`** — HeroUI Pro bar-chart 接入（新增 chart wrapper）— Sonnet
4. **`feat(ui+mobile): AttributionList + /insights/attribution/[portfolioId] page`** — Sonnet
5. **`feat(mobile): use-attribution hook + PortfolioInsightCard CTA`** — Sonnet
6. **`docs(spec+session-state)`** — Block D 2/3 complete

---

## Risks

| Risk                                    | Likelihood | Impact                       | Mitigation                                                 |
| :-------------------------------------- | :--------- | :--------------------------- | :--------------------------------------------------------- |
| Reconciliation error > 0.5% 经常发生    | Med        | UI 频繁显示 ⓘ → 用户失去信心 | property test 验证常见场景 < 0.5%；若发现 hotspot 升级算法 |
| HeroUI Pro `bar-chart` 与水平方向不兼容 | Med        | bar chart 不能水平           | spec read 时确认 props；不行 fallback 自绘（spec §Q1 = B） |
| 大量资产（50+）UI 卡顿                  | Low        | bar chart 渲染慢             | top 8 default + "查看全部" 懒加载                          |

---

## Hand-off

- **Implementation owner**: Opus 算法 + property tests / Sonnet UI
- **Depends on**: TWR spec Accepted（复用 `computeAssetTwr`）

---

Next: `drawdown-stage-3.md`

---

## Context bundle

Auto: `pnpm ctx:auto` (agent/hook). Config: `.specify/feature-specs/stage-3/performance-attribution.repomix.json`
