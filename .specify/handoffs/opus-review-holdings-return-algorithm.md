# Opus Review — 标的收益率口径 + 持仓快照录入产品方向

> **✅ 已解决 2026-05-27**：Opus 4.7 多轮 review（含 钱往 / Delta / IBKR / 钱迹 / 支付宝 横向对标 + dogfooding 数据反推）+ BoyangJiao confirm，定稿 **[ADR 016 持仓收益率口径 + 录入分级](../../docs/adr/016-holdings-return-and-entry-tiers.md)**。本文档作为决策过程的 record 保留，**不再活跃**；任何参照请直接看 ADR 016。
>
> 简要结论：(1) Hero 保留 True Historical balance 曲线 + 「本期市值变化」label，default/scrub 共享 first-non-zero baseline；(2) 持仓行 % = cost-basis since-open 固定值；(3) 新增 `OPENING_SNAPSHOT` type + 统一录入表单；(4) 业绩/TWR/MWR 独立到 Insights/盈亏分析 模块，不阻塞主链。详见 ADR 016 §决策 1-9。

> **会话来源**：2026-05-26 17:30 Sonnet 4.6 与用户的 dogfooding 探讨。
> **触发**：用户对照支付宝实测「华安黄金 ETF 联接 A（000216）」时发现 ALL 视图持有收益数字与支付宝差 ~5pp，深入挖出**算法 + 录入**两层独立的偏差源。
> **原状态**：未决策 — 待 Opus review 后才进入 spec / ADR / commit 链。**已 supersede by ADR 016（2026-05-27）**。
> **相关 ADR**：[014 portfolio-chart-algorithm](../../docs/adr/014-portfolio-chart-algorithm.md)（部分 superseded）· [015 holdings-row-period-change](../../docs/adr/015-holdings-row-period-change.md)（完全 superseded）· **[016 holdings-return-and-entry-tiers](../../docs/adr/016-holdings-return-and-entry-tiers.md)（最终决定）** · `.specify/data-model-invariants.md` Law 5

---

## TL;DR — 三句话

1. Arc 当前 ALL 视图持仓行 `%` 算法（ADR 014/015）在用户**多次加仓**时存在 baseline 被现金流污染的漏洞，跟支付宝/雪球/天天的「持有收益率」语义对不齐。
2. 用户实际录入习惯（懒录入：首日 + 平均持仓价 + 当前总份额）放大了这个漏洞，并附加了一层「持有成本 vs 平均持仓价」的录入摩擦误差。
3. 需要 Opus 决策的**两个独立议题**：(A) 算法侧 ALL 视图是否切到 cost-basis 口径；(B) 产品侧录入流程是否引入「数据完整度」分流（含 CSV 导入优先级）。

---

## 一、用户实测数据（华安黄金 ETF 联接 A · 000216）

### 1.1 双方数字对照

| 字段             |                    支付宝 |                         Arc |          差 |
| :--------------- | ------------------------: | --------------------------: | ----------: |
| 当前市值         |                ¥71,090.18 |                  ¥71,090.18 |     ✅ 一致 |
| 当前份额         |                 20,569.48 |                   20,569.48 |     ✅ 一致 |
| 累计收益（金额） |               +¥11,180.81 |                 +¥13,754.81 | **+¥2,574** |
| 持有/ALL 收益率  |                   +18.66% |                     +23.99% | **+5.33pp** |
| 反推 baseline    |  ¥59,909.47（"持有成本"） | ¥57,335.37（首点 perAsset） |     -¥2,574 |
| 反推单价         | ¥2.913（"持有成本/份额"） |  ¥2.787（用户输入 avgCost） |     -¥0.126 |

### 1.2 用户真实交易历史（支付宝截图，未完整）

显式可见的 9 笔（2025-09-19 首买 ¥15,000 + 8 笔 ¥1,200~¥1,800 月度定投，累计 ¥28,600，截图下方仍有定投未显示）。

### 1.3 用户实际录入方式

```ts
// 等价于：
{ type: 'BUY', tradeDate: '2025-09-19', shares: 20569.48, pricePerShare: 2.787, fee: 0 }
```

一笔 BUY，把当前持仓的「份额 + 支付宝看到的平均持仓价」一次性按首笔投资日建仓。

---

## 二、双重误差源拆解

### 2.1 误差源 A — 录入摩擦层

**根因**：支付宝的「平均持仓价」≠「持有成本 / 份额」。

