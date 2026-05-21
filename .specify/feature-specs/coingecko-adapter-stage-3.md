# Feature: CoinGecko adapter — CRYPTO (Stage 3 — Block A 漏单收口)

- **Status**: Accepted — 6 resolved decisions (BoyangJiao approved 2026-05-20，无 open questions 需拍板)
- **Author**: Claude Opus 4.7 (draft) + BoyangJiao (review)
- **Created**: 2026-05-20
- **Implements**: `.specify/feature-specs/stage-3-roadmap.md` §Block A 第二项；roadmap 写了但 Block A 实施时只做了 Tushare + AKShare，本 spec 收口
- **Conforms to**: `.specify/constitution.md` (Decimal everywhere, real-flow integrity, ADR 007), ADR 001 §数据源约束, ADR 011 §决策一 fallback 表（CRYPTO 单源 CoinGecko，无 secondary in Stage 3）
- **Touches**: `packages/data-sources` (1 adapter + 1 bundled JSON + tests), `packages/core` (no domain change; reuses `Market = "CRYPTO"`), `apps/mobile` (registry config 1 行), seed data (CRYPTO fixture)
- **Does NOT touch**: UI components, RLS policies, DB migrations, business compute, Block A 其他 adapters

---

## Why this feature exists

Stage 3 DoD "所有真实持仓全录入" 覆盖 5 个市场：US / CN / HK / FUND / **CRYPTO**。前 4 个在 Block A 已 live；CRYPTO 是 Block A 第二个 spec（roadmap §决策推荐），但 Block A 实施时只起了 Tushare adapter spec + AKShare wrapper，**CoinGecko 漏掉了**。Block C 跨市场 tx entry UI 一旦上来，CRYPTO 无 adapter 就是 `resolvePriceAdapter("CRYPTO")` 抛 NotFoundError，会立刻阻塞。本 spec 补完。

设计上 CoinGecko 是 Block A 最简单的 adapter：公共 REST API、无 auth（free tier）、行式 JSON、单一市场（CRYPTO）。**完全可以照 Finnhub 模板抄**（不是 Tushare 那种 POST JSON-RPC + 列式响应）。

---

## User / dev journey

无新 UI（与 Tushare adapter spec 同模式）。

### Dev journey

**Given** registry 已挂 CoinGecko adapter
**When** Block C tx entry UI 录 `CRYPTO:BTC`
**Then** `useHoldingValuation()` 触发 `registry.resolvePriceAdapterByAssetId("CRYPTO:BTC").fetchLatest("BTC")`
**And** CoinGecko `/simple/price` 返回 USD 价 + 24h 变动 %
**And** `PriceQuote { assetId: "CRYPTO:BTC", price, currency: "USD", source: "coingecko", changePercent }` 写入 cache
**And** 报告币种 CNY 通过 Frankfurter `USD→CNY` 换算（已就绪）

---

## Resolved decisions

1. **Free tier 无 API key 起步** — CoinGecko 公共 API 10-30 calls/min（2026 实测），Stage 3 self-use（≤5 个 CRYPTO 持仓 + watchlist）远不到瓶颈。Stage 4 评估 Demo API Key (`x-cg-demo-api-key` header, 30/min) 或 Pro 付费。
2. **Asset id = `CRYPTO:{TICKER}`** — `CRYPTO:BTC` / `CRYPTO:ETH` / `CRYPTO:USDC` / `CRYPTO:SOL`（大写 ticker）。与 CN/HK/FUND 同模式（大写 + 无后缀）。
3. **Symbol → CoinGecko `coin_id` 映射 = bundled JSON** — `packages/data-sources/src/static/coingecko-coins-top200.json` 仓库内 commit，由 `tools/refresh-coingecko-coins.ts` 季度跑一次刷新（拉 `/coins/list` 全量 → 取 top 200 by market cap）。Fallback：若 ticker 不在 bundled JSON → 调 `/search?query=...` live 拉。**与 Tushare basics 不同**：CoinGecko `/coins/list` 完全免费、无积分门槛，刷新成本低。
4. **`vs_currency=usd` 写死** — adapter 永远拉 USD 价；报告币种换算交给 `FxAdapter`（Frankfurter）。**单一币种契约**避免 vs_currency 漂移（用户可能选 CNY 直接拉，但那会跳过 fx 缓存路径 → cache miss 率高）。
5. **`fetchHistorical` 用 `/coins/{id}/market_chart?days=N`** — 返回 `[[ts_ms, price], ...]` 数组；N = `Math.max(days_between(from, to), 1)`。CoinGecko 在 1-90 天用 hourly，> 90 天用 daily —— Stage 3 Block C 多时段图表（1D/1W/1M/3M/YTD/1Y/ALL）自然适配。
6. **`searchSymbols` 用 `/search?query=...`** — 返回 `{ coins: [{id, symbol, name, market_cap_rank, ...}] }`。filter 出 `market_cap_rank <= 500`（防止杂币干扰），cap 至 8 条与 Finnhub 一致。

