# Feature: 盈亏分析 (Insights Tab P&L module — period MWR + cumulative cost-basis + ranking) — Stage 3 follow-up

- **Status**: Draft — Opus 4.7 (2026-05-30); awaiting BoyangJiao review
- **Author**: Claude Opus 4.7 (draft)
- **Created**: 2026-05-30
- **Implements**: [ADR 016 §决策 7](../../../docs/adr/016-holdings-return-and-entry-tiers.md)（Insights/盈亏分析模块）
- **Conforms to**: `.specify/constitution.md` (Decimal everywhere; Law 5 历史 ≠ 当下), ADR 013 (UI wrapper layers), ADR 014 (True Historical chart)
- **Touches**:
  - `packages/core/returns/` (~1 new file: `period-pnl.ts` + ~6 property tests; reuses `xirr.ts`, `twr.ts`)
  - `packages/ui/finance/` (~3 new L2/L3 components: `PnlPeriodCard`, `PnlCumulativeCard`, `PnlRankingCard` + 1 chart variant)
  - `apps/mobile` (~1 new route `insights/pnl-analysis.tsx` + 2 query hooks)
  - `packages/i18n` (~25 new keys under `insights.pnl.*`)
- **Depends on**:
  - `usePortfolioHoldings` + `usePortfolioValuation` (existing)
  - `usePortfolioValueSnapshots` (Stage 2 Block C)
  - `computeMwr` / XIRR (Block D Phase 1, `@arc/core/returns/xirr.ts`)
  - `computePortfolioTwr` (Block D Phase 1, optional secondary metric)
  - Hero「本期市值变化」chip 跳转入口（ADR 016 §决策 1，目前为 UI polish 待做）

---

## Why this feature exists

ADR 016 v2 锁定了 Portfolio Tab Hero = 「balance 视图」（True Historical 含现金、含资金流），持仓行 = cost-basis 固定。**Hero 不展示"投资回报"**，因为 balance 变化跟回报是两件事（参考 Delta scrub 翻车 + IBKR 价值/业绩 tab 分离 + 钱往独立盈亏分析 page）。

结果：用户想看「我这个月赚了多少 / 收益率多少 / 哪个标的赚最多 / 哪个亏最多 / 已实现盈亏」**没有入口**。本 feature 填这个空，独立到 Insights Tab。

**目标用户场景**：

- "我今年（YTD）跑赢/输大盘多少？" → 时段 cost-basis 回报率曲线
- "我这个月赚了/亏了多少钱？" → 时段市值变化（含资金流）
- "我累计投入了多少？现在赚了多少？" → 累计盈亏（固定，跟持仓行 sum 闭环）
- "哪 5 个标的赚最多？哪 5 个最拖后腿？" → 盈亏排行
- "我已经卖出过哪些资产实现了多少盈亏？" → 已实现盈亏（period）

参考品：

- **IBKR**: 价值/业绩 tab 分离；业绩 = TWR % 曲线起点 0%
- **钱往**: 独立"盈亏分析"page；时段市值变化 + 现金加权收益率 + 累计盈亏 + 排行
- **支付宝**: 持有收益 / 持有收益率（cost-basis since-open，跟我们持仓行算法一致）
- **雪球**: 时段收益率 + 累计收益曲线

---

## User journey (J18)

### J18a — 入口

**Given** Portfolio Tab Hero 显示「本期市值变化 +¥X (+Y%)」
**When** 用户 tap 这个 chip（或 Insights Tab 列表里 tap「盈亏分析」卡片）
**Then** 跳转到 `/insights/pnl-analysis`
**And** time range 跟 Hero 当前选中的 range 同步（chip 路径），或默认 3M（Insights Tab 列表路径，与全局 `DEFAULT_TIME_RANGE` 一致）

### J18b — 时段盈亏卡

**Given** 盈亏分析详情页打开，time range = 3M
**Then** 顶部「时段盈亏」卡显示：

- 大字「3 个月资产市值变化 +¥33,705.53」（= 期末市值 − 期初市值 − 净流入；含现金流，对齐钱往 §"市值变化 = 期末资产 - 期初资产 - 净流入金额"）
- 小字「2026-02-27 ~ 2026-05-27」
- chart：累计回报率 % 曲线（起点 0%，cost-basis 累计回报）
- 「收益率(现金加权 MWR)：+41.70%」
- 「年收益率估算：+167.25%」（MWR 年化）
- 「已实现盈亏：¥0」（period 内 SELL 触发的 realized PnL 合计）
- ⓘ tooltip 解释 MWR 算法 + 不考虑注资 / 取款

