# Feature: Drawdown analysis (max drawdown + underwater curve + recovery) — Stage 3 Block D

- **Status**: Accepted — 7 resolved decisions (5 architecture + 2 UX locked 2026-05-24 BoyangJiao approved A/A)
- **Author**: Claude Opus 4.7 (draft) — review/accept pending
- **Created**: 2026-05-24
- **Implements**: `.specify/feature-specs/stage-3/stage-3-roadmap.md` §Block D 第三项
- **Conforms to**: `.specify/constitution.md` (Decimal everywhere), ADR 006
- **Touches**: `packages/core/returns/` (~1 file + ~6 property tests), `packages/ui/finance` (1 new chart card), `apps/mobile` (Insights Tab + Portfolio Tab 接入)
- **Depends on**: `portfolio_value_snapshots` 表（Stage 2 migration 0003）+ Block C `usePortfolioValueSnapshots` hook

---

## Why this feature exists

Drawdown 是 self-directed investor 的"风险感"标尺：

- "我最多亏过多少？" = max drawdown
- "目前离 peak 还差多远？" = current drawdown
- "上次 peak 多久前？" = days since peak / recovery period

Stage 3 自用 4 周 + 经历一次回调，用户最关心的就是"我自己亏得多吗"。这条 spec 用最小算法 + 最小 UI 落地。

参考雪球 / Delta 的 "最大回撤" 指标 + underwater plot（雪球称"水下时长"）。

---

## User journey (J17)

### J17a — Portfolio Tab 卡片角落 small stat

**Given** Portfolio Tab 顶部 PortfolioValueOverTimeCard（Block C）
**When** 时段切 1Y
**Then** card 右下角小字 "1Y 最大回撤 -8.3%"（red 色，与 finance color mode 一致）
**And** tap → 弹 sheet 详情（J17b）

### J17b — 回撤详情 sheet

**Given** 用户 tap 上方 stat
**When** sheet 弹起
**Then** 显示：

- "最大回撤 -8.3%"（大数字）
- "Peak 日期 2026-03-15"
- "Trough 日期 2026-04-22"
- "持续 38 天"
- "Recovery 日期 2026-05-10" 或 "尚未恢复 / 已水下 X 天"
- Underwater curve（area-chart 显示 `(value_t - running_max_t) / running_max_t` 时序）
- ⓘ "回撤数据基于 daily snapshot；intraday 低点未计入"

---

## Resolved decisions

### 1. 算法 = 标准 running-max + underwater series

```
running_max[0] = value[0]
for d in 1..N:
  running_max[d] = max(running_max[d-1], value[d])
  drawdown[d]    = (value[d] - running_max[d]) / running_max[d]   # ≤ 0

max_drawdown = min(drawdown[0..N])   # 最负的值
trough_date  = argmin(drawdown)
peak_date    = max running_max date BEFORE trough_date
recovery_date = first d AFTER trough where value[d] >= running_max[trough]
                (若不存在 → null，表示 "尚未恢复")
```

### 2. 数据源 = `portfolio_value_snapshots`（per-day）

Stage 3 自用阶段 cron 23:00 UTC 每天写一行 snapshot。Drawdown 直接读这张表 + 当日 live valuation 补今天行。缺日（cron 偶尔丢一天）用上一日 snapshot value（保守填充，不影响 max drawdown 求值）。

### 3. Reporting currency 与 portfolio 一致

无跨币种问题（`portfolio_value_snapshots.total_value` 已是 reporting currency）。

### 4. UI 接入位置 = Portfolio Tab + Insights 卡片角落小字

不开独立路由。Portfolio Tab area-chart card 右下角 + Insights per-portfolio card 右上角各显一处。tap 弹 sheet 看详情。Block C `@arc/ui/charts/AreaChart` 复用画 underwater。

### 5. 时段 = 与 TWR / PA 一致的 segmented selector

`1M / 3M / YTD / 1Y / ALL`（无 1D / 1W —— 短时段回撤无意义）。**默认 1Y**（不是 TWR 的 1M）—— 回撤是长尺度风险，1M 通常 noise > signal。

---

## Locked 2026-05-24 (BoyangJiao approved A/A)

### 决策 6 — "水下时长"显示在回撤详情 sheet 内（A）

