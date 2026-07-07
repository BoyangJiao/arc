# Feature: Insights Enrichment — 洞察模块扩充（Delta 借鉴 + Arc 差异化卡片）

- **Status**: Accepted — decisions locked 2026-06-15 (BoyangJiao)
- **Author**: Claude Opus 4.8 (draft) — 决策由 BoyangJiao 拍板
- **Created**: 2026-06-15
- **Stage**: 3 — Block D（Insights 深化）
- **Implements**: `.specify/feature-specs/stage-3/stage-3-roadmap.md` §Block D（与 TWR / PA / Drawdown 同 Block）
- **Related journeys**: J7（Daily Snapshot）、J9（再平衡）、J16（PA 贡献分析）
- **Conforms to**: `.specify/constitution.md`（Decimal everywhere、文案铁律）、ADR 006（`@arc/ui` 分层）、ADR 008（token 纪律）
- **Touches**: `packages/core/`（新增 exposure / risk / benchmark 聚合 + property tests）、`packages/ui/charts`（新增 BarChart wrapper + 多序列 LineChart）、`packages/ui/finance`（新增卡片）、`apps/mobile/app/(tabs)/insights.tsx` + `apps/mobile/app/insights/*`、`packages/i18n`
- **Depends on**: Block C 真实持仓估值（Done）、`twr-stage-3.md`（benchmark 复用 TWR sub-period）、`performance-attribution-stage-3.md`（PA 卡）

---

## Why this feature exists

当前 Insights Tab（Block B）只有：PnL 入口卡 + per-portfolio 再平衡摘要卡 + 跨组合占位卡。对照 Delta app 的 Insights（12 张卡），Arc 缺少"看懂组合"的深度分析层。

但 **Arc 不抄 Delta 的料**。Delta 的 Insights 是"通用券商数据 + 卖点堆料"，其中多张卡依赖自动连券商（"最常用交易所""资产位置"在手动录入下是空数据），且 Delta **不做基金、不做多币种深度、没有再平衡**——而这三点正是 Arc 的护城河。

因此本 spec 的策略是：**borrow 5 张、跳过 3 张、自创 3 张**，并把"配置 / 币种 / 再平衡"做成 Insights 的主角。

---

## Locked decisions（2026-06-15 BoyangJiao）

1. **「费用」卡不做** — Arc MVP 不计算基金费率（`project-background §6.3`），无可靠数据来源，看不到必要性。从 roadmap 中移除，不进 backlog。
2. **「配置偏离卡」分档**：
   - **基础偏离（当前配置 vs 目标配置，偏离 X%）= Free** — 建立每日打开理由。
   - **具体份额变化 + 多组合再平衡方案 = Pro** — 护城河深度。
3. **现在开始实现**；UI 统一优化（视觉打磨）放到本批卡片功能完成之后。

---

## Insights IA — 四类分类法（Accepted 2026-06-16 BoyangJiao）

> 卡片越堆越多后，按"用户问的问题"切成 **4 个互不重叠的心智类**。`/insights/pnl-analysis`
> 详情页此前堆了 8 个模块（P&L + 收益报告 + 资产价值 + 交易统计 + 风险 + 回撤）——
> 风险/回撤等被拆出，详情页收敛回纯组合级 P&L。

| 类             | 回答的问题                                 | 模块                                                   | Tab 形式                                 |
| :------------- | :----------------------------------------- | :----------------------------------------------------- | :--------------------------------------- |
| **① 资产配置** | 钱分布在哪、离目标差多少（_结构_）         | 再平衡 · 市场敞口 · 币种敞口（· 资产位置 future）      | 内联 section（per-portfolio loop）       |
| **② 盈亏分析** | 整个组合表现如何、赚了多少（组合级*回报*） | 时段盈亏 · 累计盈亏 · 盈亏排行（· 基准/PA future）     | 入口卡 → `/insights/pnl-analysis` 详情页 |
| **③ 持仓表现** | 拆到每个资产看（逐资产*明细*）             | 收益报告（逐资产收益）· 资产价值（多资产价值曲线 Pro） | 内联 section（active portfolio）         |
| **④ 组合统计** | 多活跃、波动/回撤多大（行为 + _风险_）     | 交易统计 · 风险 Pro · 回撤 Pro                         | 内联 section（active portfolio）         |