### J18c — 累计盈亏卡

**Then** 第二个卡显示（**不随时间范围变化**）：

- 「持有收益 +¥55,160.22 / +47.57%」（= holdings rows delta 总和 = totalValue − totalCostBasis + Σ dividends；ADR 016 v3 v3 持有收益语义）
- 「总投入 ¥119,288.26」（= totalCostBasis 总和）
- 「现持市值 ¥176,036.44」（= totalValue 总和）
- 与 Portfolio Tab 持仓行 sum **数学完全闭环**（AC.1.1）

### J18d — 盈亏排行卡

**Then** 第三个卡显示（随时间范围）：

- tab 切换「盈利 Top5」/「亏损 Top5」
- 每行：资产名 + 时段贡献金额 + 时段贡献率
- tap 单行跳到 Asset Detail
- empty state：「本期无盈亏数据」（首日 (C) 用户场景）

### J18e — 时间范围切换

**Given** 用户切到 YTD
**Then** 时段盈亏卡 + 排行卡数据全部刷新，累计盈亏卡保持不变（**AC.2 时间范围作用域**与 ADR 016 §决策 3 一致）

---

## Resolved decisions

### 决策 1 — 三种核心算法分工

| 指标                       | 算法                                                                                                                  | 数据源                                             |
| :------------------------- | :-------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------- |
| **时段市值变化（大字）**   | `endValue − startValue − netInflow`                                                                                   | snapshots + bootstrap（同 chart）                  |
| **累计回报率 % 曲线**      | per-day cost-basis cumulative return: `(value_d + dividends_so_far − totalInvested_so_far) / totalInvested_so_far`    | snapshots + bootstrap，per-day 重算                |
| **MWR（现金加权 / XIRR）** | `computeMwr` from `@arc/core/returns/xirr.ts`                                                                         | period 内 cash flows（含初值、末值、资金流入流出） |
| **年化收益率估算**         | MWR 直接产物（XIRR returns annualized rate）                                                                          | 同上                                               |
| **已实现盈亏（period）**   | Σ over `tx.type === 'SELL' && tx.tradeDate ∈ [from, to]` of `realizedPnL`（已在 `computeHoldings` 累计；过滤 period） | transactions                                       |
| **累计盈亏（固定）**       | `Σ holdings_row_delta` = `totalValue − totalCostBasis + totalDividends_reporting`（ADR 016 v3 持有收益语义）          | live valuation + holdings                          |
| **盈亏排行（period）**     | per-asset 时段贡献金额 = 时段末资产价值 − 时段初资产价值 − period 内该资产净流入                                      | snapshots + bootstrap per-asset + period tx filter |

### 决策 2 — MWR vs TWR 二选一：用 MWR

**选 MWR（钱往 / 支付宝 范式），不选 TWR（IBKR 范式）**。理由：

- ADR 016 v2 §决策 7 已明示「钱往 实证不区分快照 vs BUY」+ Arc 用户是 reconciliation-first
- (C) 类用户没有 cash flow events → TWR 退化为 0%（ADR 016 v1 dogfooding 验证过）
- MWR 通过 XIRR 自然处理「快照 + 后续 BUY」混合录入（每个 BUY 都是 cash flow）
- MWR 跟支付宝 / 钱往 显示口径对齐 → 对账闭环
- TWR 作为 **secondary 指标**保留在 Asset Detail（Block D Phase 2 已 wire），不进盈亏分析

**Tooltip 文案要明示**：「MWR / 现金加权 = 把你每次注资 / 取款的时点权重纳入；同样市场行情下，加仓时机不同会有不同结果。」

### 决策 3 — 累计回报率曲线算法（per-day）

```
对 chart range 内每个 sample day d：
  totalInvested_d  = Σ over (BUY ∈ tx where tradeDate ≤ d) of (shares × price + fee)
                    − Σ over (SELL ∈ tx where tradeDate ≤ d) of (shares × averageCost)
  dividends_d     = Σ over (DIVIDEND ∈ tx where tradeDate ≤ d) of (shares × dividend)
  value_d         = bootstrap / snapshot 给出的 totalValue at d
  cumReturn_d     = (value_d + dividends_d − totalInvested_d) / totalInvested_d

  // 起点强制 0%（chart Y 轴 0% 锚定）
  // 如果 d == range[0]：cumReturn_d 不一定 = 0（取决于实际数据），
  // chart 渲染时按 (cumReturn_d − cumReturn_0) 平移到 0% 锚点
```

