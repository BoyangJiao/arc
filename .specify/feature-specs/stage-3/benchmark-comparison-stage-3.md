# Feature: 指数对标（Benchmark Comparison）— Stage 3 Block D

- **Status**: **Accepted — all decisions locked 2026-06-17 (BoyangJiao), incl. D4 = per-bucket TWR** — ready for a focused build session
- **Author**: Claude Opus 4.8
- **Created**: 2026-06-16 · **Finalized**: 2026-06-17
- **Stage**: 3 — Block D
- **Implements**: `insights-enrichment-stage-3.md` §卡片 #9（「组合 vs 基准」），落在 **投资组合表现** section
- **Name**: **指数对标**（`insights.benchmark.*`）— 中性、合规安全（不暗示"应该跑赢/调仓"）
- **Depends on**: `twr-stage-3.md`（per-bucket TWR）、`BarChart` wrapper（已建，支持分组柱）、Tushare client（Block A）
- **Conforms to**: 宪法 §3.1（Decimal）、§二（无建议文案）、ADR 006（`@arc/ui` charts + data-sources adapter）、**ADR 007**（真实基准数据，无 mock）、data-model-invariants §4/§5（币种 / 历史≠当下）

---

## Goal

在「投资组合表现」section 加一张 **指数对标** 卡 → 详情页：把组合在 **月/季度/年** 日历分桶上的回报率，与 **用户选择的 1–2 个指数基准** 并排对比（分组竖向柱），让用户直观看到「相对大盘/指数，我这段时间表现如何」。差异化：中国相关基准（沪深300/恒生），不只 SPX。

参考 Delta「投资组合表现」截图的 UX pattern（分组柱 + 基准 chips + ⓘ 信息），但**料用 Arc 的**（TWR + 真实指数行情 + 多币种）。

---

## Locked decisions（2026-06-17）

| #       | 决策         | 锁定值                                                                                                                                              | 备注                                                                                                                 |
| :------ | :----------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------- |
| **D1**  | 模块名       | **指数对标**                                                                                                                                        | 中性合规；i18n `insights.benchmark.*`                                                                                |
| **D2**  | 落点         | **投资组合表现** section 内 inline 卡 → `/insights/benchmark` 详情页                                                                                | 与 资产价值 并列；卡为入口，详情承载 toggle/chips/info                                                               |
| **D3**  | 分桶         | **日历 月/季度/年**（复用 `SegmentToggle`），取最近 N 桶                                                                                            | 对齐 Delta 截图 + 已建的 trade-stats 同款 toggle（**不**用 1M/3M/YTD/1Y 滚动窗）                                     |
| **D4**  | 组合回报口径 | **per-bucket TWR**（时间加权，已确认 ✅ 2026-06-17）                                                                                                | 见下方「D4 详解」——与 Asset Detail/组合 TWR 一致，方法论正确；**否决简单回报率**（含期内现金流会虚增、误导且涉合规） |
| **D5**  | 基准回报口径 | **指数价格回报**（`close_end/close_start − 1`，按交易日对齐窗口）                                                                                   | 价格回报（非全收益）；index_daily/global close                                                                       |
| **D6**  | 多基准       | **组合 + 最多 2 个基准**（chips 切换，每组最多 3 柱）                                                                                               | 对齐 Delta「最多 2 个其他基准」；组合柱常显                                                                          |
| **D7**  | 基准清单     | 沪深300 `000300.SH` · 中证500 `000905.SH` · 标普500 `SPX`(index_global) · 恒生 `HSI`(index_global) · 纳指100 `IXIC`/`NDX`；**自定义代码 = Phase 2** | 默认按报告币种：CNY→沪深300、USD→标普500、HKD→恒生                                                                   |
| **D8**  | 选择持久化   | **本地 zustand pref（AsyncStorage），按 portfolioId 键控**                                                                                          | 不加 DB migration；后续要跨设备同步再升列                                                                            |
| **D9**  | 数据         | data-sources 新增 **index-series adapter**（Tushare `index_daily` CN + `index_global` SPX/HSI），typed interface + 缓存（仿现有 price adapter）     | 业务/core 不直接 fetch（ADR 006 §3.4）；crypto-only 组合 → 「无合适基准」空态                                        |
| **D10** | Beta         | **不在本模块**——指数对标只做回报对比                                                                                                                | beta 归 `/insights/risk`（仍 deferred，待本 adapter 落地后单独加）                                                   |
| **D11** | 文案         | 严格中性，仅供参考；**禁止**「跑输就该换成基准/应调整」类引导（宪法 §二）                                                                           | ⓘ 信息沿用 Delta 解释口径但去掉建议色彩                                                                              |

