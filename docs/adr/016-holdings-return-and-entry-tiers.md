# ADR 016 — 持仓收益率口径 + 录入分级（最终版）

- **状态**: ✅ Accepted（2026-05-27，BoyangJiao 确认 → 待 Sonnet/Cursor 实施）
- **作者**: BoyangJiao + Sonnet 4.6（discovery）+ Claude Opus 4.7（multi-round refinement）
- **Supersedes**: ADR 015 全文（持仓行算法）；ADR 014 中 hero 数字 label 部分
- **相关 ADR**: 014 portfolio-chart-algorithm（曲线算法保留）· 015 holdings-row-period-change（被本 ADR 取代）· 009 daily-snapshot · 011 multi-source fallback · 013 ui-wrapper-ownership
- **相关法则**: `.specify/data-model-invariants.md` Law 5（历史 ≠ 当下）
- **触发文档**: [`.specify/handoffs/opus-review-holdings-return-algorithm.md`](../../.specify/handoffs/opus-review-holdings-return-algorithm.md)

---

## TL;DR

三件事，一次性锁定：

1. **Portfolio Tab Hero**：保持 True Historical balance 曲线（含现金），数字下方显示「本期市值变化 +¥X (+Y%)」，baseline = chart 首个非零点（默认状态与 scrub 状态共享同一 baseline，无翻车）。
2. **持仓行**：cost-basis since-open **固定值**，**不**随时间范围切换。彻底消除 ADR 014/015 在多次加仓下 baseline 现金流污染（极端 +800% 反例）+ 跟支付宝/钱往/雪球对账 100% 一致。
3. **新增 `OPENING_SNAPSHOT` transaction type + 统一录入表单**：用「份额 + 累计投入金额」（不是平均持仓价）根除录入摩擦 A（¥2,574 量级偏差），按 mode 入口（"我刚买入" vs "录入持仓快照"）分流。

「业绩 / Return 分析」（TWR / MWR / cost-basis 累计回报曲线）**独立到 Insights Tab 的"盈亏分析"模块**，参照 IBKR 业绩 tab 设计（详见 §六），单独 feature spec，**不阻塞**本 ADR 主链落地。

---

## 背景与动机

### 触发：2026-05-26 dogfooding（详见 handoff 文档）

用户对照支付宝实测华安黄金 ETF 联接 A（000216），Arc ALL 视图 +23.99% vs 支付宝 +18.66%（差 5.33pp）。挖出**两个独立根因**：

**误差源 A — 录入摩擦层（¥2,574 量级）**

```
支付宝「平均持仓价 ¥2.787」 ≠ 支付宝「持有成本 ¥59,909 / 份额」= ¥2.913
                          ↑ 差额 ≈ 累计申购费 + 分红再投资本金
```

用户用「平均持仓价」录入 → `costBasis = shares × 2.787` 比真实持有成本低 ¥2,574。

**误差源 B — 算法语义层（极端可显示 +800%）**

ADR 014/015 的 ALL `baseline` = chart 首点非零 perAsset = "首笔买入日的份额 × 首笔买入日的 NAV"。**多次加仓时 `delta = current - baseline` 把加仓本金混入了"市场涨幅"**。极端反例：

```
5/1  买入 1000 份 @¥2.0  → shares=1000, baseline=¥2,000
5/15 加仓 5000 份 @¥2.5
今日 NAV=¥3.0           → shares=6000, current=¥18,000

ADR 014/015:  delta=¥16,000 → percent=+800%  ❌（包含 ¥12,500 加仓本金）
cost-basis:   delta=¥3,500  → percent=+24.1% ✅
真实 TWR:    +50%（剔除现金流）
```

两根因独立——即使用户改成逐笔精确录入，算法侧 +800% 漏洞依然存在。

### 多方对标（钱往 + Delta + IBKR + 钱迹 + 支付宝）