**注意点**：

- 所有累加都是 cost-basis 语义（与持仓行算法一致）
- 含 dividends 累加（ADR 016 v3 持有收益语义）
- 跨币种 holdings 都已经 reporting-currency normalized（valuation pipeline 内部完成）
- 第一个非零 sample day 才有意义；（C）用户首日陡升允许直接以陡升后第一天为起点

### 决策 4 — 时段「市值变化」算法（含资金流）

**对齐钱往**「市值变化 = 期末资产 − 期初资产 − 净流入金额」。这是**绝对金额**，不是回报率。

```
periodValueChange = totalValue_to − totalValue_from − netInflow_period

where netInflow_period = Σ over (BUY ∈ tx where tradeDate ∈ (from, to]) of (shares × price + fee)
                       − Σ over (SELL ∈ tx where tradeDate ∈ (from, to]) of (shares × price)
                       + Σ over (DIVIDEND ∈ tx where tradeDate ∈ (from, to] && reinvested=false) of 0
                                                          ^ 现金分红视为已收，不计入 inflow
```

这数字回答用户：「我这段时间净赚了多少钱（不论我在中间是否加仓/减仓）」。

### 决策 5 — 已实现盈亏算法（period）

```
realizedPnL_period = Σ over (SELL ∈ tx where tradeDate ∈ [from, to]) of (
  shares × (sellPrice − averageCost_at_sell_time) × fxRate_at_sell_time
)
```

`averageCost_at_sell_time` = SELL 那一刻 `computeHoldings` 累加器里的 averageCost（用 BUY 加权平均）。Stage 3 `computeHoldings` 已经在 SELL case 里算这个并存到 `holding.realizedPnL` 累加器。**但 holdings.ts 是全期累加**，需要新 helper 按 period 切片。

**新 helper**（在 period-pnl.ts 内）：

```ts
export const computeRealizedPnlInPeriod = (
  transactions: readonly Transaction[],
  from: Date,
  to: Date,
  reportingCurrency: Currency,
  fxResolver: (currency: Currency, date: Date) => Decimal
): Decimal
```

历史 FX 通过 `fxResolver` 注入（避免 core 模块 I/O）。Caller 在 mobile 端用 `compute-valuation-at-date` 的 historical FX 拼装。

### 决策 6 — 盈亏排行算法

```
For each asset_id held at any point in [from, to]:
  contribution_period = perAssetValue_to − perAssetValue_from − perAssetNetInflow_period

  perAssetValue_d = snapshot 或 bootstrap 给出该资产 reporting-currency value at day d
                   (含 0 如果 asset 在 d 时未持仓)

  perAssetNetInflow_period = period 内该资产的 BUY/SELL gross amount in reporting

Rank by abs(contribution_period) DESC, split into:
  winners = top 5 where contribution > 0
  losers  = bottom 5 where contribution < 0

Each row formatting:
  asset name + symbol
  contribution amount (signed, with reporting currency)
  contribution ratio = contribution / perAssetValue_from
    (if perAssetValue_from == 0 → display "new-position" badge instead of ratio)
```

跟"持仓行 cost-basis 固定" **不冲突**：这里是 period contribution，是另一个语义维度。

### 决策 7 — 数据源 = snapshot 表为主 + bootstrap fallback

跟 Portfolio Tab chart 一致（ADR 014 + portfolio-chart-density.ts）：

- `usePortfolioValueSnapshots(portfolioId, range)` 主路径
- 不足 / 缺密度 → bootstrap True Historical（不用 projection）
- 市场 filter **暂不支持**（盈亏分析不含市场 chip；Portfolio Tab Hero 才有 chip）
- 入口 chip 透传 time range，但 market filter **不透传**（避免 multi-market 排行计算复杂度）

### 决策 8 — 路由 + 入口

| 入口                                              | 路径                                         | 已存在？                             |
| :------------------------------------------------ | :------------------------------------------- | :----------------------------------- |
| Portfolio Tab Hero 「本期市值变化」chip tap       | `/insights/pnl-analysis?range=<current>`     | chip 待 wire（ADR 016 §决策 1 备注） |
| Insights Tab 列表项「盈亏分析」                   | `/insights/pnl-analysis`（default range 3M） | 待加                                 |
| Asset Detail 不引入入口（per-asset 视图无此模块） | —                                            | —                                    |

### 决策 9 — 与 Block D Drawdown / Performance Attribution 的协作

