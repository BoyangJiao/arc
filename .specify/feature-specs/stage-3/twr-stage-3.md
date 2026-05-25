# Feature: Time-Weighted Return (TWR) + Money-Weighted Return (MWR) algorithm (Stage 3 — Block D)

- **Status**: Accepted — **Phase 1 ✅ landed 2026-05-24** (4 commits `1da6437`/`e2399c4`/`3b71170`/`d467b6e` on `dev/stage-3`, ahead-of-origin; @arc/core 149/149 incl. 21 property tests). 14 resolved decisions (9 architecture + 5 UX/policy locked 2026-05-24 BoyangJiao approved A/A/A/A/A). Phase 2/3/4 pending.
- **Author**: Claude Opus 4.7 (draft + Phase 1 implementation)
- **Created**: 2026-05-24
- **Implements**: `.specify/feature-specs/stage-3/stage-3-roadmap.md` §Block D 第一项；`docs/development-plan.md` §Stage 3 算法层
- **Conforms to**: `.specify/constitution.md` (Decimal everywhere, transaction 不可变 — 5 大不变性), ADR 006 (`@arc/ui` layering — UI 接入), Block A/B/C 已稳定的真实多市场数据形态
- **Touches**: `packages/core` (new `returns/` module + ~25 property tests), `packages/ui/finance` (1 new card 显示 TWR + 时间段), `apps/mobile` (asset detail + Portfolio Tab + Insights 卡片三处接入 hook)
- **Does NOT touch**: schema / adapters / portfolios / RLS / cash transfer / Block C UI (仅在已有页面挂数字)
- **Depends on**: Block C ✅（真实多市场持仓 + 真实历史价 + 真实 `portfolio_value_snapshots` 30 天数据为 property test 输入）

---

## Why this feature exists

Stage 3 DoD 三条之一：**"TWR 数字与雪球 / 同花顺误差 < 1%（抽 3 个标的验证）"**。这是最 hard-edge 的 DoD —— 数字不对 = Stage 3 不通。

TWR (Time-Weighted Return) 与简单的"现在价值 / 总投入 - 1"区别：

- **简单 PnL**：被 cash flow 时点污染。比如年初投 $1000 涨到 $1200，4 月又投 $5000，年末值 $6500 —— 简单 PnL = (6500 - 6000) / 6000 = 8.3%，但其实管理人的"操作收益"是 ~20%（前期 20% + 后期持平），$1000 → $1200 阶段的 alpha 被 4 月大笔注资稀释了。
- **TWR**：把 cash flow 切成子区间，每段算 `(end - start) / start`，几何复合 = `(1+r1)*(1+r2)*...*(1+rN) - 1`。**与雪球 / 同花顺 / 蛋卷算法一致**，是 self-directed 投资者的标准收益率。

Block D 这条 spec 锁定 TWR 计算契约。后续 spec（Performance Attribution / Drawdown）会复用 TWR 的子区间收益。

MWR (Money-Weighted Return) = XIRR，是另一个角度（考虑 cash flow 大小 + 时间），适合"我自己定时定额到底赚没赚"。Stage 3 一并实施但默认显示 TWR；用户 settings 切 MWR 是 V1.0+ 议题。

---

## User journey (J15)

### J15a — Asset Detail TWR 三个时段

**Given** `/asset/US/AAPL` 详情页（已 Block C 实施）
**When** 进入详情页 + 时间段选 1Y
**Then** "我的持仓" 区下方新增一行 "1年 TWR：+18.42%"（gain 色）
**And** 切到 ALL（持有以来全程）→ TWR 重算
**And** 切到 1M → TWR 重算（如 1M 内无 cash flow，等价于简单 PnL）

### J15b — Portfolio Tab 顶部累计净值卡 + TWR

**Given** Portfolio Tab 顶部 PortfolioValueOverTimeCard（已 Block C 实施）
**When** 看时间段切到 YTD
**Then** card 头部右侧加一行 "YTD TWR：+12.34%"
**And** card 头部左侧仍是当前总值
**And** 切 1Y → 重算

### J15c — Insights 卡片仪表盘多 portfolio TWR

**Given** Insights Tab 3 张 per-portfolio card
**When** 默认时间段 = 1M
**Then** 每张卡显示 "1月 TWR：+X.XX%"（在偏离 % 旁边）
**And** 用户 settings 全局切到 "MWR 模式" → 全 app TWR 显示位置变 MWR（V1.0+ 议题，本 spec 不实施 settings，只让 hook 接口 ready）