| 字段                    | 算法                                                           |         值 |
| :---------------------- | :------------------------------------------------------------- | ---------: |
| 平均持仓价              | 加权平均 NAV（**不含**申购费 / 分红再投资本金）                |     ¥2.787 |
| 持有成本                | 实际投入现金（**含**申购费 + 分红再投资本金 − 卖出按成本核销） | ¥59,909.47 |
| 持有成本 / 份额（隐式） | 上一项 ÷ 份额                                                  |     ¥2.913 |

差额 ¥2,574 ≈ **累计申购费 + 黄金 ETF 历史分红再投资在"成本"维度上的体现 + LOF 折溢价摩擦**（精确分解需要平台明细，但总额量级吻合）。

用户用「平均持仓价」录入 Arc → Arc 的 `totalCostBasis = shares × avgCost = 57,335` 比支付宝的「持有成本」低 ¥2,574。

> **可根除**：录入字段加一项「累计投入金额（可选）」，留空则用 `shares × avgCost` 兜底；用户填了就直接用、不再反推。

### 2.2 误差源 B — 算法语义层（ADR 014/015 漏洞）

即使用户**逐笔精确录入**所有交易，Arc 当前的 ALL 视图算法在多次加仓下仍然失真。

**ADR 014 §195 / ADR 015 §54 的算法**：

```
baseline = chart 范围内该资产第一个非零 perAsset 市值
         = (首笔买入日的份额) × (首笔买入日的 NAV) × (首笔买入日的 FX)

delta   = (今日份额) × (今日 NAV) × (今日 FX) − baseline
percent = delta / baseline × 100
```

**问题**：当 `今日份额 > 首笔买入日份额`（中途加仓），`delta` **混入了加仓本金本身**，不只是市场涨跌。

**极端反例**：

| 时间 | 操作               | 状态                       |
| :--- | :----------------- | :------------------------- |
| 5/1  | 买入 1000 份 @¥2.0 | shares=1000, value=¥2,000  |
| 5/15 | 加仓 5000 份 @¥2.5 | shares=6000                |
| 今日 | NAV=¥3.0           | shares=6000, value=¥18,000 |

| 算法                |            baseline |   delta |      percent |
| :------------------ | ------------------: | ------: | -----------: |
| **Arc ADR 014/015** |              ¥2,000 | ¥16,000 | **+800%** ❌ |
| 支付宝持有收益率    | ¥14,500（持有成本） |  ¥3,500 |       +24.1% |
| 真实 TWR            |     1.25 × 1.20 − 1 |       — |         +50% |

ADR 015 v2 笔记里其实**触碰过**这个问题（"多资产场景下 chart 第一个 snapshot 经常缺少后买入资产"），但当时关注点是"chart 首点缺资产"，**没意识到中途加仓的现金流污染**——即使资产在首点存在，份额变化依然会污染 baseline。

### 2.3 两层误差在用户这个 case 上的折叠

用户的"懒录入"恰好把误差源 B 折叠成一个看似简单的"baseline = 57,335"（因为只有一笔 BUY，没有"多次加仓 baseline 失真"）。但**两个根因是独立的**：

- 误差源 A 影响：**所有**模式 D（快照）录入的用户，无论 Arc 算法如何
- 误差源 B 影响：**所有**多次加仓的真实交易（A/B 模式），无论用户是否懒录入

> **关键洞察**：哪怕用户改用逐笔精确录入，Arc 的 ALL 视图也会显示约 800% 这种荒谬数字（如果他的定投价差大）。这是 ADR 014/015 留下的真正定时炸弹。

---

## 三、议题 A — 算法层方案

### 3.1 5 个方案 trade-off

| 方案                                              | ALL 视图 baseline     | 时段视图 baseline | 优                                                | 劣                                                                           |
| :------------------------------------------------ | :-------------------- | :---------------- | :------------------------------------------------ | :--------------------------------------------------------------------------- |
| **A. 全面 cost-basis**                            | `totalCostBasis`      | `totalCostBasis`  | 跟支付宝/雪球/天天 100% 一致；不依赖 chart 数据源 | 时段"涨跌"语义消失，所有视图都是"自建仓以来"；失去 Arc 差异化                |
| **B. 持仓级 TWR**                                 | 按 cash flow 切段累乘 | 同左              | 算法严谨；剔除现金流；跟 Block D Phase 1 同源     | 实现成本高（per-asset cash flow 切段 + 段间历史价 + 每段 TWR）；UI 解释难度↑ |
| **C. 混合：ALL=cost-basis，时段=True Historical** | `totalCostBasis`      | 当前 ADR 014/015  | ALL 跟支付宝对齐符合用户直觉；时段保留 Arc 差异化 | 两套语义并存需文档化；时段视图多次加仓仍有 B 漏洞但范围缩小                  |
| **D. 双数显示**                                   | 显示两个数字          | 显示两个数字      | 信息最完整                                        | UI 复杂度↑↑；普通用户被信息量压垮                                            |
| **E. 保持现状 + disclosure**                      | 当前算法              | 当前算法          | 改动最小                                          | 不解决根本问题；继续误导用户                                                 |