| 模块                                                              | Insights Tab 入口                             | 是否共用 chart 组件                 |
| :---------------------------------------------------------------- | :-------------------------------------------- | :---------------------------------- |
| **盈亏分析（本 spec）**                                           | 主入口                                        | 累计回报率曲线（新 L3 组件）        |
| **Drawdown（drawdown-stage-3.md）**                               | Portfolio Tab card 角 + Insights detail sheet | underwater curve（独立 chart 变体） |
| **Performance Attribution（performance-attribution-stage-3.md）** | Insights Tab 列表项                           | 单独 page                           |

三个模块语义独立，**不互相阻塞**。共用的是 `usePortfolioValueSnapshots` + bootstrap 数据源 + period filtering helpers（如果有抽象空间）。

### 决策 10 — 不做的事（明示）

- ❌ **不显示 TWR 数字在本页面**（避免跟 MWR 双数字过载；TWR 仅 Asset Detail 出现 per ADR 016 v3）
- ❌ **不引入 market filter chip**（per 决策 7）
- ❌ **不支持 multi-portfolio aggregation**（per Portfolio Tab 当前结构；用户切 portfolio 后再看）
- ❌ **不持久化 user 选中的 time range**（每次进入按入口路径默认 3M 或继承）
- ❌ **不做累计回报率曲线的 scrub**（首版避免动画复杂度；Stage 4 polish 可加）

---

## UI contract

### Layout

```
┌─────────────────────────────────────────────────────────┐
│  ← 盈亏分析                                              │
│  [1D] [1W] [1M] [3M*] [YTD] [1Y] [全部]                  │
│                                                          │
│  ┌─ 时段盈亏（3 个月）─────────────────────────────┐    │
│  │ 3 个月资产市值变化                                │    │
│  │ +¥33,705.53                                       │    │
│  │ 2026-02-27 ~ 2026-05-27                           │    │
│  │                                                   │    │
│  │ ┌─────────────────────────────────────────────┐  │    │
│  │ │   40%                                       │  │    │
│  │ │   20% ────────────────────────╱─────        │  │    │
│  │ │    0% ───────────────────────────────       │  │    │
│  │ │       ╲     ╱─╲   ╱─╱╲                      │  │    │
│  │ │        ╲___╱   ╲_╱                          │  │    │
│  │ └─────────────────────────────────────────────┘  │    │
│  │                                                   │    │
│  │ 收益率(现金加权 MWR)             +41.70% ⓘ        │    │
│  │ 年化收益率估算                   +167.25%         │    │
│  │ 已实现盈亏                       ¥0               │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─ 累计盈亏（不随时间范围）──────────────────────┐    │
│  │   持有收益    +¥55,160.22  +47.57%               │    │
│  │   总投入      ¥119,288.26                        │    │
│  │   现持市值    ¥176,036.44                        │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─ 盈亏排行（3 个月）──────────────────────────────┐    │
│  │   [盈利 Top5] [亏损 Top5]                         │    │
│  │   ─────────────────────────                      │    │
│  │   1. 易方达科创板    +¥18,400  +35.2%             │    │
│  │   2. 华安黄金 ETF    +¥6,200   +9.5%              │    │
│  │   ...                                             │    │
│  └──────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘

⚠️ 仅供参考，可能延迟。本工具不构成投资建议。
```

### Component decomposition（ADR 013 三层模型）

| 组件                          | 层                | 归属      | 备注                                        |
| :---------------------------- | :---------------- | :-------- | :------------------------------------------ |
| `<InsightsPnlAnalysisScreen>` | apps/mobile route | mobile L3 | page-level container；time range state      |
| `<PnlPeriodCard>`             | finance/ L3       | @arc/ui   | 时段盈亏卡（大字 + chart + 指标列）         |
| `<PnlCumulativeCard>`         | finance/ L3       | @arc/ui   | 累计盈亏卡（固定指标）                      |
| `<PnlRankingCard>`            | finance/ L3       | @arc/ui   | 排行 tab + list                             |
| `<CumulativeReturnChart>`     | charts/ L3        | @arc/ui   | 累计回报率 % 曲线（Y 起 0%）；新 chart 变体 |
| `<RankingRow>`                | finance/ L2       | @arc/ui   | 单行 mover；颜色按 finance color mode       |

**新 chart 变体说明**：`CumulativeReturnChart` 跟现有 `AreaChart` 的差异是：

- Y 轴标签是 `%` 而非货币
- 强制锚定起点为 0%（视觉上）
- gradient fill 颜色按整段净 sign 着色（与 Hero 一致）
- 没有 scrub（per 决策 10）