| 产品              | Hero 曲线                         | Hero 数字 + %                             | 持仓行 算法                  | 业绩/Return 分析         |
| :---------------- | :-------------------------------- | :---------------------------------------- | :--------------------------- | :----------------------- |
| **钱往**          | True Historical balance           | 只显示总值 + 日期                         | cost-basis 固定              | 「盈亏分析」独立 page    |
| **Delta**         | True Historical（不含现金）       | 混合算法，scrub 翻车                      | projection / cost-basis 混合 | —                        |
| **IBKR**          | True Historical NAV（"价值"tab）  | $ + % 跟 chart 自洽                       | cost-basis                   | 「业绩」tab = TWR % 曲线 |
| **钱迹**          | —                                 | —                                         | cost-basis 固定              | 独立 page                |
| **支付宝**        | —                                 | —                                         | cost-basis 固定              | 独立 page                |
| **Arc（本 ADR）** | True Historical balance（含现金） | 「本期市值变化」+ first-non-zero baseline | cost-basis 固定              | Insights/盈亏分析 模块   |

**共同设计语言**（除 Delta 试图混合而 scrub 翻车外）：**"balance 视图"与"return 视图"严格分离**，每个视图内部算法一致。Arc 跟此共识。

### 用户类型 A/B/C 分桶

```
A. 今天才开始投资                → tradeDate = today      → cost-basis 完美工作
B. 历史持有，逐笔精确录入        → tradeDate = past + 多 BUY → cost-basis + 可选 TWR 都准确
C. 历史持有，只录入持仓快照      → OPENING_SNAPSHOT       → cost-basis 准确，TWR 隐藏
```

(C) 是新用户**多数**行为（支付宝定投基金记不清每次时间）。本 ADR 通过录入分级 + 数据模型让 (C) 也能精确对账。

---

## 决策

### 决策 1 — Portfolio Tab Hero 数字 + 曲线

| 元素                                  | 算法                                                                         | 备注                                                                                           |
| :------------------------------------ | :--------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------- |
| **Total Worth 数字**                  | live valuation = Σ(持仓 + 现金)                                              | **含现金**（与 IBKR / 钱往 一致；不含现金的 Delta 风格不适合 Arc 长期配置定位）                |
| **数字下方「本期市值变化 +¥X (Y%)」** | $ = current - chart_first_non_zero<br>% = $ / chart_first_non_zero × 100     | label **「本期市值变化」** 而非「盈亏」——明确告知用户这是含资金流的 balance 变化，不是投资回报 |
| **Hero 曲线**                         | True Historical（ADR 014 不变）                                              | 含现金；(C) 用户首日跳变完全合理（"用户那天把资产搬进 Arc"）                                   |
| **Scrub 状态**                        | $ = scrub_value - chart_first_non_zero<br>% = $ / chart_first_non_zero × 100 | **跟默认状态共享同一 baseline**，数学保证一致，杜绝 Delta 翻车                                 |
| **「本期市值变化」chip 可点**         | 跳转 Insights → 盈亏分析，自动同步 time range                                | UI polish 决定，不进 ADR 主体                                                                  |

**关键性质**：

- (C) 用户 1M 视图：chart 左半都是 ¥0，first_non_zero = today's value → hero 显示 +¥0 (0%) ✅ 诚实
- (B) 用户 1M 视图：chart 左端 = 30 天前余额，hero 显示真实期间 balance 变化 ✅
- 任意 scrub：用同一 baseline 算 → 跟默认状态数学一致，永远不会跳变

### 决策 2 — 持仓行 `%` 算法

**统一改为 cost-basis since-open 固定值，不随时间范围切换变化。**

```ts
const resolvePeriodChange = (
  valueReporting: Decimal,
  costBasisReporting: Decimal
): HoldingPeriodChange => {
  if (costBasisReporting.isZero()) {
    return { kind: "new-position" };
  }
  const delta = valueReporting.minus(costBasisReporting);
  const percent = delta.dividedBy(costBasisReporting).times(100);
  return { kind: "ok", delta, percent };
};
```

**删除**：`periodBaselineByAsset` 参数、chart 数据源依赖、首点 fallback 逻辑、时间范围 prop 透传。

### 决策 3 — 时间范围切换器作用域

