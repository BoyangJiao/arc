# ADR 014 — 持仓价值趋势图算法

- **状态**: ✅ 已接受（曲线算法部分）；Hero 数字 label 部分被 **ADR 016 §决策 1** 取代
- **日期**: 2026-05-26
- **作者**: BoyangJiao + Claude (Opus 4.7)
- **取代**: 本 ADR 替代 Stage 3 期间三次"修一个 bug 换一种算法"的迭代，最终锁死语义
- **被取代**: Hero 数字 label / scrub 行为 / first-non-zero baseline 一致性 → [ADR 016](./016-holdings-return-and-entry-tiers.md) §决策 1
- **相关 ADR**: 009（Daily Snapshot）、010（Dev 缓存）、011（多源 fallback）、**016（最新取代部分）**
- **相关法则**: `.specify/data-model-invariants.md` Law 5（历史 ≠ 当下）
- **相关 spec**: `feature-specs/stage-3/twr-stage-3.md`、`feature-specs/stage-3/holdings-and-transactions-stage-3.md` §J14

> **2026-05-27 partial supersession**：本 ADR 描述的「Hero 数字下方 period delta」label 与 chart 曲线 baseline 在 ADR 016 中被重新定义为「本期市值变化」（label 文案变化）+ default/scrub 共享同一 first-non-zero baseline（数学一致性保证）。**Chart 曲线本身算法不变**（True Historical）。持仓行 % 算法（曾在 ADR 014 §六提及）改由 ADR 016 §决策 2 全面取代为 cost-basis since-open 固定值。

---

## TL;DR

Arc Portfolio Tab 趋势图采用 **True Historical** 算法：每个时点的曲线值 = **当时持仓 × 当时价格 × 当时汇率**。**不**使用 Delta 风格的 "current-shares projection"（即"假设当前篮子穿越历史"）。

针对"今天才录入持仓"的 (C) 类新用户，**不靠造数据缓解**视觉空白，而是：

1. **默认时间范围动态选取**：根据 `first trade date` 自动落到能装下数据的最窄 range（持有 5 天 → 默认 1W，不默认 1Y）
2. **录入表单只要求成本均价**：交易日期默认今天，用户可改；填了真实日期就有真实历史，没填就接受"首笔交易前显示 0"是事实
3. **首笔交易前显示 ¥0**（不画虚线、不加 marker、不加 banner）—— 跟 Delta 一致，简洁

---

## 背景

### Stage 3 三次迭代的根因

本 ADR 之前，趋势图实现经历了三次迭代：

1. 第一版：只读 `portfolio_value_snapshots`，新组合空状态
2. 第二版（5/24）：bootstrap 加入，首点用 cost basis，中间点用 shares-at-T × historical price —— 首点与中间点语义不一致
3. 第三版（5/25）：bootstrap 切到 current-shares projection (Delta 风格)，视觉好看但与 Law 5 精神冲突

根因：算法语义没锁，每次修视觉就换一种算法。本 ADR 强制选定，不再就"曲线该怎么画"反复讨论。

### 两种算法的本质区别

```
True Historical（本 ADR 采用）:
  point(T) = Σ_asset ( shares_held_at_T × price_at_T × fx_at_T )

Current-Shares Projection（被否决）:
  point(T) = Σ_asset ( current_shares × price_at_T × fx_at_T )
```

在 cash flow 发生时差别尤其显著：

```
故事：5/14 买入 10 股 UBER（之前 portfolio 空）。今天是 5/25。

True Historical 曲线（1M 视图）:
  Apr 25 …… May 13: ¥0.00  ← 没持仓
  May 14:           ¥5,135
  May 25:           ¥4,880

  形态: ──────────┐
                  └────── 直角，stair-step

Current-Shares Projection 曲线（1M 视图）:
  Apr 25:           ¥4,957 ← 假设那时就有 10 股
  May 14:           ¥5,135
  May 25:           ¥4,880

  形态: ───╲╱─╲─╱──── 平滑
```

### Arc 的硬约束（Law 5）

`.specify/data-model-invariants.md`：

```
Historical valuation: 历史价格 × 历史汇率
Current valuation:    最新价格 × 最新汇率
Never mix.
```