L2 polish 可复用 `ChartAreaGradient`、`chart-colors`、`useChartPeriodStrokeColor`（ADR 013 §决策 一 L2 资产）。

### 入口 wiring

1. **Hero 「本期市值变化」chip → 盈亏分析**：
   - Portfolio Tab `(tabs)/index.tsx` 把 `periodChangeLabel` 用 `Pressable` 包起来
   - onPress: `router.push("/insights/pnl-analysis?range=" + chartRange)`
   - `InsightsPnlAnalysisScreen` 读 query param init `range` state
2. **Insights Tab 列表项**：
   - `(tabs)/insights.tsx` 加一个 `Card` 列出"盈亏分析" + 副标题"业绩 + 回报 + 排行"
   - tap → `router.push("/insights/pnl-analysis")` （无 range，落 DEFAULT_TIME_RANGE）

---

## i18n contract

```ts
// zh
"insights.pnl.title": "盈亏分析",
"insights.pnl.entryCardTitle": "盈亏分析",
"insights.pnl.entryCardSubtitle": "时段回报 + 累计盈亏 + 盈亏排行",

"insights.pnl.section.period": "时段盈亏",
"insights.pnl.section.cumulative": "累计盈亏",
"insights.pnl.section.ranking": "盈亏排行",

"insights.pnl.periodValueChange.title": "{{period}}资产市值变化",
"insights.pnl.periodValueChange.dateRange": "{{from}} ~ {{to}}",

"insights.pnl.metrics.mwr": "收益率(现金加权 MWR)",
"insights.pnl.metrics.mwr.tooltip":
  "现金加权收益率（XIRR）。把你每次注资 / 取款的时点权重纳入计算；同样市场行情下，加仓时机不同会有不同结果。年化口径。",
"insights.pnl.metrics.annualized": "年化收益率估算",
"insights.pnl.metrics.annualized.tooltip":
  "基于现金加权收益率（MWR / XIRR）按 365 天年化估算。短周期（< 30 天）估算误差较大。",
"insights.pnl.metrics.realized": "已实现盈亏",
"insights.pnl.metrics.realized.tooltip":
  "本时段内卖出交易实现的盈亏总和（卖出价 − 平均成本）× 数量。",

"insights.pnl.cumulative.holdingReturn": "持有收益",
"insights.pnl.cumulative.totalInvested": "总投入",
"insights.pnl.cumulative.totalValue": "现持市值",
"insights.pnl.cumulative.tooltip":
  "持有收益 = 现持市值 − 总投入 + 累计分红，与持仓行加和闭环。不随时间范围变化。",

"insights.pnl.ranking.winnersTab": "盈利 Top5",
"insights.pnl.ranking.losersTab": "亏损 Top5",
"insights.pnl.ranking.empty": "本期无盈亏数据",
"insights.pnl.ranking.newPositionBadge": "新建仓",

"insights.pnl.chart.yAxisLabel": "累计回报率",
"insights.pnl.chart.empty": "本时段暂无回报数据 — 请扩大时间范围或继续录入交易",

"insights.pnl.disclaimer": "仅供参考，可能延迟。本工具不构成投资建议。",
```

英文 placeholder 同义翻译（Sonnet 落地时一并写）。

---

## Algorithm contract（@arc/core/returns/period-pnl.ts）