Portfolio Tab card 角落 + Insights card 角落各显一行 "{range} 最大回撤 -X.X%"（red 色，tap 弹 sheet）。sheet 内才详细显示 Peak / Trough / 持续天数 / Recovery / underwater chart。不在 card 直接 inline 显示 "已水下 X 天"。

### 决策 7 — 无 snapshot 数据 fallback = 显示 "—" + 引导（A）

Portfolio 历史 < 7 天 snapshots → `computeDrawdown` 返回 `null` → UI 显示 "—" + 引导文案 "需 ≥ 7 天历史数据"。**不**实时算 N 天回填（重 + 历史价数据缺失时也算不出）。

<!-- 原 Open questions 2 条已 locked 全 A，决策 6-7 above；详细 trade-off 参考下方 history -->

## Open questions (locked above, kept for history)

1. **"水下时长" 单独显示 vs 回撤分析 sheet 内**
   - **(A) sheet 内显示（推荐）** — Stage 3 自用阶段 1 个 stat 数字（max DD %）顶部 + sheet 看详情够用
   - (B) Portfolio Tab card 直接 inline 显示 "已水下 X 天" — 信息密度高但视觉重
   - **推荐 A**

2. **没有 portfolio_value_snapshots 数据时 fallback**
   - **(A) 显示 "—" + 引导 "需 ≥ 7 天历史数据"（推荐）** — Stage 3 dev 第一周用户的 portfolio 还没积累 snapshot
   - (B) 实时算 N 天回填 snapshot — 重；且没有历史价数据时也算不出
   - **推荐 A**

**Recommendation 组合**: A/A

---

## Data model

零变更。仅读 `portfolio_value_snapshots`。

```ts
// packages/core/src/returns/drawdown.ts
export interface DrawdownResult {
  readonly maxDrawdown: Decimal;       // ≤ 0
  readonly peakDate: string;            // ISO
  readonly peakValue: Decimal;
  readonly troughDate: string;
  readonly troughValue: Decimal;
  readonly recoveryDate: string | null;  // null = 尚未恢复
  readonly durationDays: number;        // peak → trough
  readonly underwaterSeries: ReadonlyArray<{ date: string; drawdown: Decimal }>;
  readonly currentDrawdown: Decimal;    // most recent date's drawdown (≤ 0)
}

export const computeDrawdown = (input: {
  snapshots: ReadonlyArray<{ date: string; value: Decimal }>;  // sorted asc
  from: Date;
  to: Date;
}): DrawdownResult | null;   // null if < 7 days data
```

---

## Architecture

```
packages/core/src/returns/drawdown.ts          ← computeDrawdown
packages/core/__tests__/drawdown.spec.ts       ← unit (~5)
packages/core/__tests__/drawdown.property.spec.ts ← property (~6)

apps/mobile/src/lib/queries/use-drawdown.ts    ← TanStack hook 包装
packages/ui/src/finance/DrawdownDetailSheet.tsx ← bottom sheet

apps/mobile/app/(tabs)/index.tsx               ← Portfolio Tab card 角落接入
apps/mobile/src/components/PortfolioInsightCard.tsx  ← Insights card 角落接入

packages/i18n/src/locales/{en,zh}.ts            ← ~6 strings
```

---

## Acceptance criteria (S3-AC-D.3.x)

### S3-AC-D.3.1 — 单调上涨 portfolio：max drawdown = 0

**Given** 30 天 snapshots 单调递增 (100, 101, 102, ..., 129)
**When** 求 drawdown
**Then** `maxDrawdown.eq(0)`, `recoveryDate === peakDate`（trivially recovered immediately）

### S3-AC-D.3.2 — V 字回调：max DD 是回调底

**Given** [100, 110, 120, 100, 90, 95, 105, 130]
**When** 求 drawdown
**Then** `peakValue.eq(120)`, `troughValue.eq(90)`
**And** `maxDrawdown.eq(-0.25)` (= (90-120)/120)
**And** `recoveryDate` 对应 value=130 那天（≥ 120 即恢复）

### S3-AC-D.3.3 — 尚未恢复

**Given** [100, 120, 110, 105, 108]（最后一天没回到 120）
**Then** `recoveryDate === null`
**And** `currentDrawdown.eq((108-120)/120)`

### S3-AC-D.3.4 — 数据 < 7 天 → null

**Given** snapshots 只有 5 天
**When** computeDrawdown
**Then** 返回 `null`（UI 显示 "—"）

