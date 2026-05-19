# ADR 010 — Dev 缓存信任策略：source 兜底 + Infinity freshness

- **状态**: 已接受
- **日期**: 2026-05-19
- **作者**: BoyangJiao + Claude (Opus 4.7)
- **相关 ADR**: 007（Dev Auth & 种子数据），008（Dev 行情策略 — fixture 退役），009（Daily Snapshot 时点）
- **触发**: HOOD 自选显示 $77（旧 seed-dev 假价 + 无涨跌幅）暴露了一个系统性 bug——`cache-first` 模式下，**任何**早期写入的 `price_snapshots` 行都会被无限期信任。fixture 已退役（PR #8），但 `seed-dev` / 旧 `alphavantage` / 无 `changePercent` 的行仍会污染自选、组合估值、录交易校验三条读路径。

---

## 背景

ADR 008 决定 dev 走 `cache-first`（任何缓存即新鲜，只有下拉刷新 / 新 ticker 才打网络），靠这个把 Alpha Vantage 25/day 配额从「dev 阻力」变成「真验证配额」。PR #7/#8 之后整条链路改成 Finnhub（60/min），fixture 路径退役，dev 体验更顺。

但 `cache-first` 有一个未明说的前提：**缓存里的数据都是可信的**。这个前提在三种情况下不成立：

1. **`source: "seed-dev"`** — `pnpm seed:*` 和 DEV 面板的自选种子写入 `price_snapshots`，价格是写死的（HOOD $77、AAPL $189.50）
2. **`source: "fixture"`** — ADR 008 的 fixture 路径残留，2026-05-19 退役
3. **`source: "alphavantage"`** — 切换到 Finnhub 之前的真实快照，价格可能正确但数据源已废弃
4. **`changePercent == null`** — 早期 adapter / seed 只写 price 不写涨跌幅

`cache-first` 配 `CACHE_FIRST_READ_FRESHNESS_MS = Infinity`（任何 asOf 都视为新鲜）意味着这些可疑数据**永远**不会被刷新，除非用户：

- 手动在 Portfolio / Markets tab 下拉刷新（且这条 holding/symbol 在屏幕上）
- 删 App 重装清空 AsyncStorage

PR #8 之后已在自选路径 (`use-watchlist-quotes`) 加了一个**局部** `shouldRefreshCachedQuote` bypass，覆盖 `seed-dev` / `fixture` / 无 `changePercent` 三种情况。HOOD 修好了，但组合估值（`use-portfolio-valuation`）、详情价（`use-price`）、录交易前校验（`validate-us-symbol`）三条读路径**没有同样的护栏**——意味着 AAPL/MSFT/NVDA 的组合总市值仍可能基于 `seed-dev` 价格，且可能把假数据写进交易（脏数据顺着「交易 → 持仓 → 估值」链路向下传播）。

---

## 决策

### 决策一：把「缓存可信」的判断抽到共享 helper

新建 `apps/mobile/src/lib/stale-quote.ts`：

```ts
export const isStaleQuoteSource = (quote: Pick<PriceQuote, "source" | "changePercent">): boolean =>
  STALE_SOURCES.has(quote.source) || quote.changePercent == null;

const STALE_SOURCES: ReadonlySet<string> = new Set(["seed-dev", "fixture", "alphavantage"]);
```

四条读路径都引用同一个 helper：

| 文件                                 | 用法                                                      |
| :----------------------------------- | :-------------------------------------------------------- |
| `queries/use-watchlist-quotes.ts`    | 已有 — 替换原本的 `shouldRefreshCachedQuote`              |
| `queries/use-portfolio-valuation.ts` | `readCachedQuotesOnly` + `fetchAllQuotes` 都过滤          |
| `queries/use-price.ts`               | 命中后过滤；命中可疑 → 触发 Finnhub                       |
| `validate-us-symbol.ts`              | 命中后过滤；可疑 → 触发 Finnhub（**避免把假价写进交易**） |

> 为什么不进 `@arc/data-sources`：这是 app 层 dev 缓存策略，是「what does this app trust」的语义。data-sources 包应保持纯粹（不知道 seed-dev 这种 app-side 概念）。

### 决策二：保留 `CACHE_FIRST_READ_FRESHNESS_MS = Infinity`

初稿曾考虑把 freshness 收紧到 24h 作为"时间护栏"。深入实施时发现这会与 ADR 008 的「dev 永不自动打网络」原则冲突：

- `readCachedQuotesOnly`（cache-first 模式的唯一 holdings 读路径）**不 fallback 到网络**
- 改 24h 意味着 24h 后 cache miss → 组合估值空白，体验比 stale 数据更差
- 而 `valuationQueryStaleTimeMs` 改 24h 仅触发 TanStack Query refetch，refetch 仍只读缓存，并未真正"自然刷新"

最终选择：**保持 Infinity，靠 `isStaleQuoteSource` 单点兜底**。理由：