True Historical 完全符合。Current-Shares Projection 字面上不违反"历史价 × 历史汇率"，但**持仓字段本身已被替换为当前值**——历史快照里写入的不是当时的真实状态——精神方向冲突。

### Delta 算法的真相（修正之前的误解）

Stage 3 早期讨论时把 Delta 简化为"始终 projection"。实际上：

- Delta 在用户**录入持仓时主动询问** `average price` 和 `purchase date`
- 用户填了真实日期 → Delta 用 True Historical
- 用户没填或选"今天" → Delta 用 projection 兜底（**仅在缺数据时**）

Delta 的 projection 是降级方案，不是主曲线。Arc 因数据模型完整（`transactions.trade_date` 必填），几乎不需要降级。

### 国内对标产品

雪球 / 同花顺 / 蛋卷 NAV 曲线**全部**用 True Historical，且无交易则不画曲线。中国 self-directed 投资者的认知模型与此一致。

---

## 决策：True Historical（含 bootstrap 路径也用真实算法）

| 维度                           | 选择理由                                      |
| :----------------------------- | :-------------------------------------------- |
| Law 5（历史 ≠ 当下）           | ✅ 不修宪法                                   |
| TWR 算法一致性                 | ✅ 曲线和 TWR 同源，跨屏数字永远一致          |
| 再平衡可视化（Arc 核心差异化） | ✅ 中途换仓在曲线上看得见                     |
| 审计 / 税务复用                | ✅ snapshot 即事实                            |
| 跟雪球/同花顺/蛋卷对齐         | ✅ 一致                                       |
| 跟 Delta 对齐                  | ✅ 一致（Delta 的主路径也是 True Historical） |
| 维护成本                       | ✅ 只一套算法、一套 property test             |

---

## (C) 类新用户体验：在数据录入和默认窗口两端解决

### 用户类型分桶（明确语义）

```
A. 今天才开始投资                → tradeDate = today  → True Historical 完美工作
B. 历史持有，录入时填了真实买入日 → tradeDate = past   → True Historical 完美工作
C. 历史持有，录入时全选今天      → tradeDate = today  → 与 A 不可区分
```

实测：(C) 是新用户**多数**行为（用户在支付宝定投基金，记不清每次买入日期，但知道平均成本和总份额）。Arc 不能假设用户都行为像 (B)。

### 解法 1：录入表单——只要求成本均价

录入持仓时**必填字段最小化**：

```
✓ 资产 / 市场（必填）
✓ 持有份额（必填）
✓ 平均成本（必填）
○ 交易日期（默认今天；用户可改）
```

**理由**：(C) 类用户记得均价、记不得日期。强制选日期会增加录入摩擦但不增加数据价值（用 today 还是用一年前对收益率追溯都不准）。让用户选择交付：

- 准确日期 → 真实历史曲线
- 不填 / 用 today → 接受"首笔交易前显示 ¥0"是事实

这跟用户预期一致：**"我今天才录入，系统当然不知道我之前怎么样"**。不是 bug。

### 解法 2：智能默认时间范围

新用户首次进入 Portfolio Tab，**根据 `first trade date` 距今的天数选默认 range**：

| 距首笔交易 | 默认 range |
| :--------- | :--------- |
| < 1 天     | 1D         |
| 1–7 天     | 1W         |
| 7–30 天    | 1M         |
| 30–90 天   | 3M         |
| 90–365 天  | 1Y         |
| > 1 年     | 1Y         |

用户**手动切换**之后状态持久化，不再 override。

效果：默认进来看到的曲线是"装得下"数据的最窄 range——不会出现"屏幕 80% 区域是 ¥0"。手动切到 1Y/ALL 才会看到前面的 ¥0 段——这是用户主动行为，符合预期。

### 解法 3：首笔交易前显示 ¥0（不加装饰）

确认采用 Delta 风格：

- ❌ 不画虚线 placeholder
- ❌ 不加首笔交易 📌 marker
- ❌ 不加"持有不足 X 月"banner
- ✅ 直接显示 ¥0 到 stair-step 跳点

理由（用户原话）：_"Delta 这边其实是没有这些的……以及 1 年和 All 的视图直接展示的就是前面为 0"_。简洁优先，避免随资产数量增加产生冲突 / bug。

---

## 持仓行（Holding Row）周期变动语义

