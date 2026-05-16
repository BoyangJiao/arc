# Data Model Invariants

> 5 immutability laws. Violation of any law is a P0 bug.

Formal version of `CLAUDE.md §3.2`. Encoded in `packages/core/src/domain/types.ts`
as `readonly` field modifiers, and verified by property-based tests in
`packages/core/__tests__/`.

---

## Law 1 — Asset ID is Immutable

```
Asset.id = `{market}:{symbol}`        e.g. "US:AAPL", "CN:600519", "CRYPTO:btc"
```

- 一经写入永不修改
- 任何"修正"通过新增 ADJUSTMENT 交易实现，留下审计痕迹
- Asset.id 是数据库外键的稳定锚点 — 修改它会破坏所有引用

**TypeScript enforcement**:

```ts
export interface Asset {
  readonly id: string; // ← readonly modifier
  // ...
}
```

**Property test** (`packages/core/__tests__/asset-id-stable.spec.ts`):

- `composeAssetId(market, symbol)` 必须是纯函数
- `parseAssetId(composeAssetId(m, s))` 必须 round-trip
- 不允许在运行时通过任何方式修改 `Asset.id`

---

## Law 2 — Single Source of Truth (持仓 = Σ 交易)

```
holdings = computeHoldings(transactions)
```

- 持仓数据**永远不直接存储为权威值**
- 数据库只存 transactions（源真相）；holdings 是派生（read-time computed 或 cached snapshot）
- 不允许 UI 编辑 holding.shares 字段（必须通过新增 transaction 实现）

**TypeScript enforcement**:

- `Holding` 是只读 interface，不导出 mutation 方法
- `computeHoldings(transactions: readonly Transaction[])` 是纯函数

**Property test** (`packages/core/__tests__/holdings-pure.spec.ts`):

- 同一输入永远同一输出
- `computeHoldings([])` 返回空数组
- 任何 transaction 改变都通过 `computeHoldings()` 透传
- BUY + SELL 同 asset 同 shares 同价 → holding shares 为 0（自动过滤）

---

## Law 3 — Adapter Abstraction

```
business code → packages/data-sources/interfaces.ts → adapter (alphavantage / tushare / coingecko)
```

- 业务代码只接触统一接口：`PriceAdapter`, `FxAdapter`, `FundNavAdapter`
- 看不到任何具体厂商（alphavantage / tushare / coingecko / exchangerate.host）
- 厂商替换时，业务代码零改动；只在 `packages/data-sources/adapters/` 内做替换

**TypeScript enforcement**:

- `interfaces.ts` 定义 `PriceAdapter` / `FxAdapter` / `FundNavAdapter` 接口
- adapters/ 目录下每个文件实现这些接口
- 业务代码 `import` 自 `packages/data-sources`，不直接引用具体厂商模块

**Static check** (Stage 2 加 ESLint rule):

- 禁止业务代码 `fetch(/.*alphavantage.*/)` 或 `fetch(/.*tushare.*/)` 等

---

## Law 4 — Currency Preservation

```
storage: 原始币种                      e.g. transaction.currency = "USD"
display: 报告币种 × 实时汇率换算         computeMarketValue(holding, quote, fx, reportingCurrency)
```

- 资产录入时保留原始币种
- 显示时按用户报告货币换算
- **存储中绝不预先换算**
- Reporting currency 切换时只重算显示，不改任何存储数据

**Why**:

- 历史汇率会随时间变化；预先换算会丢失原始事实
- 用户切换报告货币时，需要用**当前汇率**重算（不是历史汇率）
- 例外：tax-purpose 历史快照（如年度报告），用**当时汇率**

**TypeScript enforcement**:

- `Transaction.currency: Currency` 是 required field
- `computeMarketValue(holding, quote, fx, reportingCurrency)` 返回 `MarketValuation`，含 `nativeCurrency` + `reportingCurrency` + `fxRateUsed` 三字段供审计

**Property test** (`packages/core/__tests__/fx-roundtrip.spec.ts`):

- `convert(amount, USD, CNY) → convert(_, CNY, USD)` 误差 < 0.01%
- `convert(amount, X, X)` 返回原值（同币种短路）

---

## Law 5 — History ≠ Current

```
Historical valuation: 历史价格 × 历史汇率
Current valuation:    最新价格 × 最新汇率
Never mix.
```

- 历史净值快照（`portfolio_value_snapshot` 表）用**当时**的价格和汇率
- 当前净值用**最新**的价格和汇率
- 混用 → P0 bug（TWR / MWR 计算会严重失真）

**TypeScript enforcement**:

- `PriceQuote.asOf: string` (ISO 8601) 必须 required
- `FxRate.asOf: string` 必须 required
- `MarketValuation.priceAsOf` + `fxAsOf` 必须 required，便于审计

**Property test** (`packages/core/__tests__/twr-historical.spec.ts` — Stage 3):

- 用同一组持仓，对比"用当前价回算历史" vs "用历史价计算历史"应**不相等**
- TWR 计算必须使用每个时点的历史快照，不能用当前快照插值

---

## Cross-cutting: Decimal precision

虽然不在 5 大不变性内，但与之同等重要：

- 所有数值字段必须 `Decimal`，不允许 `number`
- 详见 `constitution.md` §Code Constraints §Money & precision
- Property test 覆盖：`packages/core/__tests__/decimal.spec.ts`

---

## Why these laws (rationale)

| Law                        | If violated, what breaks                             |
| :------------------------- | :--------------------------------------------------- |
| 1 — Asset ID immutability  | 历史交易记录链断裂；审计不可追溯                     |
| 2 — Single source of truth | 持仓与交易不一致；用户失信                           |
| 3 — Adapter abstraction    | 数据源故障/替换时业务代码爆改                        |
| 4 — Currency preservation  | 多币种用户的历史回看完全错位                         |
| 5 — History ≠ current      | TWR / MWR / 收益率失真，是金融工具最 critical 的失败 |

---

## See also

- `constitution.md` — full project constraints
- `packages/core/src/domain/types.ts` — TypeScript encoding of these laws
- `packages/core/__tests__/` — property-based test enforcement
- `docs/development-plan.md` §五 — data model design
- ADR 001 — original tech stack decision (defines this discipline)