### 3.2 当前会话倾向：方案 C

理由：

- **ALL 视图本来就是「全程视角」**，用户心智模型是「赚了多少 ÷ 投了多少」，跟支付宝/雪球/天天/同花顺/蛋卷完全对齐
- **时段视图保留 True Historical 是 Arc 的差异化**（中途换仓、再平衡决策的可视化在曲线上看得见）
- 同时**也修复了 ADR 014/015 在多次加仓场景下的算法失真**（ALL 视图永远走 cost-basis，时段视图通常多次加仓影响有限）
- ADR 014 §197 的 fallback 路径其实**已经是 cost-basis-since-open 语义**，只是把它从"fallback"提升为"ALL 视图主路径"

### 3.3 隐含的 supersession 边界

ADR 014 §"决策：True Historical（含 bootstrap 路径也用真实算法）" + ADR 015 §"算法（伪代码）" 都需要补 v5 章节，明确：

- **Hero 总值 % 变动**：保持 chart 首点非零 total（True Historical），与曲线视觉同源
- **持仓行 ALL %**：切到 `totalCostBasis`（cost-basis-since-open）
- **持仓行 时段 %**：保持 chart perAsset 首点非零（True Historical），cost fallback 保留

这意味着 **Hero 和持仓行在 ALL 视图下数字会"不可加和"**（hero 总 % 是首点同源；行 % 是 cost 同源；两个加权和不相等）。这是有意义的——hero 视觉跟曲线对齐，行视觉跟用户"我投了多少 / 赚了多少"对齐——但 UI 上需要避免误导。

---

## 四、议题 B — 产品层：录入流程分级

### 4.1 录入方式光谱

```
精度 ─────────────────────────────────────────────► 摩擦
A. 逐笔手工 ── B. CSV 导入 ── C. 平台 API ── D. 持仓快照
   (最精确)      (省力+精确)    (理想态)       (用户当前用)
```

| 模式        | 时机               | 数据完整度                  | 适合用户             |
| :---------- | :----------------- | :-------------------------- | :------------------- |
| A. 逐笔手工 | 新建仓 / 未来定投  | ✅ 完整 cash flow           | 新开始管理的资产     |
| B. CSV 导入 | 老用户首次接入 Arc | ✅ 完整 cash flow           | 天天/蛋卷/雪球老用户 |
| C. 平台 API | Stage 4+           | ✅ 完整 + 自动              | 长期方向             |
| D. 持仓快照 | 支付宝定投老用户   | ⚠️ 自录入日起完整，之前估算 | 用户当前 case        |

### 4.2 入口设计：按「数据完整度」分流，不按「业务语义」

**不**让用户选"我是历史持有 / 历史定投"这种业务标签（用户认知负担高）。让用户回答**"我手头有什么数据"**：

```
新增持仓：
  ┌─ 我刚买入                    → 模式 A: 单笔交易表单
  ├─ 我已经持有一段时间，要把当前持仓搬进 Arc
  │    ├─ 我有完整交易历史        → 模式 A 批量 / 模式 B (CSV)
  │    └─ 我只知道当前份额和均价  → 模式 D: 快照录入
  └─ 我要从其他 app 导入          → 模式 B (CSV)
```

### 4.3 模式 D（快照）的语义明示

1. **数据模型**：考虑新增 `OPENING_SNAPSHOT` transaction type（或复用 `ADJUSTMENT` + `metadata.isOpeningSnapshot`），区分"真实买入"和"对账起点"
2. **持仓行 UI**：加 badge「开仓快照 · YYYY-MM-DD」/「完整历史」
3. **算法分支**：模式 D 持仓的 ALL `%` 强制走 cost-basis（即使议题 A 选了 B/D/E 方案，模式 D 也必须 cost-basis）
4. **字段设计**：
   - 必填：**当前份额** + **平均持仓价**（NAV）
   - 可选：**累计投入金额**（留空则用前两者相乘兜底）
   - 多一个可选字段就能根除误差源 A

### 4.4 CSV 导入的现实约束

**国内基金平台导出能力**（需要 Stage 3 末做正式调研，下表凭印象）：