- 这是「source-based trust」而非「time-based trust」——后者在 dev 永不自动打网络的设定下意义有限
- Insights tab 已有 `claimInsightsSessionLiveFetch` 每会话自动 force-refresh 一次（ADR 009 配套），自然刷新点已存在
- 用户每天会自然下拉刷新（习惯性进 App 看涨跌），手动节奏比 24h 时间窗更贴近真实行为

### 决策三：DEV seed 仍写假数据（不改）

`run-watchlist-seed-client.ts` 的 `WL_PRICES` (AAPL 189.50 / MSFT 420.30 / NVDA 875) 和 `pnpm seed:*` 的 fallback 价**保留**。这些是 `watchlist:stale-quotes`、再平衡 mild/heavy 等场景的预期假数据。

护栏：`source: "seed-dev"` 会被 `isStaleQuoteSource` 识别，用户**打开自选 / 进组合 / 录交易**时第一时间触发 Finnhub 真实价，假数据只在「用户没进过自选 tab」这个窗口期存在——可接受。

在 `run-watchlist-seed-client.ts` 头部加注释解释这是**有意保留**，防止后续维护者误改成 Finnhub 写库（会让 stale-quotes 场景失效）。

### 决策四：FX `seed-dev` 不过滤

`fx_rates` 表里 `source: "seed-dev"` 的行（USD→CNY 7.20）**不**加入 `STALE_SOURCES`。理由：

- 汇率数值差异远小于价格（CNY 7.15 vs 7.20 对组合估值影响 < 1%）
- Frankfurter 调用频率本来就很低（FX 4h freshness）
- 加进去要单独写 `isStaleFxRate`（FxRate 类型与 PriceQuote 不同），复杂度收益比不划算

如果未来发现 FX seed 污染了体感，单开一次小决策。

### 决策五：`assets.name` 不在本 ADR 范围

`ensureAsset` 用 `ignoreDuplicates`，早期种子写入的 asset name 不会被后续搜索结果更新（HOOD 副标题显示 "HOOD" 而非 "Robinhood Markets"）。这是写路径问题，不属于缓存信任策略；解决成本（修改 `ensureAsset` 语义 + 测试）远超 SQL 手改一行，**进 backlog**。

---

## 后果

### 正面

- **HOOD 类 bug 一次性收口** — 四条读路径用同一个 helper，避免下次某个新页面又踩同样的坑
- **录交易安全** — `validate-us-symbol` 不会再返回 seed-dev 价让用户当真实价记入交易
- **组合估值可信** — `use-portfolio-valuation` 的 `readCachedQuotesOnly` 不再悄无声息地拿 seed 价当真
- **DEV 假数据场景不破坏** — `watchlist:stale-quotes` 等仍然按预期 seed `source: "seed-dev"`，护栏自动驱动一次真实刷新
- **可演进** — `STALE_SOURCES` 是个集合，加新源（如未来废弃 Finnhub 切别的）只改一个常量

### 负面

- **每个 cache-first 读路径多一次 source 字符串比较** — 完全可忽略（µs 级）
- **首次进有自选 tab 会触发 N 次 Finnhub 请求**（N = 自选数量）— 在 60/min 配额内远远够用
- **AsyncStorage 旧 `seed-dev` 缓存仍然存在**——只是不会再被信任。如想彻底清空，删 App 重装或 SQL 清 `price_snapshots`

### 中性

- ADR 008 的 fixture 决策正式作废 — 但 ADR 008 文档保留作为历史记录（不删除）
- `valuationQueryStaleTimeMs` 在 cache-first 模式仍返回 Infinity，TanStack Query 永不自动 refetch 估值——与 ADR 008 的 dev 行为一致

---

## 实施清单

- [x] `apps/mobile/src/lib/stale-quote.ts` — 新增 `isStaleQuoteSource` 共享 helper
- [x] `apps/mobile/src/lib/queries/use-watchlist-quotes.ts` — 替换本地 `shouldRefreshCachedQuote`
- [x] `apps/mobile/src/lib/queries/use-portfolio-valuation.ts` — `readCachedQuotesOnly` + `fetchAllQuotes` 过滤 + Finnhub 注释 + 常量改名
- [x] `apps/mobile/src/lib/queries/use-price.ts` — cache miss/stale 都打 Finnhub（替代原本的"throw"）
- [x] `apps/mobile/src/lib/validate-us-symbol.ts` — 缓存命中后过滤可疑 source
- [x] `apps/mobile/src/lib/market-data-policy.ts` — 清理 ADR 008 fixture 残余注释
- [x] `apps/mobile/src/lib/dev-tools/run-watchlist-seed-client.ts` — 注释说明假数据是有意保留
- [x] Verification: typecheck / lint / test
- [ ] `.specify/session-state.md` 更新

---

## 后续

- 如果 Stage 2+ 出现第 4 个 cache-first 读路径，自然复用 `isStaleQuoteSource` — 无需新 ADR
- 如果 FX 也开始踩坑，写 `isStaleFxRate` 配套
- 如果未来切换主行情源（Finnhub → 别的），把 `"finnhub"` 也加进 `STALE_SOURCES` 即可
- `assets.name` 的 backfill 策略另起小决策（不进本 ADR）