```ts
import Decimal from "decimal.js";

import type { Transaction, Currency } from "../domain/types";

/** Per-period inputs aggregated by caller from snapshots + bootstrap. */
export interface PeriodPnlInput {
  readonly from: Date;
  readonly to: Date;
  readonly reportingCurrency: Currency;
  readonly valueAt: (date: Date) => Decimal;
  readonly perAssetValueAt: (date: Date, assetId: string) => Decimal;
  readonly transactions: readonly Transaction[];
  /** Day-keyed FX resolver (caller injects historical FX via compute-valuation-at-date). */
  readonly fxAt: (currency: Currency, date: Date) => Decimal;
  /** Chart x-axis sample days (snapshot dates + bootstrap fill), within [from, to].
   *  Order-independent — sorted + deduped internally. ← ADDED in implementation;
   *  the curve needs explicit sample points and `valueAt` alone can't enumerate them. */
  readonly sampleDates: readonly Date[];
}

export interface PeriodPnlResult {
  readonly startValue: Decimal;   // ← ADDED (handy for the date-range card)
  readonly endValue: Decimal;     // ← ADDED

  /** = endValue − startValue − netInflow (period). 含资金流的金额变化。 */
  readonly valueChange: Decimal;

  /** Net inflow (reporting currency) inside (from, to]. */
  readonly netInflow: Decimal;

  /** Sum of realized PnL from SELL transactions inside [from, to]. */
  readonly realizedPnL: Decimal;

  /** Cumulative cost-basis return curve sample points (matches chart). */
  readonly returnCurve: ReadonlyArray<{ readonly date: Date; readonly ratio: Decimal }>;

  /** Money-weighted return, both faces (null when degenerate — UI shows "—").
   *  ← SPLIT from the spec's single `mwr`: XIRR is inherently ANNUALIZED, but
   *  the UI shows two distinct numbers (「收益率(现金加权 MWR)」 vs 「年化收益率估算」).
   *    mwrPeriod    → de-annualized to the actual window: (1+r)^(T/365) − 1
   *                   → drives 「收益率(现金加权 MWR)」
   *    mwrAnnualized → raw XIRR annual rate → drives 「年化收益率估算」 */
  readonly mwrPeriod: Decimal | null;
  readonly mwrAnnualized: Decimal | null;

  /** Per-asset signed contribution (period). Sorted by abs DESC. */
  readonly perAssetContribution: ReadonlyArray<{
    readonly assetId: string;
    readonly contribution: Decimal;
    readonly ratio: Decimal | null;  // null when startValue == 0
  }>;
}

export const computePeriodPnl = (input: PeriodPnlInput): PeriodPnlResult;

// Helper exported separately (§决策 5):
export const computeRealizedPnlInPeriod = (
  transactions: readonly Transaction[],
  from: Date,
  to: Date,
  reportingCurrency: Currency,
  fxResolver: (currency: Currency, date: Date) => Decimal
): Decimal;
```

> **实现状态（2026-05-30, Opus 4.8, commit `295e0b5`）**: 算法层 (Commit 2) 已落地 + 18 测试（12 unit + 6 property），`@arc/core` 180/180 ✅，typecheck 6/6 ✅。上方契约已同步为实现的真实形状。Open question 1 已决议（MWR 退化 → 显示「—」+ ⓘ，保持卡片 layout）。CASH:\* 资产计入 netInflow 但排除出盈亏排行。Commit 3–8（hooks / charts / cards / route / i18n / e2e）为 Sonnet UI 落地。

### `computeMwr` 调用方式

```ts
// 把 period 内 cash flows 拼成 XIRR 输入
const flows: Array<{ date: Date; amount: Decimal }> = [
  { date: from, amount: valueAt(from).negated() }, // 期初市值作为"现金流出"
  ...periodInflowEvents, // 每次 BUY = 流出
  ...periodOutflowEvents, // 每次 SELL = 流入
  { date: to, amount: valueAt(to) }, // 期末市值作为"现金流入"
];
const result = computeMwr(flows); // result.annualizedRate
```

XIRR 退化场景：

- 所有 flows 同 sign → null（用户 UI 显示「—」+ tooltip 说明）
- 单日 → null
- 不收敛 → null

---

## Acceptance criteria

### S-PNL.AC.1 — 数学正确性

- [ ] AC.1.1 累计盈亏卡的「持有收益」== Σ Portfolio Tab 持仓行 delta（数学完全闭环，包括含 dividends）
- [ ] AC.1.2 时段市值变化 == 期末 totalValue − 期初 totalValue − 期内净流入
- [ ] AC.1.3 MWR 在已知 cash flow 序列下匹配 Excel XIRR 函数（误差 ≤ 0.01%）
- [ ] AC.1.4 已实现盈亏 == Σ over SELL ∈ period of (sellPrice − averageCost_at_sell) × shares × fx
- [ ] AC.1.5 累计回报率曲线起点 = 0%（视觉锚定，数据可能小偏移）
- [ ] AC.1.6 排行 Top5 / 亏损 Top5 各自按 abs(contribution) DESC 排序，winners 严格 > 0，losers 严格 < 0
- [ ] AC.1.7 含分红的资产 contribution = (endValue − startValue) − netInflow + period_dividends_received（dividends 视作"收到的回报"）

### S-PNL.AC.2 — 时间范围作用域（同 ADR 016 §决策 3）

- [ ] AC.2.1 时段盈亏卡 + 排行卡随 time range 切换刷新
- [ ] AC.2.2 累计盈亏卡**不随 time range 变化**
- [ ] AC.2.3 从 Hero chip 进入 → time range 跟 Hero 同步
- [ ] AC.2.4 从 Insights Tab 列表项进入 → 默认 3M（DEFAULT_TIME_RANGE）