| 平台            | 导出能力        | 用户基数 | 优先级   |
| :-------------- | :-------------- | :------- | :------- |
| 支付宝/蚂蚁财富 | ❌ 仅截图       | #1       | 痛点最大 |
| 天天基金        | ✅ Excel 导出   | 高       | 高       |
| 蛋卷基金        | ✅ 导出         | 中       | 中       |
| 雪球            | ✅ 导出         | 中       | 中       |
| 各券商 App      | ❌ 大部分仅截图 | A 股     | 低       |

**关键判断**：CSV 导入**做不到「一键搞定支付宝用户」**。可行路径：

1. **Stage 2/3 范围**：通用 CSV 模板（`date, type, shares, price, fee, currency, asset_id`）
2. **Stage 3 后期**：天天/蛋卷格式映射
3. **Stage 4+**：支付宝截图 OCR（准确率不可控，作为兜底）

> 因此对支付宝用户，**模式 D（快照）+ 快照后逐笔补录**仍是 Stage 2/3 的现实路径。

---

## 五、推荐落地路径（讨论起点，待 Opus 调整）

### 短期（Stage 3 末 / Stage 4 前，~2 周）

1. **录入流程引入「数据完整度」分流入口**（议题 B）
   - 默认走「完整买入」模式 A；「我已持有，仅录入快照」入口视觉权重克制
   - 快照录入字段：份额 + 均价 + 可选累计投入金额（根除误差源 A）
2. **ALL 视图算法切 cost-basis 口径**（议题 A 方案 C）
   - 持仓行 ALL % 走 `totalCostBasis`；时段 % 保持 True Historical
   - Hero 总值 % 保持现状（与曲线视觉同源）
   - 起草 **ADR 016**（"标的收益率口径：ALL=cost-basis vs 时段=True Historical"），supersede ADR 014/015 的局部
3. **持仓详情页加数据完整度 badge**
   - 「完整历史」/「快照估算」两态；tap 进 tooltip 说明
4. **录入模式数据模型决策**
   - 选 `OPENING_SNAPSHOT` 还是 `ADJUSTMENT + metadata`
   - 决定后写 migration（若新增 enum 值）

### 中期（Stage 3 收尾 → Stage 4 初，1-2 个月）

5. **通用 CSV 导入**：模板 + 解析 + 预览校验 + 错误恢复
6. **快照后的「快速记账」模式**：开仓快照后，用户只需输入「金额 + 日期」，系统按当时 NAV 反推份额（依赖历史价数据源）
7. **天天 / 蛋卷 CSV 格式映射**

### 长期（Stage 4+）

8. **持仓级 TWR**（议题 A 方案 B 的严谨实现）— 让模式 A/B 用户拿到 Block D 同源的 TWR 数字
9. **平台 API 自动同步**（如果生态有进展）
10. **支付宝截图 OCR**（如果用户呼声高）

---

## 六、待 Opus 决策的 4 个问题

### Q1 — 算法侧选哪个方案？

| 选项                   | 建议                                               |
| :--------------------- | :------------------------------------------------- |
| 方案 A 全面 cost-basis | 改动最小但放弃 Arc 差异化                          |
| 方案 B 持仓级 TWR      | 严谨但实现成本高                                   |
| **方案 C 混合**        | **会话倾向**：ALL=cost-basis，时段=True Historical |
| 方案 D 双数显示        | UI 复杂度                                          |
| 方案 E 保持现状        | 不推荐                                             |

> 若选 C：是否同意把 ADR 014/015 的算法描述更新为 v5 supersession 形态？还是新写 ADR 016？

### Q2 — 快照录入收哪几个字段？

| 选项       | 字段集                                               |
| :--------- | :--------------------------------------------------- |
| 选项 1     | 份额 + 平均持仓价（最少）                            |
| **选项 2** | **份额 + 平均持仓价 + 可选累计投入金额（会话倾向）** |
| 选项 3     | 份额 + 累计投入金额（不收均价，反向推算）            |

> 选项 2 的"可选"字段会不会增加表单复杂度反而劝退用户？还是选项 3 更克制？

### Q3 — `OPENING_SNAPSHOT` 是否值得新增？

| 选项                                             | 优                         | 劣                                   |
| :----------------------------------------------- | :------------------------- | :----------------------------------- |
| 新增 `OPENING_SNAPSHOT` type                     | 数据模型干净；算法分支显式 | 需 migration；现有 28 个测试可能要调 |
| 复用 `ADJUSTMENT` + `metadata.isOpeningSnapshot` | 改动小                     | 语义混杂；audit trail 边界模糊       |