| UI 元素                                  | 受时间切换器影响 | 备注                        |
| :--------------------------------------- | :--------------: | :-------------------------- |
| Hero 总市值（live）                      |        ❌        | 永远是 live                 |
| Hero 「本期市值变化」                    |        ✅        | 决策 1                      |
| Portfolio chart                          |        ✅        | True Historical（ADR 014）  |
| 「已实现盈亏(period)」card（如有）       |        ✅        | 按 period 求和              |
| **持仓行 `%`**                           |      **❌**      | **决策 2，固定 cost-basis** |
| 持仓行 valueReporting / 现价 / 成本      |        ❌        | live                        |
| Asset Detail page chart + TWR / 回报曲线 |        ✅        | Block D Phase 2 接入        |
| Insights/盈亏分析 整页                   |        ✅        | 决策 7                      |

### 决策 4 — Asset Detail Page 周期分析

`computeAssetTwr`（Block D Phase 1 已实现，property-tested）落地到 `apps/mobile/app/asset/[market]/[symbol].tsx`：

- **(B) 类资产**（无 OPENING_SNAPSHOT）：显示 asset-level TWR + cost-basis，**双数字**，tooltip 解释差异
- **(C) 类资产**（含 OPENING_SNAPSHOT）：**隐藏 TWR**，只显示 cost-basis + 价值曲线（起点 = snapshot 日期）
- TWR 显示文案模板：

```
时段收益率: +40.0%       (大字)
  └ ⓘ 「假设你在 5/1 一次性投入今天等额资金，市场涨幅 +40%。GIPS 标准的『时间加权收益率』，剔除你的加仓/减仓节奏。」
实际盈亏:   +¥3,500 / +23.5%   (小字)
  └ ⓘ 「今日市值减去你所有买入投入。这是你的真实账户回报。」
```

(C) 类资产隐藏 TWR 时的文案：

```
本资产含持仓快照，无法精准计算时间加权收益率（TWR）。请参考「累计盈亏」反映你的真实持有回报。
```

### 决策 5 — 新增 `OPENING_SNAPSHOT` transaction type

**Schema 变更**（migration 0014）：

```sql
ALTER TABLE transactions DROP CONSTRAINT transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('BUY', 'SELL', 'DIVIDEND', 'SPLIT', 'ADJUSTMENT', 'OPENING_SNAPSHOT'));
```

**Drizzle schema + TypeScript types** 同步加 `OPENING_SNAPSHOT` enum 值。

**核心代码行为**：

| 函数                                            | 对 `OPENING_SNAPSHOT` 的处理                                 |
| :---------------------------------------------- | :----------------------------------------------------------- |
| `computeHoldings()`                             | 同 BUY：shares 累加、加权成本计算、totalCostBasis 累加       |
| `detectCashFlowEvents()` (portfolio-level)      | 不算 CF（非 CASH:\* 资产，本来就不算）                       |
| `detectAssetCashFlowEvents()` (asset-level TWR) | **排除**（避免污染 TWR startValue）                          |
| Asset Detail page UI 判断"是否含 snapshot"      | 用 `transactions.some(tx => tx.type === 'OPENING_SNAPSHOT')` |

**为什么必须新建 type，不复用 ADJUSTMENT + metadata**：

| 维度                | 复用 ADJUSTMENT | 新建 OPENING_SNAPSHOT                                                  |
| :------------------ | :-------------- | :--------------------------------------------------------------------- |
| 数据模型清晰度      | 语义混杂        | 明确                                                                   |
| Asset TWR 检测      | 读 metadata     | enum switch                                                            |
| Audit trail         | 边界模糊        | 干净                                                                   |
| UI badge / 列表显示 | 字段检查复杂    | 一行                                                                   |
| Migration 成本      | 0               | 1 enum + 1 check constraint（dogfooding 期，用户基数 = 1，最便宜窗口） |

### 决策 6 — 录入表单：统一字段 + mode 入口分流

**统一表单字段**（参考 钱迹 / Delta / IBKR / 钱往 通用模式）：

```
资产 + 类型(买入/卖出/分红) + 交易时间
+ 数量/金额 toggle:
    ├─ 「数量」模式：份额 + 单价   → 存 shares + pricePerShare
    └─ 「金额」模式：总额 + 单价   → 存 shares (= total/price) + pricePerShare
+ 手续费 + 投资账户 + (可选) 从账户扣除现金
```

**ABC 三种模式共用同一个表单 component**，差异在入口 + 写入 `type`：