### S-PNL.AC.3 — UI 闭环

- [ ] AC.3.1 累计盈亏卡数字跟 Portfolio Tab Hero 长按 / 跳转后看到的"持仓行 sum"完全一致
- [ ] AC.3.2 排行卡 tap 单行 → 跳转 Asset Detail，assetId 正确传递
- [ ] AC.3.3 累计回报率曲线颜色按 finance color mode（红涨绿跌 / 绿涨红跌）
- [ ] AC.3.4 空状态（首日 (C) 用户）显示「本期无盈亏数据 — 请扩大时间范围或继续录入交易」

### S-PNL.AC.4 — 数据源 fallback（同 ADR 014）

- [ ] AC.4.1 当 snapshots ≥ minPoints → 走 snapshots
- [ ] AC.4.2 当 snapshots 不足 → bootstrap True Historical 补足
- [ ] AC.4.3 当历史价拿不到 → 影响曲线密度但**不阻塞**累计盈亏卡（cost-basis 不依赖历史价）

### S-PNL.AC.5 — Real Env 实测对账

- [ ] AC.5.1 BoyangJiao Real Env 7 个 CN 基金 + 2 个 US stock 的「累计盈亏」跟 Portfolio Tab 持仓行 sum 完全一致
- [ ] AC.5.2 「现金加权 MWR」跟支付宝同 portfolio 数显示偏差 ≤ 0.5pp（如有钱包行情）
- [ ] AC.5.3 已实现盈亏初期都是 ¥0（用户未做过 SELL）→ 卡片显示 ¥0 正常

---

## Property tests（~6）

| 类别     | 数量 | 覆盖                                                                                                          |
| :------- | :--- | :------------------------------------------------------------------------------------------------------------ |
| 闭环     | 2    | accumulated cost-basis return == holdings sum delta / MWR XIRR 双向验证（input → flow → XIRR → 反算 NPV ≈ 0） |
| 退化场景 | 2    | 同 sign cash flows → MWR returns null / 单日 → MWR returns null                                               |
| 单调性   | 1    | 单调递增 valueAt + 无 inflow → 累计回报率单调递增                                                             |
| 决定性   | 1    | snapshots 乱序传入 → sort 后结果一致；Decimal 边界                                                            |

---

## Implementation plan（commit chain）

> Routing: Opus 算法 + spec / Sonnet UI 落地 / 估时 ~3-4 天

### Commit 1 — docs（先固化 spec）

```
docs(spec): pnl-analysis-insights v1 (ADR 016 §决策 7 follow-up)
  .specify/feature-specs/stage-3/pnl-analysis-insights.md       (本文，新)
  .specify/session-state.md                                     (M: P1 #4 spec ✅)
```

### Commit 2 — core: period-pnl algorithm

```
feat(core): compute period P&L + cumulative return curve + ranking
  packages/core/src/returns/period-pnl.ts                       (新；算法 + 类型)
  packages/core/src/returns/index.ts                            (M: re-export)
  packages/core/__tests__/period-pnl.spec.ts                    (新；6 unit + 6 property)
  packages/core/__tests__/period-pnl.property.spec.ts           (新)
```

> Routing 提醒：算法层涉及 XIRR 闭环 + cost-basis 累积 + per-asset 切片，**Opus 主写** per CLAUDE.md §七「TWR / 再平衡算法」。

### Commit 3 — mobile: hooks

```
feat(mobile): usePnlAnalysis hook composes snapshots + valuation + transactions
  apps/mobile/src/lib/queries/use-pnl-analysis.ts               (新)
  apps/mobile/src/lib/queries/index.ts                          (M: export)
  apps/mobile/src/lib/__tests__/use-pnl-analysis.spec.ts        (新；mock snapshots + tx)
```

### Commit 4 — ui: CumulativeReturnChart variant

```
feat(ui): CumulativeReturnChart for cost-basis cumulative return %
  packages/ui/src/charts/CumulativeReturnChart.tsx              (新；L3 API)
  packages/ui/src/charts/chart-percent-axis.ts                  (新；L2 helper for Y % axis)
  packages/ui/src/charts/index.ts                               (M: export)
  packages/ui/__tests__/cumulative-return-chart.spec.tsx        (新；render + a11y)
```

### Commit 5 — ui: 3 cards