### Q4 — CSV 导入要不要插队？

用户作为 dogfooding 主体，**模式 D 快照精修** vs **通用 CSV 导入**哪个 ROI 更高？这关系到 Stage 3 末排期（Block D Phase 2/3 vs CSV import）。

---

## 七、相关代码 / 文档 / commit 路径

### 7.1 算法实现

| 路径                                                           | 角色                                                                  |
| :------------------------------------------------------------- | :-------------------------------------------------------------------- |
| `apps/mobile/src/lib/holdings-presenter.ts`                    | `resolvePeriodChange()` — 议题 A 主战场                               |
| `apps/mobile/src/lib/queries/use-portfolio-value-snapshots.ts` | `periodBaselineByAsset()` — chart baseline 计算                       |
| `apps/mobile/src/lib/portfolio-chart-bootstrap.ts`             | True Historical bootstrap（ADR 014）                                  |
| `apps/mobile/src/lib/compute-valuation-at-date.ts`             | `computeFullValuationAtDate` + `computeCostBasisAtDate`               |
| `packages/core/src/domain/holdings.ts`                         | `computeHoldings()` — `averageCost` / `totalCostBasis` 累加器         |
| `packages/core/src/domain/valuation.ts`                        | `computeMarketValue()` — `costBasisReporting = shares × avgCost × fx` |
| `packages/core/src/returns/twr.ts`                             | Block D Phase 1 — 议题 A 方案 B 的潜在复用基础                        |
| `packages/ui/src/finance/HoldingRow.tsx`                       | UI 渲染 — badge 落点                                                  |

### 7.2 ADR / Spec

| 文档                                                                  | 状态                                   | 关系                                                |
| :-------------------------------------------------------------------- | :------------------------------------- | :-------------------------------------------------- |
| `docs/adr/014-portfolio-chart-algorithm.md`                           | ✅ Accepted（**今天新建，未 commit**） | 议题 A 直接影响；需补 v5 章节或被 ADR 016 supersede |
| `docs/adr/015-holdings-row-period-change.md`                          | ✅ Accepted（**今天新建，未 commit**） | 同上                                                |
| `.specify/data-model-invariants.md` Law 5                             | —                                      | 不冲突（cost-basis 不混历史/当下）                  |
| `.specify/feature-specs/stage-3/holdings-and-transactions-stage-3.md` | ✅ Accepted                            | 议题 B 需新增"快照录入"子契约                       |

### 7.3 当前工作区状态（未 commit）

```
?? docs/adr/014-portfolio-chart-algorithm.md
?? docs/adr/015-holdings-row-period-change.md
?? apps/mobile/src/lib/default-chart-range.ts
?? apps/mobile/src/lib/portfolio-chart-bootstrap.ts
?? apps/mobile/src/lib/queries/use-portfolio-chart-series.ts
 M apps/mobile/src/lib/holdings-presenter.ts
 M apps/mobile/src/lib/compute-valuation-at-date.ts
 M apps/mobile/src/lib/queries/use-portfolio-valuation.ts
 M apps/mobile/src/lib/twr-day-lookup.ts
 M apps/mobile/app/(tabs)/index.tsx
 M apps/mobile/app/asset/[market]/[symbol].tsx
 [+ data-sources / i18n / ui / 其他]
```

ADR 014/015 是今天（2026-05-26）刚定的算法，**尚未 commit 也未经历真实 dogfooding**。本议题等于是该算法的"24 小时后续 review"。

---

## 八、给 Opus 的执行提示

1. **先读** [ADR 014](../../docs/adr/014-portfolio-chart-algorithm.md) + [ADR 015](../../docs/adr/015-holdings-row-period-change.md) 全文（30 分钟），再回到本文档 §三（算法层）
2. **算法验证**：可以让 Opus 跑一遍极端反例（§2.2 表格）的 property test 设计，验证议题 A 各方案在 1-100 次加仓场景下的数学性质
3. **Q3 数据模型**：如果倾向新增 `OPENING_SNAPSHOT`，提前看 `packages/core/src/domain/types.ts` 的 `Transaction.type` enum + `packages/db/migrations/*` 的 `transactions.type` check constraint
4. **决策产出**：建议落 **ADR 016**（标的收益率口径 + 录入分级 v1），同时给出 commit 链拆分（spec / migration / algorithm / UI / docs 几个阶段）
5. **不要做的**：本会话**没有动代码**；Opus 不必直接修 holdings-presenter.ts，先决策、起草 spec / ADR、然后再交 Sonnet/Cursor 实施