```
"+" 添加交易：
  ┌─ 我刚买入 / 卖出 / 分红                  → 写入 type=BUY/SELL/DIVIDEND
  └─ 录入持仓快照（已有持仓，要对账起点）    → 写入 type=OPENING_SNAPSHOT
                                                 单价 label 改为「持仓成本价」
                                                 hint：「= 累计投入 ÷ 份额」
                                                 默认不预填现价
```

**为什么 snapshot 收「累计投入金额」（金额 toggle）而不是「平均持仓价」**：

| 字段                     | 用户认知歧义                      | 误差源                |
| :----------------------- | :-------------------------------- | :-------------------- |
| 平均持仓价（"持仓单价"） | 跟"持有成本/份额"长得像、用户易混 | 误差 A（¥2,574 量级） |
| 累计投入金额             | 支付宝/天天有专门栏目，无歧义     | 无                    |

引导 (C) 用户使用「金额」toggle 填累计投入 → 根除误差 A。

### 决策 7 — 「业绩 / Return 分析」独立到 Insights/盈亏分析模块

**Hero 上不引入"价值 / 业绩"tab 切换**（参考 §六 与 IBKR pattern 的比较）。理由：

- Arc 用户画像（CLAUDE.md §一：长期持有 + 跨平台聚合 + 再平衡）≠ IBKR 用户（频繁交易看业绩）
- Insights tab 本就是 Arc 分析中心（再平衡已在那里）→ 业绩 + 再平衡同居自然
- Hero 的「本期市值变化」chip 可点跳转 Insights → 提供 1-tap 体验，弥补 IBKR tab 切换便利性
- 将来如发现用户痛点，**加 Hero tab 是 easy add，删 tab 是 expensive change** → 保守路径

**Insights/盈亏分析模块设计**（独立 feature spec，不在本 ADR 实施范围）：

```
盈亏分析详情页：
  Header: 盈亏分析
  Time range tabs: 1D / 1W / 1M / 3M / YTD / 1Y / 全部

  ┌─ 时段盈亏（随时间范围）────────────────────┐
  │ 「{period}资产市值变化 +¥X」(大字)            │
  │ {期初} ~ {期末}                              │
  │ [Chart: 累计回报率 % 曲线，起点 0%]           │
  │   ⓘ tooltip: "TWR / MWR 算法说明，不考虑注资  │
  │      或取款（参考 IBKR 业绩 tab 范式）"        │
  │ 收益率(现金加权 MWR)    +Y%                  │
  │ 年收益率估算            +Z%                  │
  │ 已实现盈亏(period)      ¥A                  │
  └─────────────────────────────────────────────┘

  ┌─ 累计盈亏（固定，不随时间范围）───────────┐
  │   未实现盈亏    +¥X (+Y%)   ← cost-basis    │
  │     == Σ(持仓行 delta)  ← 跟 Portfolio Tab 闭环 │
  │   总投入        ¥XXX                         │
  │   现持市值      ¥XXX                         │
  └─────────────────────────────────────────────┘

  ┌─ 盈亏排行（随时间范围）───────────────────┐
  │   [盈利 Top5] [亏损 Top5]                   │
  │   per-asset cost-basis ranking              │
  └─────────────────────────────────────────────┘
```

**新 feature spec**：`.specify/feature-specs/stage-3/pnl-analysis-insights.md`（独立 work stream，可拆 Block E 或 Stage 4）。

### 决策 8 — 混合录入（BUY + OPENING_SNAPSHOT 同资产共存）

支持。事件溯源天然兼容：

```
fund 1 的 transactions：
  OPENING_SNAPSHOT(shares=A, price=p1, date=2025-09-19)   ← 注册 Arc 时录入快照
  BUY(shares=B, price=p2, date=2026-04-10)                ← 之后真实定投
  BUY(shares=C, price=p3, date=2026-05-15)

computeHoldings 输出:
  totalShares    = A + B + C
  totalCostBasis = A·p1 + B·p2 + C·p3
  averageCost    = totalCostBasis / totalShares
  cost-basis %   = (current - totalCostBasis) / totalCostBasis  ✅ 完全正确

用户视角:
  Portfolio Tab 行   显示 cost-basis %  ← 跟支付宝持续闭环
  Asset Detail      显示「持仓快照·2025-09-19」badge + 交易历史 list
                    TWR 隐藏（含 OPENING_SNAPSHOT）
                    cost-basis P&L 显示
```

