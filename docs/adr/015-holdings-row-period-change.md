# ADR 015 — 持仓行 Period Change 算法

- **状态**: ⛔ **Superseded by [ADR 016](./016-holdings-return-and-entry-tiers.md)**（2026-05-27）
- **日期**: 2026-05-26（已接受 ~24h 后即在 dogfooding 中暴露多次加仓 baseline 被现金流污染的漏洞，由 ADR 016 全面取代）
- **作者**: BoyangJiao + Claude (Opus 4.7)
- **相关 ADR**: 014（趋势图算法 — True Historical）、009（Daily Snapshot）、011（多源 fallback）、**016（取代本 ADR）**
- **相关法则**: `.specify/data-model-invariants.md` Law 5（历史 ≠ 当下）

> **2026-05-27 supersession**：本 ADR 描述的「chart first-non-zero per-asset baseline → costBasis fallback → new-position」三档优先级在多次加仓场景下被 dogfooding 验证存在**现金流污染漏洞**（极端可显示 +800%）。**ADR 016 全面取代**为：持仓行 % = `costBasisReporting since-open` 固定单源，**不**随时间范围切换。Per-asset 周期分析下沉到 Asset Detail Page（asset-level TWR）+ Insights/盈亏分析模块。详见 [ADR 016 §决策 2](./016-holdings-return-and-entry-tiers.md#决策-2--持仓行--算法)。
>
> **保留本 ADR 文档**作为决策演化轨迹（chart-first 单源 → chart+cost-fallback → cost-only）的历史 record；不再作为活跃算法依据。

---

## TL;DR

Portfolio Tab 每个持仓行右下角的"变动" delta + percent，按以下**单一基线**优先级算：

```
1. chart 范围内该资产第一个非零历史价 × 当时持仓 × 当时汇率
   ↓ 拿不到时
2. 该资产的 costBasisReporting（since-position-open 语义）
   ↓ 也拿不到时（cost = 0 或资产从未在 chart 出现）
3. 显示"新建仓"badge，不显示 delta
```

每一档**同一基线驱动 delta 和 percent**，数学一致；不混用不同基线导致的 (delta, percent) 不匹配。

---

## 背景

### 之前迭代的痛点（按时间线）

| 版本               | 行为                                                                       | 问题                                                                                            |
| :----------------- | :------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------- |
| v0                 | `delta` 来自 `unrealizedPnL`，`percent` 来自 `unrealizedPnLPercent`        | 都从 cost basis 算，逻辑分支多但数学一致                                                        |
| v1（Stage 3 UAT）  | fallback 路径把 `delta` 和 `percent` 用不同来源拼接                        | (delta = -76.83, percent = -7.53%) 数学不一致                                                   |
| v2（ADR 014 配套） | 单一基线 = chart 第一个 snapshot 的 perAsset，否则 costBasisReporting      | 多资产场景下 chart 第一个 snapshot 经常缺少后买入资产 → 强制 fallback 到 cost → (C) 类用户全 0% |
| v3                 | 单一基线 = chart 所有 snapshot 扫描第一个非零，删除 cost fallback          | 数据源拿不到历史价时（Finnhub /candle 付费、AV 限流），baseline=current → 全 0%                 |
| **v4（本 ADR）**   | 单一基线优先级 = chart 历史 → costBasis → "新建仓"，**保留 cost fallback** | 任一档都返回数学一致的 (delta, percent)                                                         |

### 核心矛盾

持仓行的"变动"想同时回答两个问题：

1. **时段相关**："最近 1M 这只资产帮我赚/赔了多少？"
2. **跨时段持有 P&L**："自从我买入以来这只资产的盈亏？"

两个问题对应不同的 baseline：(1) 是 chart-windowFrom 时的市值，(2) 是 cost basis。**在大部分时段下 (1) 优先**，但当 (1) 不可用（chart 范围之外才买入 / 数据源拿不到历史价）时，**fall back 到 (2)** 仍然有信息量。

---

## 决策

### 算法（伪代码）

```ts
function resolvePeriodChange(
  assetId,
  valueReporting, // 当前市值（live valuation）
  periodBaselineByAsset, // chart 扫描全部点后得到的每资产首个非零值映射
  costBasisReporting // 当前持仓 × averageCost × 当前 FX
): HoldingPeriodChange {
  let baseline = periodBaselineByAsset?.get(assetId);
  if (!baseline || baseline.isZero()) {
    baseline = costBasisReporting && !costBasisReporting.isZero() ? costBasisReporting : undefined;
  }

  if (!baseline) return { kind: "new-position" };

  const delta = valueReporting.minus(baseline);
  const percent = delta.dividedBy(baseline).times(100);
  return { kind: "ok", delta, percent };
}
```

### `periodBaselineByAsset` 的语义（与 ADR 014 一致）

输入：chart 范围内的全部 `PortfolioSnapshotPoint`（snapshot DB + bootstrap True Historical 合成）。

输出：每个资产 → 第一个出现非零值的时点的 `valueReporting`。

```ts
function periodBaselineByAsset(points): Map<assetId, valueReporting> {
  for (point of points) {
    // 时间升序
    for ([assetId, value] of point.perAssetReporting) {
      if (!map.has(assetId) && !value.isZero()) {
        map.set(assetId, value);
      }
    }
  }
  return map;
}
```

为什么扫全部点（不是只取第一个 snapshot）：

- 多资产组合中，chart 的最早 snapshot 经常**早于**某些资产的首次买入日（例：1M 视图 windowFrom = 30 天前；用户 15 天前才买入某基金）
- 取第一个 snapshot 的 perAsset → 该资产 missing → fallback 到 costBasis
- 扫到该资产首次出现非零的时点（即真实建仓日）→ baseline = 那一天的市值 → delta 是真正的"自建仓以来"市场变化

### 数据源依赖（决定 fallback 频率）

| 数据源                            | 用途        | Free tier 历史价       | 影响                                                                                                                                |
| :-------------------------------- | :---------- | :--------------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| Finnhub `/quote`                  | US 当前价   | ✅                     | live valuation 正常                                                                                                                 |
| Finnhub `/stock/candle`           | US 历史价   | ❌ 付费                | 走 [packages/data-sources/src/adapters/us-price-adapter.ts](packages/data-sources/src/adapters/us-price-adapter.ts) → Alpha Vantage |
| Alpha Vantage `TIME_SERIES_DAILY` | US 历史价   | ✅ 限速 5/min、500/day | rate-limit 命中时 chart bootstrap 拿不到 US 历史价 → fallback 到 cost                                                               |
| Tushare 基金 NAV                  | CN 基金历史 | ✅ 有限                | 一般 OK                                                                                                                             |
| Frankfurter FX                    | 历史汇率    | ✅                     | 一般 OK，周末/节假日数据缺失 fallback 7 天前                                                                                        |

**实际表现**：当 AV 限速时，US 资产的 chart baseline 拿不到 → 行内显示"since position open"（cost fallback）。（B）类用户看到真实持仓 P&L；（C）类用户看到 0%（因为 cost ≈ current）。

---

## 与 ADR 014 的关系

| 维度                                  | ADR 014（chart）                        | ADR 015（row）                                             |
| :------------------------------------ | :-------------------------------------- | :--------------------------------------------------------- |
| Hero 总值 % 变动的 baseline           | chart 第一个**非零** total              | —                                                          |
| Holding row delta/percent 的 baseline | —                                       | chart 该资产第一个非零 perAsset → cost fallback → "新建仓" |
| 数据源                                | True Historical bootstrap + DB snapshot | 同 chart 数据源                                            |
| Law 5                                 | ✅ 不混用历史/当下                      | ✅ 同                                                      |

Hero 和 row 共享 chart 数据源；但 hero 看 total，row 看 per-asset。Hero 没有 cost fallback（总市值 cost = totalCostBasis，但 (C) 用户的 totalCostBasis ≈ current；fallback 没意义）；row **有** cost fallback（per-asset cost 至少能反映 "since open" 真实 P&L 在 B 类用户场景下）。

---

## 用户场景与显示效果

### B 类用户（真实历史交易，tradeDate 在过去，avgCost 是真实成本）

- 1M 视图：chart 30 天前有这个资产 → baseline = 30 天前市值 → delta 反映 1M 市场变化
- ALL 视图：chart 含整个持有期 → baseline = 首次出现的非零值 ≈ 首次买入日市值 → delta 是"持有总收益"
- 数据源失败：fallback 到 costBasis → delta 是"自建仓以来"P&L

### C 类用户（今天才录入，tradeDate = 今天 + avgCost = 今天 NAV）

- 1M 视图：chart 30 天前**没有**这个资产（computeHoldings filter 排除）→ scan 找到的第一非零 = 今天 live → baseline = current → delta ≈ 0
- ALL 视图：chart 首点也没有 → 同上 → 0
- 数据源失败：fallback 到 costBasis（= current）→ delta ≈ 0

**这是预期行为**，不是 bug。(C) 用户没给过去的历史信息，系统就只能反映"今天到现在"的变化（几乎为零）。详见 ADR 014 §四 "解法 1"。

### 数据源限速场景（US 资产，AV rate-limit）

- chart bootstrap 拿不到 US 历史价 → perAsset 不含该资产 → scan 找不到 baseline
- fallback 到 costBasisReporting → delta = current - cost → "since position open" 真实 P&L

---

## 不显示百分比的边界情况

| 场景                                     | delta                | percent                | UI            |
| :--------------------------------------- | :------------------- | :--------------------- | :------------ |
| baseline > 0                             | (current - baseline) | delta / baseline × 100 | "±¥XXX (Y%)"  |
| baseline = 0 / undefined / costBasis = 0 | —                    | —                      | "新建仓"badge |

绝不出现"delta 有数字但 percent = null"或反之的 ambiguous 状态。**单一基线、单一来源、双输出**。

---

## 不再讨论

- `delta` 来自 `unrealizedPnL`，`percent` 来自 `unrealizedPnLPercent` — v1 留下的数学不一致根因，已被单基线取代
- 只取 chart 第一个 snapshot 的 perAsset 作为基线 — 错过持有期晚于 windowFrom 的资产
- 完全删除 cost fallback — 数据源失败时让用户看一片 0% 不可接受
- 用 `dailyChangePercent` 作为 percent 显示 — 跟 delta 不同源，禁止

如要重新评估，需先**修订本 ADR 或 ADR 014**。

---

## 附录：实现位置

- `apps/mobile/src/lib/holdings-presenter.ts` — `resolvePeriodChange()`
- `apps/mobile/src/lib/queries/use-portfolio-value-snapshots.ts` — `periodBaselineByAsset()`
- `apps/mobile/src/lib/portfolio-chart-bootstrap.ts` — chart True Historical 算法（ADR 014）
- `packages/ui/src/finance/HoldingRow.tsx` — UI 渲染
- `packages/ui/src/finance/HoldingsTable.tsx` — 行容器