---

## Data model

**无新表、无迁移、无 schema 改动。** Adapter 是纯 read-side concern；写入现有 `price_snapshots`（Stage 2 cache 已就绪）。

### Asset id contract

| Market   | Arc asset id  | CoinGecko `id` | Notes                     |
| :------- | :------------ | :------------- | :------------------------ |
| `CRYPTO` | `CRYPTO:BTC`  | `bitcoin`      | `assets.currency = "USD"` |
| `CRYPTO` | `CRYPTO:ETH`  | `ethereum`     |                           |
| `CRYPTO` | `CRYPTO:USDC` | `usd-coin`     | Stablecoin；price ≈ 1.00  |
| `CRYPTO` | `CRYPTO:SOL`  | `solana`       |                           |

`assets.currency` 一律 `USD`（CoinGecko `vs_currency=usd`）；用户报告币种通过 Frankfurter 换算。

### `PriceQuote.source` 字段

`source = "coingecko"`（单一字符串；与 `tushare-cn` / `akshare-hk` 同 source 字段约定）。

---

## Architecture

### File layout

```
packages/data-sources/src/
├── adapters/
│   ├── coingecko/
│   │   ├── client.ts          ← HTTP client + error mapping
│   │   ├── coin-id-resolver.ts ← ticker ↔ coin_id mapping (bundled JSON + live fallback)
│   │   └── index.ts            ← createCoingeckoAdapter + barrel
│   └── (其他)
├── static/
│   └── coingecko-coins-top200.json   ← committed (top 200 by market cap)
└── registry.ts                       ← +CoinGecko wiring
```

### Adapter contract

```ts
// adapters/coingecko/index.ts (sketch)
export interface CoingeckoAdapterConfig {
  fetcher?: typeof fetch;
  /** Optional demo API key (Stage 4) — sent as x-cg-demo-api-key header */
  apiKey?: string;
}

export const createCoingeckoAdapter = (config?: CoingeckoAdapterConfig): PriceAdapter => {
  // implementation per spec
};
```

`fetchLatest(symbol)` 调 `/simple/price?ids={coin_id}&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true`。响应形如：

```json
{
  "bitcoin": {
    "usd": 67234.5,
    "usd_24h_change": 2.34,
    "last_updated_at": 1747612800
  }
}
```

映射到 `PriceQuote`:

- `assetId: "CRYPTO:BTC"`
- `price: new Decimal("67234.5")`
- `currency: "USD"`
- `asOf: new Date(last_updated_at * 1000).toISOString()`
- `source: "coingecko"`
- `changePercent: new Decimal("2.34")`

### Error mapping

| 上游                        | 抛错                                                                |
| :-------------------------- | :------------------------------------------------------------------ |
| HTTP 429 (+ `Retry-After`)  | `RateLimitError`                                                    |
| HTTP 404 / 响应 `{}` 空对象 | `NotFoundError(source, ticker)`                                     |
| HTTP 401 / 403              | `NetworkError("HTTP 401/403 ...")` (Stage 4 加 demo key 后才可能出) |
| HTTP 5xx                    | `NetworkError("HTTP 5xx")`                                          |
| fetch throw                 | `NetworkError(source, cause)`                                       |
| JSON parse fail             | `ParseError`                                                        |

不需要 `QuotaError`（CoinGecko 无"积分耗尽"概念，限流就是 429）。

### `searchSymbols`

```ts
async searchSymbols(query: string): Promise<ReadonlyArray<SymbolSearchResult>> {
  // 1. Substring match in bundled top200 JSON (zero HTTP)
  const bundled = matchBundledCoins(query);
  if (bundled.length >= 3) return bundled.slice(0, 8);

  // 2. Fallback: CoinGecko /search live (~1 call counted)
  const live = await fetchLiveSearch(query);
  return live.filter((c) => c.market_cap_rank <= 500).slice(0, 8);
}
```