**单独删除 OPENING_SNAPSHOT 的能力**：tx list 中按现有标准 tx 删除流程操作。删除后 computeHoldings 重算 → 该资产从混合态恢复为纯 BUY 态，badge 消失、TWR 自动显示。

**CSV / 未来 OCR 导入冲突解决**（Stage 4+ CSV 落地时的 UX）：

```
导入预览页（检测到 OPENING_SNAPSHOT 与导入数据冲突）：
  ⚠️ 易方达科创板 已有持仓快照（2025-09-19）
     CSV 包含该资产 8 条历史交易
     ┌──────────────────────────────────────────┐
     │ ● 用 CSV 替换快照（推荐）                  │
     │   删除快照 + 插入 8 条真实买入             │
     │ ○ 合并（保留两者，可能造成持仓重复）       │
     │ ○ 跳过该资产                              │
     └──────────────────────────────────────────┘
```

本 ADR **不实施** CSV 导入；仅保证数据模型层面 `tx.delete` + `tx.insert` 是原子可行的（已支持）。

### 决策 9 — ADR 014 / 015 状态调整

- **ADR 014（chart True Historical）**：保持 ✅ Accepted。在文档顶部追加：「**hero 数字 label 在 ADR 016 中被 supersede**；曲线算法不变」
- **ADR 015（持仓行 chart→cost fallback）**：状态改为 ⛔ **Superseded by ADR 016**。在 TL;DR 后追加完整 supersede 说明 + 跳转链接

---

## 实施计划（commit chain）

每个 commit 必须 `pnpm typecheck` + `pnpm test` 双绿。

### 主线（Stage 3 Real Env bugfix 阶段，~2 周）

#### Commit 1 — docs（先固化决策）

```
docs(adr): adr-016 holdings return + entry tiers (final)
  docs/adr/016-holdings-return-and-entry-tiers.md                  (本文)
  docs/adr/014-portfolio-chart-algorithm.md                        (M: 顶部 partial supersede 注释)
  docs/adr/015-holdings-row-period-change.md                       (M: 状态改为 Superseded by ADR 016)
  .specify/handoffs/opus-review-holdings-return-algorithm.md       (M: 顶部 Resolved 注释 → ADR 016)
  .specify/session-state.md                                         (M: Open decisions Resolved)
```

#### Commit 2 — db migration + types

```
feat(db,core): opening-snapshot transaction type (adr-016)
  packages/db/drizzle/migrations/0014_opening_snapshot_tx_type.sql  (新)
  packages/db/src/schema/transactions.ts                            (M: enum 加 OPENING_SNAPSHOT)
  packages/core/src/domain/types.ts                                 (M: TransactionType union)
  packages/core/__tests__/types-readonly.spec.ts                    (M: 覆盖新 enum)
```

> 注意 PG `ALTER TYPE` gotcha（参考 Stage 2 J9 migration 0006/0007/0008 拆 commit 模式）。如 enum 改动必须拆，再拆 commit 2a / 2b。

#### Commit 3 — core algorithm

```
feat(core): opening-snapshot semantics in computeHoldings + cash-flow detection
  packages/core/src/domain/holdings.ts                              (M: case OPENING_SNAPSHOT)
  packages/core/src/returns/cash-flow.ts                            (M: portfolio-level 不变；asset-level 排除 OPENING_SNAPSHOT)
  packages/core/src/returns/twr.ts                                  (M: detectAssetCashFlowEvents 排除 OPENING_SNAPSHOT)
  packages/core/__tests__/holdings.spec.ts                          (M: 新 case)
  packages/core/__tests__/cash-flow.spec.ts                         (M: 新 case)
  packages/core/__tests__/twr.spec.ts                               (M: OPENING_SNAPSHOT 不污染 TWR)
  packages/core/__tests__/holdings-cost-basis.property.spec.ts      (新：附录 A property test)
```

#### Commit 4 — holdings-presenter 单源化