**判据**：盈亏排行（②）= 组合级 Top 亮点摘要；收益报告（③）= 逐资产全表 —— 不重复。
**改名**：贸易统计 → **交易统计**（`insights.tradeStats.title`）。
**组件**：`PortfolioHoldingsPerformanceSection`（③）+ `PortfolioStatsSection`（④），active-portfolio
self-resolve（`useActivePortfolio`），数据不足时 self-guard 返回 null。Tab 顺序：② 入口卡 → ① loop →
③ → ④ → 跨组合占位。视觉打磨（stat 卡略稀疏，可考虑 2-up tile）按 spec decision #3 推后到本批功能完成后。

---

## Tier-gating 现状与策略（重要约束）

**当前代码无运行时 entitlement / paywall。** `apps/mobile/app/me/subscription.tsx` 是静态占位（Free/Pro/Pro+ 三档 + "敬请期待"，无定价、无 IAP）。支付接入（Apple IAP / Stripe）属 Stage 4。

→ **决策**：本批 Insights 卡片**不引入真实运行时锁**。每张卡在代码与 spec 中**标注目标档位 `tier: 'free' | 'pro' | 'proPlus'`**，并在 Pro / Pro+ 卡右上角渲染**视觉徽章**（PRO / PRO+，复用现有 token，参照 Delta 截图与 subscription 占位页定位）。功能全部可用、可自测。

→ **真实门控延后到 Stage 4**：届时 entitlement 系统就位后，门控只是按本表做一次 `tier` 查表 + `<ProGate>` 包裹，无需重写卡片。徽章组件 (`InsightTierBadge`) 现在就建，Stage 4 复用。

> 该决策符合 ADR 007「真实链路不可绕过」——不写 `if (DEV_*) return mock` 短路；卡片走真实 compute，只是暂不加锁。

---

## 卡片裁决总表

> 图例：✅ 已有可复用 · 🟡 部分有/需收口 · 🆕 新建 · ❌ 跳过

|  #  | 卡片（中文）                                | 来源                  | 裁决           | 目标档位                 | 图表复用                          | 备注                                         |
| :-: | :------------------------------------------ | :-------------------- | :------------- | :----------------------- | :-------------------------------- | :------------------------------------------- |
|  1  | 历史记录（余额曲线 + 时段）                 | Delta                 | ✅ 已有        | **Free**                 | `AreaChart`/`LineChart`           | Daily Snapshot 已覆盖                        |
|  2  | 投资组合多样性（资产环形）                  | Delta                 | ✅ 已有        | **Free**                 | `AllocationDonut`                 | Arc 心脏，永久免费                           |
|  3  | 配置偏离卡（基础偏离）                      | Arc 自创              | 🟡 收口        | **Free**                 | `DeviationDonut` + `DeviationBar` | 复用现有 rebalance 摘要                      |
| 3p  | 配置偏离卡（份额变化 + 多组合方案）         | Arc 自创              | 🟡 收口        | **Pro**                  | `RebalanceActionList`             | 复用 `/insights/rebalance/*`                 |
|  4  | 市场/地域敞口（A股/港股/美股/基金/crypto）  | Arc 自创              | 🆕             | **Free**                 | `AllocationDonut`（复用）         | 中国配置者最关心，差异化                     |
|  5  | 币种敞口（CNY/USD/HKD…）                    | Arc 自创              | 🆕             | **Pro**                  | `AllocationDonut`（复用）         | 多币种 day-1 架构优势可视化，Delta 弱项      |
|  6  | 收益报告（已/未实现盈亏 per 资产）          | Delta                 | 🟡 收口        | **Free 汇总 / Pro 明细** | 无（表格）                        | 汇总免费；逐资产表格 + 时段切换归 Pro        |
|  7  | 贸易统计（交易笔数 / N 资产）               | Delta                 | 🆕             | **Free**                 | 无（数字）                        | 低成本，增加"完整度"                         |
|  8  | Performance Attribution（逐资产贡献）       | Delta「投资组合表现」 | ✅ 已规划      | **Pro**                  | 🆕 `BarChart`（水平 ±）           | 见 `performance-attribution-stage-3.md`      |
|  9  | 组合表现 vs 基准（沪深300/中证全指/自定义） | Delta「投资组合表现」 | 🆕             | **Pro**                  | 🆕 `BarChart`（分组按时段）       | Arc 换中国基准，差异化                       |
| 10  | 资产价值（多资产叠加曲线）                  | Delta                 | 🆕             | **Pro**                  | 🆕 多序列 `LineChart`             | 比单一余额曲线进阶                           |
| 11  | 风险（beta / 年化波动）                     | Delta                 | 🆕             | **Pro**                  | `TrendChip` + number              | 需合规标识（见下）                           |
| 12  | 资产位置（按平台/账户聚合）                 | Delta                 | 🆕（轻量重做） | **Free**                 | `AllocationDonut`（复用）         | 「跨 ≥2 平台聚合」卖点证据；空数据归"未指定" |
|  —  | 投资组合 P/E                                | Delta                 | ❌ 跳过        | —                        | —                                 | 多资产组合 P/E 基本"不适用"                  |
|  —  | 最常用的交易所                              | Delta                 | ❌ 跳过        | —                        | —                                 | 手动录入下脏数据；并入 #12                   |
|  —  | 费用                                        | Delta                 | ❌ 跳过        | —                        | —                                 | Locked decision #1                           |