Stage 3 UAT 发现 bug：同一时段，holding row 显示的 delta 和 % 数学上不一致（例：delta = -¥76.83 但 % = -7.53%，对不上）。根因是 fallback 路径下 `delta` 来自 `unrealizedPnL`、`percent` 来自一个**不同基线**算出来的 ratio。

### 修正后的语义（同 baseline 双源）

```
对每个 holding row 在选中的 range 内：

  if 首点 snapshot 包含该资产 perAsset 条目:
    baseline = perAssetReporting at chart-windowFrom   // True Historical baseline
    delta    = currentValue - baseline
    percent  = delta / baseline × 100

  else (该资产在 windowFrom 时尚未持有):
    baseline = costBasisReporting                       // Since-position-open
    delta    = currentValue - baseline
    percent  = delta / baseline × 100
```

两个分支都用**同一个 baseline** 算 delta 和 percent，保证数学一致。Fallback 分支语义是"自建仓以来"，跟 Robinhood / Delta 一致。

UI 不区分两种分支的标签（避免视觉噪声）。需要区分的话留给详情页 tooltip。

---

## 实现计划（落地）

### 1. `apps/mobile/src/lib/portfolio-chart-bootstrap.ts`

- 删除 current-shares projection 逻辑
- 替换为 True Historical：每个 sample day 调 `computeHoldings(transactionsUpToDay)` 算当时持仓，再 × 当时价 × 当时汇率
- 持仓为空的日子 → `totalValue = 0`，依然写入 chart point（让 stair-step 在 UI 上正确呈现）
- 价格 lookup 改回 `lookupByUtcDayWithForwardFill`（只前向填充；该资产未上市的日子不返回值）
- 保留性能优化：N 个资产一次性 prefetch 宽窗口历史价（避免 N×M 次 adapter 调用）

### 2. `apps/mobile/app/(tabs)/index.tsx`

- `useState` 初始值改成 `() => DEFAULT_TIME_RANGE`（不变）
- 增加 `useEffect`：transactions 首次加载完成且用户未手动改过 range 时，按 "距首笔交易天数" 选合适 range
- 用一个 `userPickedRangeRef` 标记，防止后续 transactions 变化时反复 override 用户选择

### 3. `apps/mobile/src/lib/holdings-presenter.ts`

- 重写 `resolvePeriodChange`：
  - 接受 `costBasisReporting`（替代 `unrealizedPnL` + `unrealizedPnLPercent` 两个独立参数）
  - 单一计算路径：选定 baseline → 算 delta 和 percent
- 修复 (delta, percent) 数学不一致 bug

### 4. 不需要改的

- `.specify/data-model-invariants.md` Law 5：保持不变
- `.specify/constitution.md`：保持不变
- TWR 算法：保持不变（已经是 True Historical）
- snapshot 表 / daily-snapshot edge function：保持不变（空持仓日 `skipped-empty` 是对的）

---

## 后果

### 正面

- 算法只有一套：一份代码、一份 property test、一份心智模型
- 曲线、TWR、Drawdown、Performance Attribution 全部共享 `portfolio_value_snapshots`，跨屏数字永远一致
- 不修宪法，Law 5 / constitution 保持不变
- 再平衡决策的可视化（Arc 核心差异化）正确反映在曲线上
- 跟雪球 / 同花顺 / Delta 主路径都对齐
- holding row 不再有 delta-vs-percent 数学不一致 bug

### 负面

- (C) 类新用户 1Y/ALL 视图会看到大量 ¥0 段（接受——这是事实）
- 不再有 projection 模式，未来如果需要 "what-if 当前篮子穿越历史" 分析，需做独立 What-If 模块（不混入主流程）

### 中性

- bootstrap 代码量略增（per-day 重算持仓 vs 用一次 currentHoldings），但被 prefetch 优化抵消，端到端时间相近
- 智能默认 range 增加 ~10 行 useEffect 代码

---

## 不再讨论

- 用 cost basis 当首点（第二版做法）
- 用 current-shares projection（第三版做法）
- Hybrid（snapshot 有就 true、无就 projection）

如要重新评估这些方案，需先**修订本 ADR**并解释为什么前述决策不再适用，不能就个别 UAT 反馈直接换算法。