```
feat(mobile): holdings row %% = cost-basis fixed (adr-016)
  apps/mobile/src/lib/holdings-presenter.ts                          (M: resolvePeriodChange 单源)
  apps/mobile/src/lib/queries/use-portfolio-value-snapshots.ts       (M: periodBaselineByAsset 删除 / deprecate)
  apps/mobile/app/(tabs)/index.tsx                                   (M: 移除 holdingsPeriodBaseline 传参 + chart range prop)
  apps/mobile/src/lib/__tests__/holdings-presenter.spec.ts           (新)
```

#### Commit 5 — Hero baseline 一致性修复

```
feat(ui): hero $/%% first-non-zero baseline (adr-016)
  packages/ui/src/finance/PortfolioHeroSection.tsx                   (M: default + scrub 共享 first-non-zero)
  packages/ui/src/finance/compute-period-change.ts                   (M: 接受 baseline 参数)
  packages/ui/__tests__/portfolio-hero-section.spec.ts               (新)
  packages/i18n/src/locales/{en,zh}.ts                               (M: 「本期市值变化」label)
```

#### Commit 6 — 录入 UI mode 分流 + 快照表单

```
feat(mobile): opening-snapshot entry mode + total-invested toggle (adr-016)
  apps/mobile/app/portfolio/[id]/transactions/new/_layout.tsx        (M: mode picker)
  apps/mobile/app/portfolio/[id]/transactions/new/snapshot.tsx       (新)
  apps/mobile/src/lib/transaction-form-presenter.ts                  (M)
  packages/ui/src/finance/TransactionForm.tsx                        (M: 数量/金额 toggle)
  packages/i18n/src/locales/{en,zh}.ts                               (M)
```

#### Commit 7 — 持仓快照 badge + Asset Detail UI

```
feat(ui,mobile): holding-snapshot badge + asset detail gating (adr-016)
  packages/ui/src/finance/HoldingRow.tsx                             (M: optional badge slot)
  apps/mobile/src/lib/holdings-presenter.ts                          (M: 推 badge prop)
  apps/mobile/app/asset/[market]/[symbol].tsx                        (M: badge + TWR gating)
  packages/i18n/src/locales/{en,zh}.ts                               (M: badge / tooltip 文案)
```

#### Commit 8 — UAT smoke + 文档收尾

```
test(mobile,docs): adr-016 e2e smoke + session-state seal
  apps/mobile/__tests__/...                                          (新建 / 更新 e2e)
  .specify/session-state.md                                          (M: Resolved 标记完毕)
```

### 独立 stream（Insights/盈亏分析模块，~2-3 周，不阻塞主线）

#### Commit 9 — feature spec

```
docs(spec): pnl-analysis-insights feature spec (adr-016 §7)
  .specify/feature-specs/stage-3/pnl-analysis-insights.md            (新)
```

#### Commit 10+ — 实施（按 spec 拆 ~5-8 个 commit）

包括：

- MWR (XIRR-like) 算法封装（已有 Block D `xirr` 可复用）
- TWR 曲线数据生成 hook
- `PnlAnalysisCard` / `ReturnRateChart` UI 组件
- Insights tab 新页面 + 路由
- i18n 文案
- e2e tests

---

## 验收标准

### S016-AC.1 — 算法正确性

- [ ] 极端反例（1000 @¥2 → 5000 @¥2.5 → today ¥3）持仓行 `%` 显示 **+24.1%**（cost-basis），不再是 +800%
- [ ] 用户华安黄金 ETF 联接 A 实测：录入「份额 20,569.48 + 累计投入 ¥59,909.47」→ 持仓行显示 **+18.66%**（与支付宝 100% 一致）
- [ ] property test：100 次随机加仓序列，cost-basis `%` 数学正确（见附录 A）

### S016-AC.2 — 时间范围语义

- [ ] 持仓行 1D / 1W / 1M / 3M / YTD / 1Y / ALL 显示**同一个** `%`
- [ ] Portfolio chart 随时间范围变化（ADR 014 不变）
- [ ] Hero「本期市值变化」随时间范围变化（chart-based baseline）
- [ ] Hero scrub 状态与默认状态用同一 baseline，scrub 数字不跳变

### S016-AC.3 — Hero (C) 用户体验