```
feat(ui): PnlPeriodCard + PnlCumulativeCard + PnlRankingCard
  packages/ui/src/finance/PnlPeriodCard.tsx                     (新)
  packages/ui/src/finance/PnlCumulativeCard.tsx                 (新)
  packages/ui/src/finance/PnlRankingCard.tsx                    (新)
  packages/ui/src/finance/RankingRow.tsx                        (新；L2)
  packages/ui/src/finance/index.ts                              (M)
  packages/ui/__tests__/pnl-cards.spec.tsx                      (新)
```

### Commit 6 — mobile: route + wiring

```
feat(mobile): /insights/pnl-analysis route + Hero chip → page wiring
  apps/mobile/app/insights/pnl-analysis.tsx                     (新)
  apps/mobile/app/(tabs)/insights.tsx                           (M: 加入口 card)
  apps/mobile/app/(tabs)/index.tsx                              (M: Hero chip Pressable + router push)
```

### Commit 7 — i18n

```
feat(i18n): insights.pnl namespace (~25 keys, zh + en)
  packages/i18n/src/locales/zh.ts                               (M)
  packages/i18n/src/locales/en.ts                               (M)
```

### Commit 8 — e2e + 文档收尾

```
test(mobile,docs): pnl-analysis e2e smoke + session-state seal
  apps/mobile/__tests__/...                                     (新；AC 自动化部分)
  .specify/session-state.md                                     (M: 标记 P1 #4 ✅)
```

---

## Risks

| Risk                                      | Likelihood | Impact            | Mitigation                                                                          |
| :---------------------------------------- | :--------- | :---------------- | :---------------------------------------------------------------------------------- |
| XIRR 不收敛 / 退化 → MWR 返 null          | Med        | 卡片显示「—」     | tooltip 解释 + 文案准备好；不抛错只 null                                            |
| 累计回报率曲线起点漂移（snapshot 缺日）   | Med        | 视觉 jagged       | bootstrap 兜底 + 前向填充（同 chart 现有策略）                                      |
| 多次加仓的 (C) 用户 MWR 跟支付宝偏差大    | Low        | 用户对账困惑      | tooltip 明示「MWR 按时点权重，跟支付宝『持有收益率』不同口径」                      |
| `computeMwr` 性能（大 cash flow 列表）    | Low        | UI 卡顿           | XIRR 已经 Newton-Raphson O(N) per iteration，100 iter 上限；自用 < 1000 tx 不会触发 |
| 排行 ratio = null（startValue=0）展示混乱 | Med        | UI 显示"—" 或徽章 | 决策 6 已明示 `new-position` 徽章；测试覆盖                                         |
| 持仓含 OPENING_SNAPSHOT 影响 MWR？        | N/A        | —                 | ADR 016 v2 已删除 OPENING_SNAPSHOT，所有 tx 都是 BUY，无影响                        |

---

## Hand-off

- **Implementation owner**: Opus 算法 (commit 2) + Sonnet UI (commit 3-7) + e2e smoke (commit 8)
- **Depends on**:
  - 无新 schema / migration
  - `@arc/core/returns/xirr.ts` Block D Phase 1 已 ready
  - `usePortfolioValueSnapshots` + bootstrap 已 ready（ADR 014 + ADR 016）
- **DoD-critical**: 否（Stage 3 DoD 仅 TWR <1%；本 spec 是 Insights 完善）
- **Block on**: 无（独立 stream，跟 Block D Phase 2 layout polish / Feature ① 交易历史 平行）

---

## Open questions（实施前 confirm）

1. **MWR 退化时 UI 文案细节**：显示「—」+ ⓘ「样本不足，请扩大时间范围」？还是直接隐藏行？
   - 我倾向「—」+ ⓘ（保持卡片 layout 稳定）
2. **排行 Top5 数量**：固定 5 个？资产数 < 5 时显示全部？
   - 我倾向显示 `min(5, holdings_count)`，避免空位
3. **累计回报率曲线 scrub**：首版做不做？
   - 我倾向**不做**（per 决策 10）；polish 留 Stage 4
4. **Hero chip 跳转的 time range 透传**：携带在 query param 还是用 zustand context？
   - 我倾向 query param（无状态、可分享深链接）
5. **Insights Tab 列表当前是什么状态？**
   - 需要 BoyangJiao confirm 现有结构（再平衡卡 + ?）+ 决定盈亏分析入口顺序

---

## Context bundle

Auto: `pnpm ctx:auto` (agent/hook). Config 待生成 → `.specify/feature-specs/stage-3/pnl-analysis-insights.repomix.json`