### D4 详解（唯一需 BoyangJiao 拍板的口径）

Delta 用「简单回报率 = 净回报 ÷ 净存款」。**问题**：与价格指数对比时，期内有买入/转入会让简单回报率虚高 —— 用户定投越多越"显得跑赢指数"，既不准也可能误导（合规风险）。
**推荐 = per-bucket TWR**：每个日历桶内按日收益几何连乘，剔除现金流时点，与指数价格回报同口径可比。Arc 已有 TWR 机制（`twr-stage-3`），按桶窗口跑即可。**这是 Arc 相对 Delta 的"更正确"差异点。**

---

## Data contract

```ts
// packages/data-sources — NEW typed interface (ADR 006)
interface IndexSeriesAdapter {
  // EOD closes for an index code over [from,to]; cached like price series.
  fetchIndexCloses(
    code: string,
    from: string,
    to: string
  ): Promise<ReadonlyArray<{ date: string; close: Decimal }>>;
}
```

```ts
// packages/core/insights/benchmark.ts (pure, Decimal)
// 桶内指数回报 = (close_end − close_start)/close_start，按交易日对齐组合窗口
export function bucketReturn(
  closes: ReadonlyArray<{ date: string; close: Decimal }>,
  from: string,
  to: string
): Decimal | null;
// 组合 per-bucket TWR 复用 twr 模块（按桶窗口）
```

- **币种**：指数以自身币种收益率（%）对比，不做币种换算（回报率是无量纲百分比，规避不变性 §4）。
- **对齐**：基准窗口 = 组合该桶的首末交易日；非重叠日期跳过。
- **退化**：桶内 <2 个点 / 无指数数据 → 该桶基准柱缺省（不画），不报错。

---

## UI

- **投资组合表现 section**：资产价值卡下方加 **指数对标入口卡**（Pro+ 徽章，mini 分组柱预览 or 标题 + chevron）→ `/insights/benchmark`。
- **详情页 `/insights/benchmark`**：`SegmentToggle`(月/季度/年) + 分组 `BarChart`（每桶：组合 + 选中基准，±，复用 chart token 配色）+ 底部基准 chips（组合常显 + ≤2 基准可选，色描边）+ ⓘ 信息 + 中性 disclaimer。
- **空态**：无 TWR / crypto-only → 「暂无可对比的基准」。

---

## Build order

1. **index-series adapter**（Tushare `index_daily` + `index_global`）+ registry + 缓存 + parse/cache 单测（仿 price adapter）。
2. **core**：`insights/benchmark.ts`（`bucketReturn` + 桶窗口对齐）+ per-bucket TWR 复用 + property tests（同序列→差值0；缺数据→null；Decimal 精度）。
3. **hooks**：`useBenchmarkSeries`（TanStack Query，按选中基准）+ 本地 pref store（D8）。
4. **UI**：详情页 `/insights/benchmark` + 投资组合表现入口卡 + i18n（zh/en，含 ⓘ/disclaimer）。
5. 默认基准按报告币种；Phase 2 = 自定义代码 + beta（回 risk 页）。

## Test plan

- core `bucketReturn`：已知 fixture；同窗口同序列差值=0；缺/少点→null；Decimal（`0.1+0.2`）。
- adapter：parse + cache（mirror Tushare price adapter）。
- 手动：切 toggle/基准 chip 重取；中性文案；红涨绿跌；iOS/Web；crypto-only 空态。

## Out of scope

- 混合/多指数加权基准、自定义代码（Phase 2）、beta（回 risk 页）、intraday、指数全收益（用价格回报）。