- [ ] (C) 用户首日录入快照后，1M 视图 Hero 显示「+¥0 (0%)」，**不**显示「+∞%」/「+1358%」之类
- [ ] (B) 用户 1M 视图 Hero 显示真实期间 balance 变化（非零）

### S016-AC.4 — 快照录入

- [ ] 录入流程入口区分「完整买入 / 卖出 / 分红」vs「录入持仓快照」
- [ ] 快照表单收「份额 + 累计投入金额」（数量 / 金额 toggle），**不**收「平均持仓价」
- [ ] 提交后 transactions 表写入 `type='OPENING_SNAPSHOT'`，`shares` 和 `pricePerShare` 按 toggle 模式反推
- [ ] computeHoldings 对 `OPENING_SNAPSHOT` 累加 totalCostBasis

### S016-AC.5 — UI 标识

- [ ] 持仓行右下角显示「快照 · YYYY-MM-DD」badge（如该资产有 OPENING_SNAPSHOT tx）
- [ ] Asset Detail 顶部「持仓快照 · YYYY-MM-DD」badge + tap tooltip
- [ ] 完整历史录入的资产 **不显示** badge

### S016-AC.6 — TWR 独立性

- [ ] `computeAssetTwr` 不把 `OPENING_SNAPSHOT` 计入 cash flow events
- [ ] (C) 类资产 Asset Detail 隐藏 TWR，显示文案"含持仓快照，无法精准计算..."
- [ ] (B) 类资产 Asset Detail 显示 TWR + cost-basis 双数字 + tooltip 解释差异
- [ ] property test：含 OPENING_SNAPSHOT 的 transactions 列表，asset TWR 不变（snapshot 不污染）

### S016-AC.7 — 混合录入

- [ ] (C) 类资产后续追加真实 BUY，cost-basis P&L 正确累加
- [ ] OPENING_SNAPSHOT 可单独删除（标准 tx delete 流程）
- [ ] 删除 OPENING_SNAPSHOT 后该资产从混合态恢复纯 BUY 态，badge 消失、TWR 自动显示

---

## 反对方案（为什么不选）

### 不选「方案 A：全面 cost-basis」（含 hero / chart）

- 失去 Arc"再平衡曲线可视化"差异化（chart 必须保留 True Historical）
- 时间范围 selector 失去意义

### 不选「方案 B：全面 per-asset TWR」（持仓行 + hero）

- 持仓行 + TWR + cost-basis 三数字过载
- 大部分用户主用例 = reconciliation 不是 analysis
- TWR 实现成本高，Stage 3 末时间窗不够
- 对 (C) 用户 TWR 计算退化 / 误导

### 不选「方案 C 原版：时段保留 True Historical」

- 时段视图依然有现金流污染
- 持仓行 `%` 随时间切换变化增加认知负担
- ALL/时段双语义并存难以解释

### 不选「方案 D：双数显示」（持仓行 + Insights 都显示两套）

- 持仓行信息过载
- 用户认知负担

### 不选「方案 E：保持现状 + disclosure」

- +800% 极端反例是 P0 级别用户信任伤害
- 跟支付宝差 5.33pp 已触发对账怀疑
- "精准，安全"不容许"看起来是 bug 但解释为什么不是"

### 不选「Delta 风格的 Hero 算法（混合 projection / cost-basis）」

- 默认 vs scrub 算法不一致 → 用户翻车（实测 +108% → +1358% 跳变）
- 同一资产跨视图意义不同（UBER 在 1W=projection、1M+=cost-basis）→ 无统一心智模型

### 不选「Hero 引入 价值 / 业绩 tab 切换」（IBKR 风格）

- Arc 用户画像 ≠ IBKR（频繁交易）
- 业绩在 Insights/盈亏分析 1-tap 即达（chip 跳转）已够
- 加 tab 容易、删 tab 难 → 保守先不加

---

## 附录 A — property test 设计