---

## 图表复用映射（回应「HeroUI Pro Native 图表更新」）

**现状**：`@arc/ui/charts` 已是 HeroUI Pro Native 图表的 wrapper（`LineChart` → `heroui-native-pro/line-chart`，`AreaChart` 同理）；`@arc/ui/finance` 有自建 SVG 环形/条形（`AllocationDonut` / `DeviationDonut` / `DeviationBar`）。

HeroUI Pro Native 当前提供的图表：`area-chart` · `bar-chart` · `line-chart` · `pie-chart` · `radar-chart` · `chart-crosshair` · `chart-indicator`。

| 需求                           | 复用现状                                            | 动作                                                                                                                              |
| :----------------------------- | :-------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------- |
| 余额 / 累计收益曲线（单序列）  | `AreaChart` / `LineChart` / `CumulativeReturnChart` | **复用，无新建**                                                                                                                  |
| 资产/市场/币种/平台 占比环形   | `AllocationDonut`（自建 SVG）                       | **复用，无新建**                                                                                                                  |
| 目标 vs 实际 偏离环形 + 条     | `DeviationDonut` / `DeviationBar`                   | **复用，无新建**                                                                                                                  |
| PA 逐资产贡献（水平 ±条）      | 无                                                  | **🆕 `BarChart` wrapper over Pro `bar-chart`**（horizontal、双色正负）                                                            |
| 组合 vs 基准（按时段分组竖条） | 无                                                  | **🆕 同一 `BarChart` wrapper**（grouped/竖向）覆盖                                                                                |
| 资产价值多资产叠加曲线         | `LineChart` 当前单序列                              | **🆕 扩展 `LineChart` 支持多序列**（`series: {key,color,points}[]`），或新增 `MultiLineChart`；优先扩展现有，复用 scrub/crosshair |
| 风险 beta 趋势                 | `TrendChip`                                         | **复用**                                                                                                                          |
| radar-chart                    | —                                                   | 本批不用                                                                                                                          |

**净新增图表组件 = 1.5 个**：`BarChart`（PA + benchmark 共用）+ `LineChart` 多序列能力。其余全部复用。所有新 chart 仍走 ADR 006 `@arc/ui/charts` wrapper，业务代码不直接 import `heroui-native-pro`。

---

## User-facing behavior（新增/变更卡片，Given/When/Then）

### #4 市场/地域敞口卡（Free）

- **Given** 选中组合有 ≥1 持仓
- **When** 进入 Insights → 组合卡
- **Then** 显示一张环形图：按 `Market`（CN/HK/US/CRYPTO/FUND/CASH）聚合**报告货币市值占比**
- **And** 图例显示每个 market 的本地化名称 + 占比 %
- **And** 旁配「仅供参考，可能延迟」标识

### #5 币种敞口卡（Pro 徽章）

- 同 #4，但按 `Currency`（持仓原始币种）聚合报告货币市值占比；右上角 PRO 徽章

### #12 资产位置卡（Free）

- 按持仓的 `account / platform` 字段聚合占比；未填写归「未指定」分片；右上角无徽章

### #9 组合 vs 基准卡（Pro 徽章）

- **Given** 组合有 TWR 数据
- **When** 进入卡详情
- **Then** 顶部基准选择（默认 沪深300；可选 中证全指 / 自定义代码）
- **And** 竖向分组 BarChart：每组一个时段（1M/3M/YTD/1Y），组内两条 = 组合 TWR vs 基准收益
- **And** 文案中性陈述差值，**禁止**「应该换成基准 / 跑输就该卖」类引导

### #11 风险卡（Pro 徽章）

- 显示组合相对基准的历史 beta + 年化波动率（数字 + TrendChip）
- **必须**配「仅供参考，基于历史波动」；**禁止**「高风险 / 建议降仓」类引导