---

## Resolved decisions

### 1. 算法 = TWR (Modified Dietz 简化版) + MWR (XIRR Newton-Raphson)

**TWR**：用 Modified Dietz 简化（每个子区间用 begin/end value，cash flow 在子区间边界发生 → 简化为 `(end - start) / start`）。子区间切分由 cash flow events 触发：

```
sub-period i:
  start_value  = value just BEFORE cash flow at t_i
  cash_flow    = ±X (deposit + / withdrawal -)
  end_value    = value just BEFORE next cash flow at t_{i+1}
  return_i     = (end_value - start_value) / start_value
                 # cash_flow 不进 numerator — 这是 TWR 关键

twr_total = (1+r_1) * (1+r_2) * ... * (1+r_n) - 1
```

参考 [GIPS standards 2020 §2.A.1](https://www.gipsstandards.org/) 简化形式。

**MWR (XIRR)**：解 `Σ CFi / (1 + r)^((t_n - t_i)/365) = 0`，r 用 Newton-Raphson 数值求解。初始猜测 = TWR；最多 100 次迭代；收敛阈值 1e-9。`@arc/core/returns/xirr.ts` 自己实现（不引第三方库 `xirr` —— decimal.js 兼容 + property test 友好）。

### 2. Cash flow events 定义

**Cash flow** = portfolio 层面的资金进出，不是 transaction 全集。具体：

| Transaction type               | 是 cash flow? | 说明                                                                                                                                                                                                                                              |
| :----------------------------- | :------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BUY / SELL 非 CASH 资产        | ❌            | 在 portfolio 内移动现金 ↔ 资产，不影响 portfolio 总值（手续费记 cost basis，不算 cash flow）                                                                                                                                                      |
| BUY / SELL CASH:USD/CNY/HKD    | **✅**        | 这是用户向 portfolio 注资 / 提现（如 SELL CASH:USD = 用户从 portfolio 取走 USD）                                                                                                                                                                  |
| DIVIDEND                       | ❌            | 已经在 portfolio 内（asset 派息进 CASH 余额）；总值不变（资产↓ + 现金↑）                                                                                                                                                                          |
| SPLIT                          | ❌            | 拆股 / 合股 / 红股 — 份额变价格变，总值不变                                                                                                                                                                                                       |
| **Transfer**（Block B 决策 1） | ❌            | 转出 portfolio A 同时转入 portfolio B → 单 portfolio 内是 cash flow，但**双 portfolio 合并视角下抵消**。Stage 3 TWR 默认 per-portfolio 计算，所以 transfer 在 A 和 B 各自看是 cash flow（A out / B in）。Stage 4 跨 portfolio 合并 TWR 时再处理。 |

**关键**：判定靠 `transaction.notes.startsWith("transfer-")` + `asset_id.startsWith("CASH:")`。

### 3. Value at point-in-time = `portfolio_value_snapshots` + 当日实时 fallback

Per-portfolio value at any historical date `d`：

1. **Optimal path**：`SELECT total_value, reporting_currency FROM portfolio_value_snapshots WHERE portfolio_id = X AND snapshot_date = d`（migration 0003 ✅）
2. **Fallback**：如果 `d` 那天没 snapshot（cron 偶尔丢一天 / portfolio 是新建的），用 `computeValuationAtDate(portfolio_id, d)` —— Block C `usePortfolioValuation` 的逻辑 + 历史 `price_snapshots` 拉对应日价 + 历史 `fx_rates`

**Today's value**：`portfolio_value_snapshots` 不一定有今天行（cron 23:00 UTC 跑）→ 用 live valuation（Block C 已有）。

### 4. 货币 — 全部以 portfolio.reporting_currency 计

TWR 单一货币算（避免跨币种 chain 的方向问题）。所有 cash flow + 期初期末 value 都按 portfolio reporting currency 取值；底层若为 USD asset + CNY portfolio，已由 Block C `useHoldingValuation` + Frankfurter 历史汇率换算。

**重要 invariant**：**计算 TWR 时用历史汇率，不用当下汇率**。`price_snapshots` 表 + `fx_rates` 表（已有）保证历史可追溯。Stage 3 自用阶段大部分日期 fx_rates 表 ECB 日终都有；缺日按"上一个有汇率的日期"前向填充（standard practice）。

### 5. 时段定义

| Range | 起始边界                                                                    |
| :---- | :-------------------------------------------------------------------------- |
| `1D`  | 昨天收盘 → 今天 live                                                        |
| `1W`  | -7 天 → 今天                                                                |
| `1M`  | -30 天                                                                      |
| `3M`  | -90 天                                                                      |
| `YTD` | 当年 1 月 1 日                                                              |
| `1Y`  | -365 天                                                                     |
| `ALL` | portfolio 第一笔 transaction `created_at` OR 最早 `tradeDate`（看 §决策 8） |

实现复用 Block C `rangeToWindow` helper（`apps/mobile/src/lib/time-range.ts`）。

### 6. Asset-level TWR vs Portfolio-level TWR

- **Asset-level TWR**（J15a 用）：单一 asset 视角，把"加仓" / "减仓"视作 cash flow。简化为 Modified Dietz：start_value = `shares * priceAt(t_start)`, cash_flow on each transaction = `shares_delta * priceAtTx`, end_value = `shares_currentAtEnd * priceAt(t_end)`。
- **Portfolio-level TWR**（J15b/c 用）：portfolio 总值视角，cash flow 按 §决策 2 判定。

两条路径都在 `@arc/core/returns/twr.ts` 实现，但导出两个函数：`computeAssetTwr` / `computePortfolioTwr`。

### 7. Decimal precision — 28 位（与 transactions 表 numeric 28,12 对齐）

所有中间计算用 `decimal.js` 默认精度（28 位）。`Decimal.set({precision: 28})` 在 `@arc/core/returns/index.ts` 顶部声明。XIRR Newton-Raphson 容差 1e-9 + max 100 iterations + 不收敛时 throw `ConvergenceError`（新 error type in `@arc/core/returns/errors.ts`）。

### 8. Asset-level "ALL" 起点 = 首笔 BUY 交易的 `tradeDate`（不是 `created_at`）

用户可能 2026-05-24 录入一笔 2024-03-15 的 BUY 历史交易（Block C 决策 8 `trade_date` 可改）→ "ALL" 应从 2024-03-15 算起，不是 2026-05-24。

`computeAssetTwr` 内部用 `MIN(tradeDate) WHERE asset_id = X AND type = 'BUY'` 作为 ALL 起点。

### 9. UI 显示

每个 TWR 数字旁边带：

- 时段 label（"1Y" / "YTD" 等，与 selector 一致）
- 数字本身（gain 红 / loss 绿，与 Settings 颜色 mode 一致 via `useBusinessClasses`）
- 旁边小字 "TWR ⓘ" —— tap ⓘ 弹 sheet "时间加权收益率（剔除入金时点影响）"（i18n string，符合宪法文案铁律）

---

## Locked 2026-05-24 (BoyangJiao approved A/A/A/A/A)

### 决策 10 — MWR Stage 3 不默认显示（A）

默认显示 TWR。`computeMwr` 接口 ready 可调，UI 不挂数字。MWR 接入 Settings switch 推到 V1.0+。

### 决策 11 — Asset 详情页 TWR 位置 = "我的持仓" 区底部联动（A）

复用 detail page 已有 segmented control，在"我的持仓"区下方加一行 "{range} TWR：±X.XX%"。

### 决策 12 — `portfolio_value_snapshots` 仅缺日时 fallback（A）

`valueAt(date)` 优先读 snapshot；某日缺失 → fallback `computeValuationAtDate`（Block C 已有）。

### 决策 13 — Property tests ≥ 20 是底线（A）

按 §"Property tests" 表分配 6+4+4+3+2+1 = 20。超出可加。

### 决策 14 — 雪球对标 = 手动抽样 3 标的 + 截图存档（A）

Phase 3 commit #7：3 标的（建议 1 CN + 1 US + 1 ETF/FUND 覆盖跨币种）≥ 6 月真实持仓，Arc TWR 误差 ≤ 1.0%。截图存档 `docs/dod-verification/twr-snowball-{ticker}-{date}.png`。不自动 fetch 雪球（L3 法务风险）。

<!-- 原 Open questions 5 条已 locked 全 A，决策 10-14 above；详细 trade-off 参考 git log -->

1. **MWR 是否 Stage 3 默认显示**
   - **(A) 默认 TWR，MWR 不显示（推荐）** — Stage 3 自用先验证 TWR 与雪球误差；MWR 接入 settings switch 是 V1.0+
   - (B) TWR + MWR 都显示（双数字）— 用户能比较；但 UI 拥挤 + 用户可能 confused
   - **推荐 A**

2. **Asset 详情页 "持有以来全程 TWR" 数字位置**
   - **(A) 在 "我的持仓" 区底部 + 时段 selector 联动（推荐）** — 复用已有 selector
   - (B) 单独一个 stats card 在 detail page 中间 — 信息层级清晰但 selector duplicate
   - **推荐 A**

3. **portfolio_value_snapshots fallback 触发频率**
   - **(A) 仅缺日时 fallback（推荐）** — 大部分日期有 snapshot；缺日才走 `computeValuationAtDate`
   - (B) 永远 fallback compute（不信任 snapshot） — 性能差
   - (C) 永远信任 snapshot（缺日 throw） — 用户体验差
   - **推荐 A**

4. **Property tests 数量目标**
   - **(A) ≥ 20 (推荐)** — 与 J9 rebalance 26 个看齐，DoD-hard 算法应高密度
   - (B) ≥ 15 — 最低
   - (C) ≥ 30 — TWR / MWR / Modified Dietz / XIRR Newton-Raphson 全角度
   - **推荐 A**（≥ 20 是底线，超出更好）

5. **雪球对标验证机制**
   - **(A) 手动抽样 3 个标的 + 截图存档（推荐）** — Stage 3 DoD 明确写"抽 3 个标的验证"；不写自动化
   - (B) 自动 fetch 雪球 API 自动 diff — 雪球反爬 + L3 法务风险
   - **推荐 A**

**Recommendation 组合**: A/A/A/A/A —— 全部最小路径 / 最高优先级覆盖。任一翻 B 会显著影响 commit chain。

---

## Data model

**零 schema 变更**。本 spec 完全基于已有表：

- `transactions` (Stage 1) — cash flow 判定 + asset-level shares delta
- `price_snapshots` (Stage 2) — 历史价
- `fx_rates` (Stage 1) — 历史汇率
- `portfolio_value_snapshots` (Stage 2 migration 0003) — per-day portfolio value
- `assets` — currency lookup

### `@arc/core` 新增类型

```ts
// packages/core/src/returns/types.ts
export interface TwrResult {
  readonly value: Decimal;        // 收益率，如 0.1842 = 18.42%
  readonly subPeriods: number;    // 子区间数（debug + UI tooltip）
  readonly startValue: Decimal;
  readonly endValue: Decimal;
  readonly netCashFlow: Decimal;  // 期间净 cash flow（debug）
}

export interface MwrResult {
  readonly value: Decimal;        // IRR
  readonly iterations: number;
  readonly converged: boolean;
}

export class ConvergenceError extends Error { ... }

// asset-level / portfolio-level input shapes
export interface AssetTwrInput {
  readonly assetId: string;
  readonly portfolioId: string;
  readonly from: Date;
  readonly to: Date;
  readonly transactions: ReadonlyArray<Transaction>;
  readonly priceAt: (date: Date) => Decimal;     // injected — adapter cache 已实现
}

export interface PortfolioTwrInput {
  readonly portfolioId: string;
  readonly from: Date;
  readonly to: Date;
  readonly transactions: ReadonlyArray<Transaction>;
  readonly valueAt: (date: Date) => Decimal;     // injected — wraps snapshot + live valuation
}
```

---

## Architecture

### File layout

```
packages/core/src/
└── returns/
    ├── index.ts                  ← barrel: computeAssetTwr / computePortfolioTwr / computeMwr
    ├── twr.ts                    ← Modified Dietz 简化 + sub-period chain
    ├── xirr.ts                   ← Newton-Raphson MWR solver
    ├── cash-flow.ts              ← detect cash flow events from transactions
    ├── types.ts                  ← interfaces
    └── errors.ts                 ← ConvergenceError

packages/core/__tests__/
├── twr.spec.ts                   ← unit tests (~10)
├── twr.property.spec.ts          ← property tests (≥ 20)
├── xirr.spec.ts                  ← XIRR unit + convergence
└── cash-flow.spec.ts             ← 判定逻辑表格驱动

apps/mobile/src/lib/queries/
├── use-asset-twr.ts              ← single asset TWR
└── use-portfolio-twr.ts          ← portfolio TWR

packages/ui/src/finance/
└── TwrInlineLabel.tsx            ← 复用组件 "1Y TWR：+18.42%"

apps/mobile/app/(tabs)/index.tsx          ← Portfolio Tab 头部接入 + ⓘ tooltip
apps/mobile/app/asset/[market]/[symbol].tsx ← Asset detail 接入
apps/mobile/src/components/PortfolioInsightCard.tsx ← Insights 卡片接入

packages/i18n/src/locales/{en,zh}.ts ← ~6 strings: "TWR" / "时间加权收益率" / "剔除入金时点影响" / "持有以来" / etc
```

### TWR algorithm sketch

```ts
// packages/core/src/returns/twr.ts (sketch)
export const computePortfolioTwr = (input: PortfolioTwrInput): TwrResult => {
  const events = detectCashFlowEvents(input.transactions, input.from, input.to);

  // 子区间边界 = [from, ...event_dates, to]
  const boundaries = [input.from, ...events.map(e => e.date), input.to]
    .sort((a, b) => a.getTime() - b.getTime());

  const subReturns: Decimal[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const startDate = boundaries[i]!;
    const endDate = boundaries[i + 1]!;

    // 子区间 start_value = startDate end-of-day（snapshot）+ 该日 cash flow（注入后）
    // 子区间 end_value = endDate end-of-day（snapshot 下一天 BEFORE cash flow）
    const startValue = input.valueAt(startDate);
    const endValue = input.valueAt(endDate);

    if (startValue.isZero()) continue;  // skip degenerate window
    const r = endValue.minus(startValue).div(startValue);
    subReturns.push(r);
  }

  // 几何复合
  const compound = subReturns.reduce(
    (acc, r) => acc.times(new Decimal(1).plus(r)),
    new Decimal(1),
  );
  const twr = compound.minus(1);

  return { value: twr, subPeriods: subReturns.length, ... };
};
```

### XIRR (MWR) sketch

```ts
// packages/core/src/returns/xirr.ts (sketch)
export const computeMwr = (
  cashFlows: ReadonlyArray<{ date: Date; amount: Decimal }>,
  initialGuess = new Decimal(0.1)
): MwrResult => {
  let r = initialGuess;
  const TOLERANCE = new Decimal("1e-9");
  const MAX_ITER = 100;

  for (let i = 0; i < MAX_ITER; i++) {
    const { npv, dnpv } = npvAndDerivative(cashFlows, r);
    if (npv.abs().lt(TOLERANCE)) {
      return { value: r, iterations: i, converged: true };
    }
    if (dnpv.isZero()) {
      throw new ConvergenceError("XIRR derivative zero — degenerate cash flow shape");
    }
    r = r.minus(npv.div(dnpv));
  }
  throw new ConvergenceError("XIRR did not converge in 100 iterations");
};
```

---

## UI contract

### Asset detail 接入（J15a）

复用 Block C `/asset/[market]/[symbol]` 页面：

```
┌─────────────────────────────────────────────────┐
│ ← AAPL                                          │
│ $189.50  +1.23% 今日                             │
│ [ 1D | 1W | 1M | 3M | YTD | 1Y ▼ | ALL ]        │
│ [ line-chart ]                                  │
│                                                 │
│ ── 我的持仓 ──                                  │
│ 持有       100 股                                │
│ 平均成本   $145.30                               │
│ 当前价值   $18,950                               │
│ 未实现盈亏 +$4,420 (+30.4%)                      │
│                                                 │
│ ⓘ 1Y TWR：+18.42%       ← 新增（联动上方时段）   │
└─────────────────────────────────────────────────┘
```

### Portfolio Tab 接入（J15b）

```
┌─────────────────────────────────────────────────┐
│ ▼ My Portfolio (CNY)                  ⚙  +     │
│ ¥125,300                                        │
│ YTD TWR：+12.34%        ← 新增（联动 area-chart 时段） │
│ [ area-chart ]                                  │
│ [ 1D | 1W | 1M ▼ | 3M | YTD | 1Y | ALL ]        │
│ ...                                             │
└─────────────────────────────────────────────────┘
```

### Insights 卡片接入（J15c）

每张 `PortfolioInsightCard` 在偏离 % 旁加一行 `1月 TWR：+X.XX%`（默认 1M，与 Block C 决策 10 一致）。

---

## Acceptance criteria (S3-AC-D.1.x — D.1 = TWR spec namespace)

### S3-AC-D.1.1 — 单一持仓无 cash flow，TWR = 简单 PnL

**Given** 用户 2026-01-01 BUY × 100 NVDA × $400 / 整年无新增
**When** 求 NVDA YTD TWR（当前 NVDA 价 $480）
**Then** TWR = (48000 - 40000) / 40000 = 20.0%
**And** `subPeriods === 1`（无 cash flow event）

### S3-AC-D.1.2 — 中途加仓不污染 TWR

**Given**

- 2026-01-01 BUY × 100 NVDA × $400（期初 $40,000）
- 2026-04-01 BUY × 50 NVDA × $500（中途加仓 $25,000）
- 2026-12-31 价 $600
  **When** 求 NVDA YTD TWR
  **Then** sub-period 1: ($500-$400)/$400 = 25%（前 3 个月，按 价格 chain）
  **And** sub-period 2: ($600-$500)/$500 = 20%（后 9 个月）
  **And** TWR = (1.25 \* 1.20) - 1 = 0.5 = 50.0%
  **And** 简单 PnL = (90000 - 65000) / 65000 = 38.46% **会显著不同**

### S3-AC-D.1.3 — Portfolio cash injection 不污染 portfolio TWR

**Given**

- 2026-01-01 portfolio value = ¥100,000
- 2026-06-30 portfolio value = ¥120,000 (无 cash flow)
- 2026-07-01 BUY CASH:CNY × 50,000（用户向 portfolio 注资）
- 2026-12-31 portfolio value = ¥180,000
  **When** 求 portfolio YTD TWR
  **Then** sub-period 1: 20% (Q1-Q2 持仓增长)
  **And** sub-period 2: 6% (cash 注资不进 numerator) [(180000-170000)/170000]
  **And** TWR = (1.20 \* 1.06) - 1 = 27.2%
  **And** 简单"PnL/总投入" = (180000 - 150000) / 150000 = 20% （受 cash injection 时点污染）

### S3-AC-D.1.4 — DIVIDEND / SPLIT 不算 cash flow

**Given** 持有 100 AAPL，期间 2026-05-01 DIVIDEND $50 + 2026-08-30 SPLIT 4-for-1
**When** 求 AAPL YTD TWR
**Then** 子区间数 = 1（既不切 DIVIDEND 也不切 SPLIT）
**And** asset_value(date) 自动反映 share count 变化 + 现金分红落入 CASH 余额

### S3-AC-D.1.5 — Transfer 在源 portfolio 看是 cash outflow

**Given** Portfolio A 2026-06-15 转出 $1000 → Portfolio B
**When** 求 A 的 YTD TWR
**Then** Portfolio A 的 transactions 含 SELL CASH:USD × 1000 with `notes='transfer-out-to-{B}'`
**And** TWR 算法识别该笔为 cash flow event（资金流出 A）
**And** sub-period 在 2026-06-15 切开

### S3-AC-D.1.6 — Portfolio reporting_currency 切换不重算原始数据

**Given** Portfolio reporting=CNY，持仓 100 AAPL ($) + 100 600519 (¥)
**When** 求 portfolio YTD TWR
**Then** valueAt 内部按 CNY 总值；AAPL 部分用历史 USD→CNY 汇率换算
**And** 切到 USD reporting → 重新计算（不在 cache 用 CNY 结果换算）

### S3-AC-D.1.7 — MWR (XIRR) 收敛在 100 iter 内

**Given** 多笔 cash flow（混合 deposit + withdrawal + 期末赎回）
**When** 求 MWR
**Then** Newton-Raphson 在 ≤ 100 iter 内收敛到容差 1e-9
**And** `iterations` ≤ 100；`converged === true`

### S3-AC-D.1.8 — MWR 无解时抛 ConvergenceError

**Given** 极端 cash flow shape（全部同一天 + 总和为 0 → IRR 无定义）
**When** 求 MWR
**Then** 抛 `ConvergenceError`
**And** UI 显示 "—"（不让 NaN 透到 UI）

### S3-AC-D.1.9 — 雪球抽样验证（DoD-hard）

**Given** 用户在雪球持有 3 个标的（如 600519 / NVDA / 510300）真实历史 ≥ 6 月
**When** 在 Arc 录入相同 transactions + 跑 TWR
**Then** Arc TWR vs 雪球 TWR **绝对误差 ≤ 1.0%**（per 标的）
**And** 截图存档到 `docs/dod-verification/twr-snowball-{ticker}-{date}.png`

### S3-AC-D.1.10 — 性能边界

**Given** Portfolio 含 50 资产 + 500 transactions + 跨 5 年 ALL 时段
**When** 求 portfolio TWR
**Then** `computePortfolioTwr` 同步耗时 ≤ 500ms（M1 Mac）
**And** Mobile UI 无明显卡顿（hook 在 react-query queryFn 内异步运行）

---

## Property tests (≥ 20，分布)

| 类别           | 数量 | 覆盖                                                                                                                                                                                      |
| :------------- | :--- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TWR 基础不变性 | 6    | 空 transactions → throw / 同一日 from=to → 0% / cash flow 不进 numerator / 几何复合顺序无关 (interpolative monotonicity) / sub-period count = cash flow events + 1 / start=end value → 0% |
| Cash flow 判定 | 4    | BUY 非 CASH 不算 / BUY CASH 算 / DIVIDEND 不算 / transfer notes 算（per-portfolio）                                                                                                       |
| Decimal 边界   | 4    | start=0 skip degenerate / 极小数 (1e-20) 不溢出 / 极大数 (1e15) 不溢出 / 负 TWR 也能 < -1 (= -100%)                                                                                       |
| XIRR 数值      | 3    | 简单两笔 cash flow IRR 闭式解吻合 / 多笔 cash flow Newton-Raphson 收敛 / 等价 cash flow shape XIRR 相同                                                                                   |
| 跨币种 + 汇率  | 2    | reporting CNY 持 USD 持仓 / fx_rates 缺日前向填充                                                                                                                                         |
| Performance    | 1    | 500 transactions input 算 TWR < 500ms                                                                                                                                                     |

详细 property 谓词放 `__tests__/twr.property.spec.ts`，用 fast-check `fc.assert(...{numRuns: 200-300})`。

---

## Implementation plan

> Routing: **Opus 主场全程**。算法 + property tests + Decimal 边界都是 Opus 路由 §七 明示。Cursor/Sonnet 接 UI 部分（Phase 3）。
> 估时：~10-12h Opus（算法 + tests）+ 5-7h Sonnet（UI hook 接入）= **~17h** 总。

### Phase 1 — Core algorithm (Opus 全程) ✅ **2026-05-24**

1. ✅ `1da6437` — `feat(core): returns/cash-flow.ts + types.ts + errors.ts` (19 cash-flow tests)
2. ✅ `e2399c4` — `feat(core): returns/twr.ts (Modified Dietz 简化 + sub-period chain)` (10 unit tests)
3. ✅ `3b71170` — `feat(core): returns/xirr.ts (Newton-Raphson) + 5 unit tests`
4. ✅ `d467b6e` — `test(core): twr.property.spec.ts (21 properties) + xirr damping fix` (property test X1 counterexample `r=-0.45` discovered Newton-Raphson singularity overshoot; fixed with damped step toward -0.999 floor)

Phase 1 DoD: `pnpm --filter @arc/core test` 149/149 ✅ · `pnpm typecheck` 6/6 ✅.

### Phase 2 — Mobile hooks (Sonnet/Cursor)

5. **`feat(mobile): use-asset-twr + use-portfolio-twr`** — TanStack hooks + valueAt/priceAt injection 从 Block C 已有 cache

   > **⚠️ Phase 2 实施关键 hint（Opus review 2026-05-25 落地）**：
   >
   > Phase 1 `cash-flow.ts` 用真实 `tradeDate` timestamp 作 boundary（tx entry 写入 `T12:00:00Z`，spec §决策 8）。`portfolio_value_snapshots` 写入时间 `T23:00:00Z`（per ADR 009）。两者**不直接对齐**。
   >
   > **Phase 2 `valueAt(date)` / `priceAt(date)` hook 必须做 day-rounding**：
   >
   > - 接受任意时分秒 timestamp
   > - 内部 floor 到当日（`date.toISOString().slice(0, 10)` 或 `Date.UTC(y, m, d)` 0 点）
   > - 用 day key 查 snapshot 表 / price_snapshots 表
   > - 返回该日 EOD value（含当日 CF；`twr.ts` header 注释已说明 boundary semantics）
   >
   > **不要**用 timestamp `>=` / `<=` 直接比较 snapshot.snapshot_date —— 12:00 UTC vs 23:00 UTC 会落到错误的 sub-period。
   >
   > 单测建议：mock `valueAt` 接收 `T12:00:00Z` / `T23:00:00Z` / `T00:00:00Z` 三种 timestamp，验证返回同一 EOD value。

6. **`feat(ui+mobile): TwrInlineLabel + Portfolio Tab 接入 + Asset detail 接入 + Insights 卡接入`** — 3 处 UI 挂数字

   > **错误处理**：`ConvergenceError` 从 `computeMwr` / 未来 attribution / drawdown 抛上来 → TwrInlineLabel 显示 "—"（**不**让 `NaN` 透到 UI；spec §S3-AC-D.1.8）。

### Phase 3 — 雪球对标验证（Opus + 用户）

7. **`docs(dod): twr 雪球对标验证记录`** — `docs/dod-verification/` 子目录 + 3 个标的截图 + Arc 算出值 + 误差 % 表格

### Phase 4 — 收尾

8. **`docs(spec+session-state)`** — TWR spec status → Accepted；bump Block D 1/3 complete

---

## Risks

| Risk                                               | Likelihood | Impact                           | Mitigation                                                                        |
| :------------------------------------------------- | :--------- | :------------------------------- | :-------------------------------------------------------------------------------- |
| 雪球 TWR 计算方式与我们 Modified Dietz 简化不一致  | Med        | DoD 误差 > 1% → fail             | Phase 3 抽样测；若误差大 → 切换到 daily compound（GIPS True TWR），spec amendment |
| `portfolio_value_snapshots` 数据缺日               | Med        | TWR 子区间断 → 跳过子区间 / 算偏 | §决策 3 fallback `computeValuationAtDate` + 前向填充                              |
| 历史 fx_rates 缺日（Frankfurter 周末 / 节假日）    | Med        | 跨币种 TWR 偏差                  | 前向填充策略；fx_rates 缺日时用上一个有汇率日                                     |
| XIRR Newton-Raphson 局部最小值 / 不收敛            | Low        | UI 显示 "—"                      | initialGuess = TWR；max 100 iter + ConvergenceError                               |
| Decimal precision 28 位不够（极长时段 + 多次复合） | Low        | 误差累积                         | property test 验证；必要时 `Decimal.set({precision: 40})` 局部提升                |
| Property tests fast-check 概率漏 edge case         | Low        | DoD 未触发但生产踩坑             | numRuns ≥ 200 + 关键 invariant 加 `fc.example` 锁特定输入                         |

---

## Verification checklist before merging back to `dev/stage-3`

- [ ] All S3-AC-D.1.1–D.1.10 pass
- [ ] `pnpm typecheck` 6/6 ✅ / `pnpm lint` 6/6 ✅ / `pnpm test` ✅ 含 ≥ 20 new property tests on TWR + ≥ 5 unit tests on XIRR
- [ ] **雪球对标 3 个标的误差 ≤ 1.0%**（截图存档 `docs/dod-verification/`）
- [ ] Performance：500 transaction × 5 年 ALL TWR < 500ms（M1）
- [ ] `session-state.md` bump (TWR spec ✅；next = PA / Drawdown specs)

---

## Hand-off

- **Implementation owner**:
  - Phase 1 (commits #1-4 算法 + property tests) — **Opus 主场**
  - Phase 2 (commits #5-6 hooks + UI 挂数字) — Sonnet/Cursor
  - Phase 3 (commit #7 雪球对标) — 用户 + Opus 协作
- **Review owner**: Opus（每个 commit）
- **External dependency**:
  - 雪球账号 + 真实持仓 ≥ 6 月（用户准备 3 个标的）
  - Phase 1 完成后用户在 Arc 真实录入对应 transactions（Block C tx entry 已支持）
- **Blocking spec**: 无 —— PA / Drawdown 待 TWR 收尾后起，复用 sub-period 收益

---

## Next after this spec

`performance-attribution-stage-3.md`（复用 TWR sub-period） + `drawdown-stage-3.md`（基于 `portfolio_value_snapshots` 时序）。两个 spec 在本 spec Accepted 之后下个回合起。