```ts
// packages/core/__tests__/holdings-cost-basis.property.spec.ts
import fc from "fast-check";
import Decimal from "decimal.js";
import { computeHoldings } from "../src/domain/holdings";

describe("cost-basis return 是否对 BUY 顺序、价格路径不变", () => {
  it("cost-basis = (sum(shares × current_price) - sum(shares × buy_price)) / sum(shares × buy_price)", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            shares: fc.float({ min: 0.01, max: 1000, noNaN: true }),
            price: fc.float({ min: 0.01, max: 1000, noNaN: true }),
          }),
          { minLength: 1, maxLength: 100 }
        ),
        fc.float({ min: 0.01, max: 1000, noNaN: true }),
        (buys, currentPrice) => {
          const txs = buys.map((b, i) => mkBuy(b.shares, b.price, dayN(i)));
          const holdings = computeHoldings(txs);
          const h = holdings[0]!;
          const expectedCost = buys.reduce(
            (acc, b) => acc.plus(new Decimal(b.shares).times(b.price)),
            new Decimal(0)
          );
          const expectedShares = buys.reduce((acc, b) => acc.plus(b.shares), new Decimal(0));
          const currentValue = expectedShares.times(currentPrice);
          const expectedReturn = currentValue.minus(expectedCost).dividedBy(expectedCost);
          const actualReturn = currentValue.minus(h.totalCostBasis).dividedBy(h.totalCostBasis);
          expect(actualReturn.minus(expectedReturn).abs().toNumber()).toBeLessThan(1e-10);
        }
      )
    );
  });

  it("OPENING_SNAPSHOT 不污染 asset TWR — 同样 valueAt 路径下 TWR 与无 snapshot 等价", () => {
    // 略：见 commit 3 实施
  });
});
```

---

## 附录 B — UI 文案（i18n placeholder）

```ts
// zh
"transaction.entry.modePicker.title":                  "选择录入方式",
"transaction.entry.modeA.label":                       "完整交易",
"transaction.entry.modeA.hint":                        "我刚买入 / 卖出 / 收到分红",
"transaction.entry.modeD.label":                       "录入持仓快照",
"transaction.entry.modeD.hint":                        "我已经持有一段时间，作为对账起点",

"transaction.amount.toggle.shares":                    "数量",
"transaction.amount.toggle.total":                     "成交金额",
"transaction.snapshot.unitPrice.label":                "持仓成本价",
"transaction.snapshot.unitPrice.hint":                 "= 累计投入金额 ÷ 当前持仓份额（支付宝/天天「持有成本」对账金额）",

"portfolio.hero.periodChange.label":                   "本期市值变化",
"portfolio.hero.periodChange.tooltip":                 "本期总资产价值变化金额（含资金流入流出）。如需查看剔除资金流的投资回报，请前往「Insights → 盈亏分析」。",

"holdings.badge.snapshot":                             "快照 · {{date}}",
"holdings.badge.snapshot.tooltip":                     "本资产以持仓快照方式录入。盈亏率基于「累计投入金额」计算，不含快照日前的市场波动。",

"assetDetail.twr.hidden.reason":                       "本资产含持仓快照，无法精准计算时间加权收益率。请参考左侧「累计盈亏」反映你的真实持有回报。",
"assetDetail.twr.tooltip":                             "假设你在期初一次性投入今天等额资金，市场涨幅。GIPS 标准的「时间加权收益率」，剔除你的加仓/减仓节奏。",
"assetDetail.costBasis.tooltip":                       "今日市值减去你所有买入投入。这是你的真实账户回报。",
```

英文版 i18n 翻译在 commit 6 / 7 实施时一并落地。

---

## 已知遗留 / 后续 ADR 触发点

1. **CSV 导入（Stage 4+）**：本 ADR 不实施 CSV。CSV 落地时同时设计「快照-CSV 冲突预览」UX（见决策 8）。可能触发 ADR 017。
2. **支付宝 / 平台 API（Stage 5+）**：未来接入支付宝 / 天天 / 蛋卷 API 自动同步。届时 mode A vs mode D 由数据完整度自动判定。
3. **快照对账校验**（Stage 5+）：未来用户录入快照后，可周期性 vs 支付宝对照，差超过 0.5% 提示重新录入。
4. **Holdings row 时段视图回归**（不推荐）：如果用户调研发现需要持仓行时段分析（不太可能），重启本 ADR 决策 2 讨论。
5. **Hero 价值/业绩 tab 加入**（待观察）：如果用户调研发现"业绩"高频访问，可加 Hero tab 切换；目前保守不加。