### #6 收益报告卡（Free 汇总 / Pro 明细）

- Free：组合总已实现 + 总未实现盈亏（报告货币）
- Pro：逐资产表格（持有量 / 已实现 / 未实现）+ 时段切换

### #7 贸易统计卡（Free）

- 交易笔数 + 涉及资产数（"5 / 5 个资产"）

---

## Data contract

新增 `packages/core` 纯函数（全部 Decimal、无 IO）：

```ts
// packages/core/src/insights/exposure.ts
export interface ExposureSlice {
  readonly key: string;
  readonly value: Decimal;
}
// 输入：已估值持仓（报告货币市值）+ 分组键提取器
export function aggregateExposure<T>(
  rows: ReadonlyArray<{ value: Decimal; group: T }>
): ReadonlyArray<{ group: T; value: Decimal; weight: Decimal }>; // weight = value / total

export function marketExposure(holdings: ValuedHolding[]): ExposureByMarket;
export function currencyExposure(holdings: ValuedHolding[]): ExposureByCurrency;
export function accountExposure(holdings: ValuedHolding[]): ExposureByAccount; // 空账户 → "__unspecified__"
```

```ts
// packages/core/src/insights/risk.ts（#11，依赖基准序列）
export function beta(portfolioReturns: Decimal[], benchmarkReturns: Decimal[]): Decimal;
export function annualizedVolatility(returns: Decimal[], periodsPerYear: number): Decimal;
```

- **输入**：来自现有估值链（`computeMarketValue` → 报告货币）。**不在录入时换算币种**（不变性 4）。
- **输出**：占比 weight 之和 = 1（property test 守护，允许末位 rounding 归并）。
- **Side effects**：无（纯函数）；卡片层用 TanStack Query 读现有 valuation。

---

## Constraints（不变性 / 合规）

- **Decimal everywhere** — 所有占比、beta、波动率用 `Decimal`，禁止 `number`（宪法 §3.1）。
- **币种永不预换算** — 敞口聚合读报告货币市值，原始币种保留（不变性 4）。
- **文案铁律**（宪法 §二）：
  - 「风险 / 组合表现 / 基准」卡**禁止**出现 建议买卖 / 应该调整 / 跑输就卖；只中性陈述。
  - 价格/净值/收益旁必须有「仅供参考，可能延迟」。
  - 「Good & Bad Decisions」（Stage 4）若落地，中文用中性词（**贡献/拖累** 或 **跑赢/跑输**），不译"坏决策"。
- **ADR 006** — 新 chart 经 `@arc/ui/charts` wrapper，业务代码不直接 import `heroui-native-pro`。
- **ADR 008** — 徽章/卡片用 soft token；accent 仅留给主行动与 focus ring。

---

## Out of scope

- 真实 entitlement / paywall 运行时门控（Stage 4 IAP 一并做）。
- 定价数字（仍"敬请期待"）。
- 费用卡（Locked decision #1，永久移除本期）。
- P/E 卡、最常用交易所卡（跳过）。
- Good & Bad Decisions（Stage 4）。
- AI 体检报告（Stage 5）。

---

## Test plan

- `packages/core/__tests__/insights-exposure.spec.ts` — fast-check property：占比 weight 求和 = 1；空持仓返回空；单持仓 weight = 1；Decimal 精度（`0.1+0.2` 类）。
- `risk.spec.ts` — beta 已知输入定值；同序列 beta = 1；零方差基准 → 定义化处理（返回 null/标注）。
- 手动验证：iOS / Web 双端卡片渲染；红涨绿跌切换；空态。

---

## 建议 Build order（依赖排序）

1. **【本 PR】Exposure 聚合（#4/#5/#12）** — 纯函数 + property test + 复用 `AllocationDonut`，零新图表、零 entitlement，最快落地的差异化卡。
2. `InsightTierBadge` 组件（PRO/PRO+ 视觉徽章，Stage 4 复用）。
3. 收益报告卡 #6（汇总 Free，明细 Pro）+ 贸易统计 #7（无图表）。
4. `BarChart` wrapper（Pro `bar-chart`）→ 解锁 PA #8 + benchmark #9。
5. `LineChart` 多序列 → 资产价值 #10。
6. 风险卡 #11（依赖基准序列 + beta）。
7. 配置偏离 Free/Pro 收口 #3 / #3p。

---

## Context bundle

Auto: `pnpm ctx:auto`（agent/hook）。Config: `.specify/feature-specs/stage-3/insights-enrichment-stage-3.repomix.json`