### S3-AC-D.3.5 — Underwater series 长度 = snapshots 长度

**Given** 30 天 snapshots
**Then** `underwaterSeries.length === 30`
**And** 每个 entry `drawdown ≤ 0`

### S3-AC-D.3.6 — 时段过滤

**Given** Portfolio 有 2 年 snapshots
**When** time range = 1M
**Then** `computeDrawdown` 内部按 from/to 切片 snapshots
**And** max DD 是过去 30 天内的最大回撤（可能比 ALL 时段小）

---

## Property tests (~6)

| 类别              | 数量 | 覆盖                                                               |
| :---------------- | :--- | :----------------------------------------------------------------- |
| 单调性            | 2    | 单调递增 → DD=0 / 单调递减 → DD = (end-start)/start                |
| Idempotent + 边界 | 2    | 重复同 input 结果一致 / underwater 长度 == snapshots 长度          |
| 决定性            | 2    | snapshots 顺序乱序传入 → 函数内 sort → 结果不变 / Decimal 精度边界 |

---

## UI contract

### Portfolio Tab card 角落

```
┌─────────────────────────────────────────────────┐
│ ¥125,300                                        │
│ YTD TWR：+12.34%                                 │
│ [ area-chart ]                                  │
│ [ 1D | 1W | 1M | 3M | YTD | 1Y ▼ | ALL ]        │
│                                                 │
│                        1Y 最大回撤 -8.3% →      │ ← 新增（tap 弹 sheet）
└─────────────────────────────────────────────────┘
```

### Detail sheet

```
┌─────────────────────────────────────────────────┐
│             — 1Y 回撤分析 —                       │
│                                                 │
│           最大回撤   -8.3%                        │
│                                                 │
│  Peak     2026-03-15   ¥130,000                 │
│  Trough   2026-04-22   ¥119,210                 │
│  持续     38 天                                  │
│  恢复     2026-05-10                             │
│                                                 │
│  ┌─────────────────────────────────────────────┐│
│  │ [Underwater area chart, all values ≤ 0]    ││
│  │                                            ││
│  │  ─────────────────────                     ││
│  │       ╲      ╱                              ││
│  │        ╲    ╱                               ││
│  │         ╲__╱                                ││
│  └─────────────────────────────────────────────┘│
│                                                 │
│ ⓘ 基于 daily snapshot；intraday 低点未计入        │
└─────────────────────────────────────────────────┘
```

---

## Implementation plan

> Routing: Opus 算法 / Sonnet UI / 估时 ~5h

1. **`feat(core): returns/drawdown.ts + 5 unit tests + 6 property tests`** — Opus
2. **`feat(ui): DrawdownDetailSheet + Portfolio Tab + Insights card 接入`** — Sonnet
3. **`feat(mobile): use-drawdown hook`** — Sonnet
4. **`docs(spec+session-state)`** — Block D 3/3 complete = Block D 全收

---

## Risks

| Risk                                                   | Likelihood | Impact                    | Mitigation                                                |
| :----------------------------------------------------- | :--------- | :------------------------ | :-------------------------------------------------------- |
| `portfolio_value_snapshots` 缺日导致 underwater 不平滑 | Med        | UI underwater 曲线 jagged | 前向填充（用上一日 value）；不行就 sheet 显示数据点数 + ⓘ |
| 自用阶段 < 7 天 → 永远显示 "—"                         | Cert       | UI 第一周空               | spec §决策 5；用户接受（自用 = 走着走着才有数据）         |
| Decimal 累积误差                                       | Low        | DD% 偏 0.01%              | property tests + 直接读 snapshot value（不复合）          |

---

## Hand-off

- **Implementation owner**: Opus 算法 / Sonnet UI
- **Depends on**: 无新依赖（snapshots + Block C 已 ready）
- **DoD-critical**: 否（DoD 仅指 TWR <1%；drawdown 是补充指标）

---

## Block D 完成 = Stage 3 算法层全 ready

后续 = Block E（features polish + Inbox / AI / 订阅占位 / 数字脱敏 / 价格异动）+ Block F1（UX redesign sprint based on accumulated pain）+ Block F2（CSV import/export）。Stage 3 DoD 4 周自用 starts after Block C 收尾 + Block D 真实跑得通。

---

## Context bundle

```bash
pnpm ctx:feature drawdown
```

Config: `.specify/feature-specs/stage-3/drawdown.repomix.json`