混合策略：bundled JSON 覆盖 99% self-use 场景（你只会持仓 top 100 币种），冷僻 ticker fallback live。

### Registry integration

`packages/data-sources/src/registry.ts`：

```ts
export interface DefaultPriceAdaptersConfig {
  finnhubApiKey: string;
  tushareToken?: string;
  akshareWrapperUrl?: string;
  akshareWrapperToken?: string;
  enableAkshareCnFallback?: boolean;
  /** Optional — Stage 4 evaluate demo API key */
  coingeckoApiKey?: string;
}

// 内部：
adapters.CRYPTO = createCoingeckoAdapter({ apiKey: config.coingeckoApiKey });
```

CRYPTO 永远挂载（不需要 token / wrapper URL；free tier 无前置依赖）。

---

## Acceptance criteria (S3-AC-A2.x)

> A1 = Tushare（Block A 已 ✅），**A2 = CoinGecko**（本 spec），A3 reserved for ADR 011 多源 fallback（已在 Block A Phase 2 用 withFallback 实现）。

### S3-AC-A2.1 — Crypto spot fetch happy path

**Given** registry 默认 bootstrap
**When** `registry.resolvePriceAdapterByAssetId("CRYPTO:BTC").fetchLatest("BTC")` 调用
**Then** GET `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true` 发出一次
**And** `PriceQuote.assetId === "CRYPTO:BTC"`, `price` 是 Decimal > 0, `currency === "USD"`, `source === "coingecko"`, `changePercent` 是 Decimal（sign matches `usd_24h_change`）
**And** `asOf` 是有效 ISO timestamp

### S3-AC-A2.2 — Stablecoin（USDC ≈ 1.00 不算 bug）

**Given** `CRYPTO:USDC`
**When** `fetchLatest("USDC")`
**Then** `price.toNumber()` 在 [0.95, 1.05] 之间（不要 hardcode === 1.0 — stablecoin peg 偶尔偏移）

### S3-AC-A2.3 — Ticker not in bundled JSON → live fallback

**Given** ticker `"OBSCURE"` 不在 `coingecko-coins-top200.json`
**When** `fetchLatest("OBSCURE")`
**Then** adapter 先调 `/search?query=OBSCURE` 拿 coin_id
**And** 再调 `/simple/price?ids={coin_id}&...` 拿价
**And** 总计 2 次 HTTP；都计入 rate limit 配额

### S3-AC-A2.4 — Rate limit → RateLimitError

**Given** CoinGecko 返回 HTTP 429 + `Retry-After: 60`
**When** `fetchLatest` 调用
**Then** 抛 `RateLimitError(source: "coingecko", retryAfterMs: 60_000)`

### S3-AC-A2.5 — Symbol not found → NotFoundError

**Given** `/search` 返回空 + 不在 bundled
**When** `fetchLatest("ZZZZZ")`
**Then** 抛 `NotFoundError("coingecko", "ZZZZZ")`

### S3-AC-A2.6 — `fetchHistorical` returns sorted asc

**Given** `fetchHistorical("BTC", new Date("2026-04-20"), new Date("2026-05-20"))`
**When** 调用
**Then** `/coins/bitcoin/market_chart?vs_currency=usd&days=30` 调一次
**And** 返回 `ReadonlyArray<PriceQuote>` 非空 + 按 `asOf` 升序排
**And** 每条 entry `currency === "USD"`, `source === "coingecko"`

### S3-AC-A2.7 — searchSymbols 优先 bundled JSON

**Given** 调 `searchSymbols("btc")`
**When** bundled JSON 命中 ≥ 3 条（BTC + WBTC + sBTC 等变体）
**Then** **零** HTTP 请求；返回 bundled 命中前 8 条

### S3-AC-A2.8 — searchSymbols filter market_cap_rank

**Given** `/search?query=foo` 返回 20 条 + 其中 15 条 `market_cap_rank > 500`
**When** `searchSymbols("foo")`
**Then** 返回 ≤ 5 条（rank ≤ 500 的）+ 不含杂币

---

## Out of scope

- **Demo API key / Pro tier** — Stage 4 评估
- **WebSocket / 实时 streaming** — Stage 4
- **Bundled JSON 自动 GH Action refresh** — Block F
- **`/coins/{id}` 完整 metadata（icon URL / homepage / etc）** — Block C asset detail 页评估，本 adapter 不暴露
- **多 vs_currency 直接拉**（如 CNY） — 决策 4 固定 USD
- **山寨币 / NFT / DeFi token 一般支持** — 默认通过 search fallback；不主动维护
- **跨链 wrap token 区分**（如 WBTC vs BTC） — 用户自己选 ticker；adapter 不智能映射

---

## Implementation plan

> Routing: Sonnet/Cursor —— pattern 与 Finnhub adapter 几乎一样（GET REST + 行式 JSON + 单市场）。每个 commit 独立 PR-able。

1. **`feat(data-sources): coingecko client + error mapping`** — `adapters/coingecko/client.ts` + `__tests__/coingecko-client.spec.ts`（mocked fetcher 覆盖 happy path + 429 + 404 + 5xx + JSON parse fail；~10 个 case）
2. **`feat(data-sources): coingecko coin-id resolver + bundled top200 JSON`** — `adapters/coingecko/coin-id-resolver.ts` + `static/coingecko-coins-top200.json`（用户跑 `pnpm tsx tools/refresh-coingecko-coins.ts` 拉一次；bundled JSON 约 50KB）
3. **`feat(data-sources): coingecko adapter (fetchLatest + fetchHistorical + searchSymbols)`** — `adapters/coingecko/index.ts` + `__tests__/coingecko.spec.ts`（密度参照 finnhub.spec.ts，覆盖 S3-AC-A2.1–A2.8）
4. **`feat(data-sources): registry mounts CRYPTO = CoinGecko`** — `registry.ts` 1 行 + `registry.spec.ts` 测 CRYPTO resolve 成功
5. **`feat(mobile+seed): CRYPTO seed scenario`** — `default:crypto-only`（BTC × 0.5 + ETH × 5 + USDC × 1000）+ DEV 面板挂载
6. **`docs(spec): mark coingecko-adapter-stage-3 Accepted + bump session-state`**

6 commits，Sonnet 估时 3-5h。

---

## Test plan

| AC                        | Layer     | Artifact                                                              |
| :------------------------ | :-------- | :-------------------------------------------------------------------- |
| A2.1 / A2.2               | L1        | `__tests__/coingecko.spec.ts` happy + USDC stablecoin tolerance       |
| A2.3                      | L1        | `coin-id-resolver.spec.ts` + `coingecko.spec.ts` — fallback 路径 mock |
| A2.4 / A2.5 / A2.7 / A2.8 | L1        | `coingecko.spec.ts` 各分支 mock                                       |
| A2.6                      | L1        | `coingecko.spec.ts` historical window mocked 7-day response           |
| **Live smoke**            | L4 (用户) | After commit 4: 录 `CRYPTO:BTC` × 0.1 → 看到真实 USD 价 + CNY 换算    |

---

## Risks

| Risk                                                     | Likelihood     | Impact                         | Mitigation                                                           |
| :------------------------------------------------------- | :------------- | :----------------------------- | :------------------------------------------------------------------- |
| Free tier 30 calls/min 在 watchlist + 组合并发查询时打满 | Low (self-use) | RateLimitError / banner        | priceCache 5min TTL；Stage 4 加 demo key 翻倍                        |
| CoinGecko 改 schema（如 `usd_24h_change` 改名）          | Low            | ParseError + Sentry breadcrumb | adapter 容错：`changePercent` 字段缺 → null（非 throw）              |
| Bundled JSON 漂移（新币种没收录）                        | Med            | `/search` live fallback 触发   | 季度手动 refresh；冷僻 token 自动 fallback                           |
| Ticker 大小写歧义（"BTC" vs "btc"）                      | Low            | NotFound                       | adapter `toUpperCase()` + bundled JSON 键 uppercase                  |
| 同 ticker 多 coin（"UNI" = Uniswap or 其他）             | Low            | 拿错币                         | bundled JSON 预 rank by market_cap，取 top；用户认知里 UNI = Uniswap |

---

## Hand-off

- **Implementation owner**: Sonnet/Cursor — Finnhub adapter 模板可直接复用 80% 结构
- **Review owner**: Opus（架构 review 不必；commit chain post-hoc 抽查即可）
- **External dependency**: 无（CoinGecko free tier 不需要 key）
- **Block C 依赖**: 本 spec 必须 commit #4 (registry) 之前完成，否则 Block C cross-market tx entry 录 CRYPTO 会立刻断
