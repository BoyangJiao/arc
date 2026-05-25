# Feature: Tushare Pro adapter — CN / HK / FUND (Stage 3 — Block A)

- **Status**: Accepted — 14 resolved decisions; **reshaped 2026-05-20** after Tushare 免费版 实证（仅 A 股 daily 可访问；HK 单独审批；FUND 接口 ≥ 2000 积分）→ Block A 拆为 Phase 1A (Tushare CN) + Phase 2 (AKShare wrapper for HK/FUND) — 见 ADR 011 决策一 / 五
- **Author**: Claude Opus 4.7 (draft + reshape) + BoyangJiao (review, HK=b 锁定)
- **Created**: 2026-05-19；reshape 2026-05-20
- **Implements**: `.specify/feature-specs/stage-3/stage-3-roadmap.md` §Block A 第一项；`docs/development-plan.md` §Stage 3 多市场 adapters
- **Conforms to**: `.specify/constitution.md` (Decimal everywhere, real-flow integrity, ADR 007), ADR 001 §数据源约束（adapter 唯一抽象边界），`packages/data-sources/src/adapters/finnhub.ts` 接口契约
- **Touches**: `packages/data-sources` (3 new adapter factories + 1 shared client + symbol normalization + static metadata snapshots), `packages/core` (no domain change; reuses `Market = "CN" | "HK" | "FUND" | "US" | "CRYPTO" | "CASH"`), `apps/mobile` (registry config additions only), seed data (CN/HK/FUND fixture rows for dev panel)
- **Does NOT touch**: UI components, RLS policies, DB migrations, business compute. Adapter is invisible to consumers — they keep doing `registry.resolvePriceAdapterByAssetId(assetId)` and the new markets light up.

---

## Why this feature exists

Stage 2 closed with `US` (Finnhub) + `CASH` (constant) wired to `createDefaultRegistry`. The roadmap's first downstream Stage 3 work — multi-portfolio (Block B), holdings table & asset detail (Block C), TWR / Performance Attribution (Block D) — assumes the user can already record **A 股 / 港股 / 公募基金** positions and pull live (EOD) prices. Without `CN` / `HK` / `FUND` adapters, every Stage 3 Block degrades to fixture data and the property tests in Block D would only assert against mocks — defeating the "TWR 与雪球误差 < 1%" DoD.

This spec is also where Arc first absorbs the **Tushare Pro API shape** (POST JSON-RPC + column-oriented response + 积分 quota model) so that ADR 011's multi-source fallback discussion (Tushare ↔ AKShare ↔ degraded mode) has a concrete primary-source contract to fall back **from**.

---

## User / dev journey

There is **no end-user UI** in this spec. Two journeys matter:

### Dev journey (you, integrating new markets)

**Given** Tushare Pro account registered + `EXPO_PUBLIC_TUSHARE_TOKEN` configured in `apps/mobile/.env`
**When** I record a new transaction for `CN:600519` (贵州茅台) via `/me/portfolios/<id>/transactions/new`
**Then** the existing transaction form upserts the asset row
**And** `useHoldingValuation(portfolioId)` triggers `registry.resolvePriceAdapterByAssetId("CN:600519").fetchLatest("600519")`
**And** Tushare's `daily` endpoint returns the latest EOD close in CNY
**And** the holding value appears in 报告币种（CNY → USD via Frankfurter）一致 within the same paint

### Downstream-consumer journey (Block B/C/D specs)

Every place that today does `await registry.resolvePriceAdapterByAssetId(asset.id).fetchLatest(symbol)` for a `US:*` symbol works identically for `CN:*` / `HK:*` / `FUND:*` after this spec ships. **Zero call-site changes** — only the registry config bootstrap learns 3 new keys.

---

## Resolved decisions (inherited or locked at roadmap level)

1. **Primary source — reshape 2026-05-20** — Tushare 免费版（20 积分注册赠送）实证覆盖范围：`daily`（A 股日线）✅ 仅此而已；`stock_basic` `fund_basic` `fund_nav` 需 2000 积分 (≈ ¥200/年捐助)；`fund_daily` (ETF) 需 5000 积分 (≈ ¥500/年)；`hk_daily` 单独审批与积分无关。决策：Stage 3 dev 从免费版起步覆盖 A 股 `daily`；HK / FUND 主源 = AKShare wrapper（ADR 011 决策一 / 五 Phase 2 必启）。付费升级路径见 §Risks. [supersedes roadmap §七 决策 7]
2. **AKShare → ADR 011 Phase 2 必启**（reshape 2026-05-20，从原"候补"翻转） — Stage 3 Block A 完整 DoD 依赖 AKShare 覆盖 HK + FUND；CN 限流 / `stock_basic` 阻塞期间也走 AKShare fallback。ADR 011 已 Accepted。 [supersedes roadmap §七 决策 8]
3. **Abandon 天天基金 NAV adapter** — FUND 主源在 Stage 3 dev = **AKShare wrapper**（reshape）；用户升 2000 积分后 OF NAV 可切回 Tushare `fund_nav`；ETF 需 5000 积分 或继续走 AKShare（Stage 4 评估）. [partially supersedes roadmap §七 决策 9]
4. **Adapter contract preserved** — `PriceAdapter.market: Market` stays single-market. Tushare Pro is exposed as **three factories** (`createTushareCnAdapter` / `createTushareHkAdapter` / `createTushareFundAdapter`) sharing one internal `createTushareClient({token, fetcher})`. Mirrors how `cash-adapter.ts` registers per-currency adapter instances under one `CASH` market key. **No refactor of `interfaces.ts`** in this spec.
5. **EOD-only Stage 3 scope** — Tushare 免费版无 intraday; `asOf` = `trade_date` (YYYYMMDD) mapped to **15:00 Asia/Shanghai for CN / 16:00 Asia/Hong_Kong for HK / 23:00 Asia/Shanghai for FUND** (NAV publish time). Acceptable for Block C 日线图 + Block D TWR (daily granularity matches雪球 EOD comparison anyway). Intraday revisited in Stage 4 with paid tier or alt source.
6. **`changePercent` shipped Day 1** — Tushare `daily.pct_chg` (already % units, signed) maps directly to `PriceQuote.changePercent: Decimal | null`. Watchlist S2-AC-2.7 (red-up/green-down) and Stage 2 quote cache pattern (`change_percent` column on `price_snapshots`, migration 0005) work for CN/HK/FUND with zero migration. [interfaces.ts 已支持]
7. **`fetchHistorical` implemented Day 1** — Block C 多时段图表 (1D / 1W / 1M / YTD / 1Y / ALL) consumes it. Pagination uses Tushare's `start_date` / `end_date` (YYYYMMDD) + 5000 row limit per call.
8. **`searchSymbols` cached-only** — Stage 3 first cut: bundled JSON snapshots (`stock_basic.json`, `hk_basic.json`, `fund_basic.json`, generated once via `tools/refresh-tushare-basics.ts` and committed). No live Tushare call from `searchSymbols` to protect 积分. Refresh policy: manual quarterly until Block F adds a scheduled GH Action.
9. **HTTPS endpoint** — Tushare Pro supports `https://api.tushare.pro` since 2024; we use HTTPS exclusively. HTTP variant rejected in the adapter (`fetcher` URL hard-coded).

### Locked 2026-05-19 (adapter-level, BoyangJiao approved A/A/A/A)

10. **Asset id convention = stripped (Option A)** — Arc internal asset id is suffix-free: `CN:600519` / `HK:00700` / `FUND:000001`. Tushare `ts_code` ↔ Arc symbol mapping lives in `adapters/tushare/symbol-resolver.ts`. Rationale: keeps Arc domain exchange-agnostic so a future AKShare adapter (different suffix convention) plugs in without renaming assets in the DB.
11. **Basics snapshot = bundled JSON, quarterly manual refresh (Option A)** — `packages/data-sources/src/static/tushare-basics/{stock,hk,fund}.json` committed to repo; `tools/refresh-tushare-basics.ts` is a one-shot script the user runs locally with their token. Zero 积分 burn on `searchSymbols`. Block F can later replace with a scheduled GH Action; not Stage 3 critical.
12. **Quota-error fallback = throw + cache banner (Option A) — refined 2026-05-20** — On Tushare `code 40203` (频率超限) → `RateLimitError`; on `code 40002` (积分不足 / 权限不足) → **`QuotaError`** (新增 subclass，extends AdapterError directly; commit #1 fold-in 2026-05-20)；on `code 40001` (token 无效) → `NetworkError`。`withFallback`（ADR 011 Phase 2）用 `instanceof QuotaError` 切 secondary，用 `instanceof NetworkError` 配 cause 字符串区分 401/40001 bubble vs 5xx try-secondary. Caller (stale cache + banner) 兜底链路保留.
13. **CN symbol → ts_code = rule-based prefix mapping (Option A)** — `60*` → `.SH` / `00*` / `30*` → `.SZ` / `68*` (科创板) → `.SH` / `8*` / `4*` (北交所) → `.BJ`. Compact, no lookup. Edge cases (rare relistings, foreign-board GDR symbols) deferred to ADR 011 / Stage 4 — if they actually appear in self-use portfolio, treat as a follow-up commit, not a blocker.

### Locked 2026-05-20 (reshape after Tushare 免费版 实证)

14. **HK strategy = b (Stage 3 不申请 Tushare hk_daily 权限)** — Stage 3 dev 全程 HK 走 AKShare wrapper；Tushare HK adapter (`commit #5`) Stage 3 不实施，spec §Implementation plan 标 deferred。 Stage 4 公开发布前评估 Tushare 商业版 + HK 权限申请。 [BoyangJiao 决定 2026-05-20]

15. **`QuotaError extends AdapterError`（不 extends NetworkError）** — 与 RateLimitError 同辈，让 ADR 011 §决策三 classifier 用 `instanceof QuotaError` 直接判定，无需 sniff cause 字符串。后果：现有 `catch (e) { if (e instanceof NetworkError) }` 不再覆盖 quota 路径，业务层需要显式 catch QuotaError —— 该处理在 Phase 2 wire registry 时新增。

---

## Data model

**No new tables, no migrations.** Tushare adapter is a pure read-side concern; it writes through the existing `PriceCache` (`price_snapshots` table) populated by Stage 2 migration `0001` + `0005` (`change_percent`).

### Asset id contract (assuming Open Q 1 = Option A)

| Market | Arc asset id  | Tushare `ts_code` | Notes                                                                           |
| :----- | :------------ | :---------------- | :------------------------------------------------------------------------------ |
| `CN`   | `CN:600519`   | `600519.SH`       | Suffix derived by §Q4 rule; `assets.currency = "CNY"`                           |
| `CN`   | `CN:000001`   | `000001.SZ`       | 平安银行；`00*` → `.SZ`                                                         |
| `CN`   | `CN:688981`   | `688981.SH`       | 中芯国际 (科创板); `68*` → `.SH`                                                |
| `HK`   | `HK:00700`    | `00700.HK`        | 腾讯；symbol pre-padded to 5 digits in storage; `assets.currency = "HKD"`       |
| `FUND` | `FUND:000001` | `000001.OF`       | 华夏成长（开放式）；adapter appends `.OF` unless symbol is 6-digit exchange-LOF |
| `FUND` | `FUND:510300` | `510300.SH`       | 沪深 300 ETF；6-digit + starts with `5` → exchange-traded → `.SH`/`.SZ` by §Q4  |

### Currency × market table (locked here, consumed by Block B/C)

| Market | Default currency |
| :----- | :--------------- |
| `CN`   | `CNY`            |
| `HK`   | `HKD`            |
| `FUND` | `CNY`            |

Cross-currency translation continues to flow through `FxAdapter` (Frankfurter) — adapter never pre-translates (CLAUDE.md §3.2 invariant 4).

### `PriceQuote.source` strings

| Adapter                    | `source`       |
| :------------------------- | :------------- |
| `createTushareCnAdapter`   | `tushare-cn`   |
| `createTushareHkAdapter`   | `tushare-hk`   |
| `createTushareFundAdapter` | `tushare-fund` |

Three distinct strings (not a single `"tushare"`) so Block D / observability can attribute price freshness per market without parsing.

---

## Architecture

### File layout

```
packages/data-sources/src/
├── adapters/
│   ├── tushare/
│   │   ├── client.ts              ← createTushareClient({token, fetcher}) — POST JSON-RPC, error mapping
│   │   ├── cn.ts                  ← createTushareCnAdapter
│   │   ├── hk.ts                  ← createTushareHkAdapter
│   │   ├── fund.ts                ← createTushareFundAdapter
│   │   ├── symbol-resolver.ts     ← symbol ↔ ts_code mapping (per Open Q 4)
│   │   └── index.ts               ← barrel re-export
│   └── (finnhub.ts / cash-adapter.ts / ...)
├── static/
│   └── tushare-basics/            ← created by tools/refresh-tushare-basics.ts (Open Q 2 A)
│       ├── stock.json
│       ├── hk.json
│       └── fund.json
├── registry.ts                    ← +TushareAdapter wiring in createDefaultPriceAdapters
└── interfaces.ts                  ← UNCHANGED
```

### Shared client

```ts
// adapters/tushare/client.ts (sketch — implementation detail belongs in Sonnet)
export interface TushareClient {
  call<T>(
    apiName: string,
    params: Record<string, string | number>,
    fields: ReadonlyArray<string>
  ): Promise<TushareRows<T>>;
}
export interface TushareRows<T> {
  readonly fields: ReadonlyArray<keyof T & string>;
  readonly items: ReadonlyArray<ReadonlyArray<unknown>>; // column-aligned with fields
}
```

- Single endpoint: `POST https://api.tushare.pro` with body `{ api_name, token, params, fields }`
- Response shape: `{ code, msg, data: { fields, items } }`
- Error mapping (HTTP 200, response `code` discriminates) — **refined 2026-05-20 to introduce `QuotaError` for §决策 12/15**:
  - `code === 0` → success, return `data`
  - `code === 40001` (token invalid) → `NetworkError(source, "40001: msg")` — withFallback bubble
  - `code === 40002` (积分不足 / 权限不足) → **`QuotaError(source, code, msg)`** — withFallback try-secondary
  - `code === 40203` (频率超限) → `RateLimitError(source, /* retryAfterMs */ 60_000)` — withFallback try-secondary
  - other non-zero `code` → `NetworkError(source, "code: msg")`
  - JSON parse fail → `ParseError`
  - `data.items.length === 0` on `fetchLatest` → `NotFoundError(source, symbol)` — via `assertTushareRowsNonEmpty` helper called by per-market adapter
- HTTP non-200 → mirror Finnhub mapping (`401/403` → `NetworkError`; `429` → `RateLimitError`; other → `NetworkError`)

### Per-market adapter factories (Stage 3 实施范围 — reshape 2026-05-20)

Each factory is < ~120 LOC: composes the shared client + symbol resolver + one `fetchLatest` mapping + one `fetchHistorical` mapping + one `searchSymbols`. **Stage 3 实施只做 `createTushareCnAdapter`**；HK / FUND 工厂签名保留在 `adapters/tushare/index.ts` 但实际实现 deferred（决策 14 + ADR 011 §决策五）。

| Factory                    | Stage 3 状态                                           | Tushare API (`fetchLatest`) | Currency | `asOf` source            |
| :------------------------- | :----------------------------------------------------- | :-------------------------- | :------- | :----------------------- |
| `createTushareCnAdapter`   | ✅ Stage 3 实施                                        | `daily`                     | CNY      | `trade_date` → 15:00 SHA |
| `createTushareHkAdapter`   | ⏸ Stage 3 deferred (HK=b → AKShare 接管)               | `hk_daily`                  | HKD      | `trade_date` → 16:00 HKG |
| `createTushareFundAdapter` | ⏸ Stage 3 deferred (FUND 走 AKShare；待 2000 积分升级) | `fund_daily` ∨ `fund_nav`\* | CNY      | `nav_date` → 23:00 SHA   |

HK / FUND Stage 3 实际 PriceAdapter 由 `adapters/akshare/{hk,fund}.ts` 提供 — 见 ADR 011 §决策一 + §决策五 Phase 2。

\*FUND quote resolution rule:

- Symbol matches `5\d{5}` or `1\d{5}` (exchange-traded LOF/ETF) → `fund_daily` (price-like, ts_code suffix `.SH`/`.SZ`)
- Else (open-end fund, ts_code suffix `.OF`) → `fund_nav` (NAV-like, single Decimal `unit_nav`)
- Both unify to `PriceQuote.price = Decimal(close | unit_nav)`. `changePercent` from `pct_chg` for `fund_daily`; computed from prev `unit_nav` for `fund_nav` (one extra call — cached).

### Registry integration (Stage 3 reshape 2026-05-20)

```ts
// registry.ts — additive changes (Phase 1A + Phase 2 combined view)
export interface DefaultPriceAdaptersConfig {
  finnhubApiKey: string;
  tushareToken?: string; // optional — CN only when present (Phase 1A)
  akshareWrapperUrl?: string; // Phase 2 — required for HK / FUND
  akshareWrapperToken?: string; // Phase 2 — auth header
  enableAkshareCnFallback?: boolean; // default true Stage 3 — withFallback(tushareCn, akshareCn)
}

export const createDefaultPriceAdapters = (config: DefaultPriceAdaptersConfig) => {
  const tushareClient = config.tushareToken
    ? createTushareClient({ token: config.tushareToken })
    : null;
  const akshareClient = config.akshareWrapperUrl
    ? createAkshareClient({ baseUrl: config.akshareWrapperUrl, token: config.akshareWrapperToken })
    : null;

  const cnPrimary = tushareClient ? createTushareCnAdapter({ client: tushareClient }) : null;
  const cnSecondary = akshareClient ? createAkshareCnAdapter({ client: akshareClient }) : null;

  return {
    US: createFinnhubAdapter({ apiKey: config.finnhubApiKey }),
    ...(cnPrimary && cnSecondary && config.enableAkshareCnFallback !== false
      ? { CN: withFallback(cnPrimary, cnSecondary) } // Phase 2 默认路径
      : cnPrimary
        ? { CN: cnPrimary } // Phase 1A only — AKShare 未就绪
        : {}),
    ...(akshareClient
      ? {
          HK: createAkshareHkAdapter({ client: akshareClient }), // Phase 2 — HK=b 决策 14
          FUND: createAkshareFundAdapter({ client: akshareClient }), // Phase 2
        }
      : {}),
  };
};
```

`apps/mobile/src/lib/data-sources.ts` bootstrap reads 4 env vars: `EXPO_PUBLIC_TUSHARE_TOKEN`（Phase 1A）+ `EXPO_PUBLIC_AKSHARE_WRAPPER_URL` + `EXPO_PUBLIC_AKSHARE_WRAPPER_TOKEN` + `EXPO_PUBLIC_ENABLE_AKSHARE_CN_FALLBACK`（Phase 2）。Phase 1A 期间 `EXPO_PUBLIC_AKSHARE_*` 未设时 HK / FUND `resolvePriceAdapter` 抛 `NotFoundError("registry", ...)`（ADR 007 real-flow integrity — 无 fixture 兜底）。

### Symbol normalization (assuming Open Q 1=A, Q 4=A)

```ts
// adapters/tushare/symbol-resolver.ts (sketch)
export const cnSymbolToTsCode = (symbol: string): string => {
  // throws ParseError if symbol doesn't match /^\d{6}$/
  const head = symbol[0];
  if (head === "6") return `${symbol}.SH`;
  if (head === "0" || head === "3") return `${symbol}.SZ`;
  if (symbol.startsWith("68")) return `${symbol}.SH`;
  if (head === "8" || head === "4") return `${symbol}.BJ`;
  throw new ParseError("tushare-cn", `unrecognized A-share symbol ${symbol}`);
};

export const hkSymbolToTsCode = (symbol: string): string => {
  // accepts "700" / "00700" / "5" → "00700.HK"
  const digits = symbol.replace(/^0+/, "");
  return `${digits.padStart(5, "0")}.HK`;
};

export const fundSymbolToTsCode = (symbol: string, hint?: "OF" | "EXCHANGE"): string => {
  // explicit hint overrides; else infer from symbol prefix
  if (hint === "OF") return `${symbol}.OF`;
  if (hint === "EXCHANGE") return cnSymbolToTsCode(symbol);
  if (/^[15]\d{5}$/.test(symbol)) return cnSymbolToTsCode(symbol); // ETF/LOF
  return `${symbol}.OF`; // default to open-end
};
```

Reverse mapping (`ts_code` → Arc symbol) strips the suffix.

---

## UI contract

**N/A** — this feature ships zero UI. Downstream consumers see new markets light up:

- Watchlist search modal: today shows "Stage 2 仅支持美股，更多市场即将推出"; Stage 3 (Block A末) updates copy + extends `searchSymbols` to delegate per market via registry. **Out of scope for this spec** — copy + UX change land in `holdings-table-stage-3.md` or a dedicated `markets-cross-market-search-stage-3.md`.
- Holdings table / asset detail (Block C): consume `PriceQuote` identically to today.
- Settings → DEV tools: existing fixture toggle continues to work; Tushare adapter has no DEV-specific code path beyond the dev seed.

---

## Acceptance criteria (S3-AC-A1.x)

> A1 prefix = Block A, adapter 1. CoinGecko adapter (Block A 第二个 spec) will own A2. ADR 011 owns A3.

### S3-AC-A1.1 — CN spot fetch happy path

**Given** Tushare token configured + registry default bootstrapped
**When** the app calls `registry.resolvePriceAdapterByAssetId("CN:600519").fetchLatest("600519")`
**Then** exactly one POST to `https://api.tushare.pro` fires with body `{api_name: "daily", token, params: {ts_code: "600519.SH"}, fields: "ts_code,trade_date,close,pct_chg"}`
**And** the returned `PriceQuote` has `assetId === "CN:600519"`, `currency === "CNY"`, `source === "tushare-cn"`, `price` a `Decimal` > 0, `changePercent` a `Decimal` (sign matches `pct_chg`)
**And** `asOf` parses to a valid ISO timestamp at 07:00 UTC of the `trade_date` (15:00 Asia/Shanghai)

### S3-AC-A1.2 — HK spot fetch ⏸ **Deferred to Stage 4**（决策 14: HK=b → AKShare 接管 Stage 3）

**Stage 3 替代**: see ADR 011 §决策一 — `registry.resolvePriceAdapter("HK")` 返回 `createAkshareHkAdapter` 而非 Tushare HK；同等 AC 由 AKShare wrapper spec 覆盖（Phase 2 commit #11 / #13）。

### S3-AC-A1.3 — FUND NAV fetch ⏸ **Deferred to Stage 3 末 / Stage 4**（FUND Stage 3 主源 = AKShare；用户升 2000 积分后切回 Tushare）

**Stage 3 替代**: `registry.resolvePriceAdapter("FUND")` 返回 `createAkshareFundAdapter`；同等 AC 由 AKShare wrapper spec 覆盖。Tushare FUND adapter (`commit #6`) 在用户达 2000 积分后再实施。

### S3-AC-A1.4 — FUND price fetch (ETF) ⏸ **Deferred to Stage 4**（需 5000 积分 / ¥500/年；Stage 3 走 AKShare）

**Stage 3 替代**: ETF（`/^[15]\d{5}$/` 形如 `510300`）走 AKShare `fund_daily` 路径；Tushare `fund_daily` adapter 评估 Stage 4 是否升级。

### S3-AC-A1.5 — Error mapping: 频率超限

**Given** Tushare returns HTTP 200 with body `{ code: 40203, msg: "抱歉，您每分钟最多访问该接口60次", data: null }`
**When** `fetchLatest` is invoked on any of the three adapters
**Then** a `RateLimitError` is thrown
**And** `error.source` matches the per-adapter source string
**And** `error.retryAfterMs === 60_000`

### S3-AC-A1.6 — Error mapping: 积分不足 → **`QuotaError`** (refined 2026-05-20)

**Given** Tushare returns `{ code: 40002, msg: "权限不足", data: null }`
**When** `fetchLatest` is invoked
**Then** a **`QuotaError`** is thrown (NOT `NetworkError`, NOT `NotFoundError`)
**And** `err instanceof QuotaError === true` and `err instanceof NetworkError === false`（QuotaError extends AdapterError directly — 决策 15）
**And** `err.code === 40002`
**And** `err.source` matches per-adapter source string

**Note**: `code 40001` (token invalid) 不映射到 QuotaError，仍是 `NetworkError` — withFallback 必须 bubble token 错误。

### S3-AC-A1.7 — Empty result = NotFoundError

**Given** Tushare returns `{ code: 0, msg: "", data: { fields: [...], items: [] } }`
**When** `fetchLatest("000000")` is invoked
**Then** a `NotFoundError` is thrown

### S3-AC-A1.8 — Symbol resolver edge cases

| Input symbol | Adapter | Expected ts_code | OR throws  |
| :----------- | :------ | :--------------- | :--------- |
| `600519`     | CN      | `600519.SH`      | —          |
| `000001`     | CN      | `000001.SZ`      | —          |
| `300750`     | CN      | `300750.SZ`      | —          |
| `688981`     | CN      | `688981.SH`      | —          |
| `831010`     | CN      | `831010.BJ`      | —          |
| `abcd`       | CN      | —                | ParseError |
| `700`        | HK      | `00700.HK`       | —          |
| `00700`      | HK      | `00700.HK`       | —          |
| `5`          | HK      | `00005.HK`       | —          |
| `000001`     | FUND    | `000001.OF`      | —          |
| `510300`     | FUND    | `510300.SH`      | —          |

### S3-AC-A1.9 — searchSymbols hits bundled JSON only (Open Q 2 = A)

**Given** `EXPO_PUBLIC_TUSHARE_TOKEN` is set
**When** `cnAdapter.searchSymbols("茅台")` is invoked
**Then** **zero** HTTP requests to `api.tushare.pro` are made
**And** results are read from `static/tushare-basics/stock.json` (substring match on name + symbol)
**And** result count caps at 8 (same as Finnhub)

### S3-AC-A1.10 — Historical fetch (Block C dependency)

**Given** `fetchHistorical("600519", new Date("2026-01-01"), new Date("2026-05-19"))` on CN adapter
**When** invoked
**Then** Tushare `daily` is called with `start_date=20260101&end_date=20260519`
**And** the returned `ReadonlyArray<PriceQuote>` is non-empty (assuming trading days in range)
**And** entries are sorted ascending by `asOf`
**And** each entry's `asOf` is the 15:00 Asia/Shanghai mapping of `trade_date`

### S3-AC-A1.11 — Token absent = adapter not registered (real-flow integrity per ADR 007)

**Given** `EXPO_PUBLIC_TUSHARE_TOKEN` is unset
**When** the app boots
**Then** `registry.resolvePriceAdapter("CN")` throws `NotFoundError("registry", "no price adapter for market CN")`
**And** there is **no fixture / mock fallback** (CLAUDE.md §3.5 — dev must use real Tushare or accept the error)

---

## Out of scope (Stage 3 explicitly NOT doing in this spec)

- **AKShare integration itself** — this spec only references ADR 011's Phase 2；AKShare wrapper service + adapters 自己有 implementation plan
- **Tushare HK 单独权限申请**（决策 14: HK=b 锁定 Stage 3 不申请；Stage 4 评估）
- **Tushare 5000 积分 (¥500/年) ETF (`fund_daily`)** — Stage 4 评估
- **Tushare `stock_basic` / `fund_basic` 抓取** — 阻塞在用户升 ¥200 / 2000 积分；`tools/refresh-tushare-basics.ts` 用户手动跑
- **CN searchSymbols via Tushare** — Stage 3 走 AKShare wrapper search；Tushare 路径在 2000 积分升级后再启
- **Live `searchSymbols` against Tushare 每查一次烧积分** — quota-protected; revisit Stage 4
- **Intraday quotes** — Tushare 免费版 unsupported; Stage 4 with paid tier or alt source
- **WebSocket / push price streams** — Stage 4
- **`stock_basic` / `fund_basic` daily auto-refresh GH Action** — Block F
- **Markets Tab cross-market segmented control** (segmented control to filter watchlist by CN/HK/US/FUND/CRYPTO) — `holdings-table-stage-3.md` or dedicated spec
- **Asset detail page consumption** — `asset-detail-stage-3.md`
- **TWR / Performance Attribution algorithm** — Block D, separate specs
- **Refactoring `PriceAdapter.market` to `Market[]`** — explicit choice §决策 4; one adapter per market remains
- **CoinGecko (CRYPTO) adapter** — next spec in Block A (`coingecko-adapter-stage-3.md`)
- **Splits / dividends / corporate action adjustments** — Stage 4 (Tushare offers `adj_factor`, not Stage 3)

---

## Implementation plan (reshape 2026-05-20)

> Routing: Sonnet/Cursor for adapter shell + tests；Opus for ADR 011 + commit #1 fold-in review；ADR 011 §决策五 Phase 2 commits live in this same Block A 范围. Each commit independently passes `pnpm typecheck` + `pnpm lint` + `@arc/data-sources` tests.

### Phase 1A — Tushare CN baseline

1. **✅ `feat(data-sources): tushare client + error mapping + QuotaError fold-in`** — `adapters/tushare/client.ts` + `__tests__/tushare-client.spec.ts` + `errors.ts` `QuotaError extends AdapterError`. Covers S3-AC-A1.5 / A1.6 / A1.7. 14 unit tests, 82/82 ✅ at 2026-05-20. **Status: 代码就绪，待 git commit**.
2. **`feat(data-sources): tushare symbol resolver`** — `adapters/tushare/symbol-resolver.ts` + tests covering S3-AC-A1.8（CN 行 + HK/FUND 函数保留导出但 Stage 3 不被业务直接调用，仅用于 ADR 011 Phase 2 后 commit #5/#6 重启时复用）.
3. ⏸ **deferred** `chore(data-sources): seed bundled basics snapshots` — `stock_basic` 需 2000 积分；阻塞在用户升 ¥200/年。Phase 2 AKShare wrapper search 在此期间承担 CN searchSymbols.
4. **`feat(data-sources): tushare CN adapter`** — `adapters/tushare/cn.ts` 仅实现 `fetchLatest` (via `daily`) + `fetchHistorical`；`searchSymbols` 阶段性抛 `NotImplementedError`（等 #3 解锁）. Spec mirrors `finnhub.spec.ts` density.
5. ⏸ **deferred to Stage 4 / 决策 14**: `feat(data-sources): tushare HK adapter` — Stage 3 HK=b 走 AKShare；该 commit 不实施.
6. ⏸ **deferred to Stage 3 末 / Stage 4**: `feat(data-sources): tushare FUND adapter` — 用户升 2000 积分后再启 OF NAV 主源；ETF 评估 5000 积分.
7. **`feat(data-sources): registry adds CN-only Tushare adapter`** — `registry.ts` + `registry.spec.ts` covering token-absent (S3-AC-A1.11); HK / FUND 在 Phase 1A 期间 `resolvePriceAdapter` 抛 `NotFoundError`（Phase 2 才接 AKShare）.
8. **`feat(mobile): bootstrap reads EXPO_PUBLIC_TUSHARE_TOKEN`** — `apps/mobile/src/lib/data-sources.ts`.
9. **`feat(seed): CN-only fixture rows in seed-core`** — dev panel `default:cn-only` 单场景；HK / FUND seed 推到 commit #14.

   **── Phase 1A DoD: 用户录 `CN:600519` 交易 + 看到真实 CNY 价 ──**

### Phase 2 — AKShare wrapper（ADR 011 §决策五 Phase 2 必启）

10. **`chore(services): akshare-wrapper Vercel Python serverless init`** — `services/akshare-wrapper/` (monorepo 内) + `vercel.json` + `requirements.txt` + `/api/quote` + `/api/historical`. Token-protected (`X-Arc-Token` header).
11. **`feat(data-sources): akshare adapters (cn/hk/fund)`** — `adapters/akshare/{client,cn,hk,fund,index}.ts` + tests 同 Tushare adapter 密度（mocked fetcher）.
12. **`feat(data-sources): withFallback wrapper`** — `adapters/with-fallback.ts` + `__tests__/with-fallback.spec.ts` — ADR 011 §决策三 classifier 表格驱动 (RateLimit / QuotaError / NetworkError 5xx → try-secondary；NotFound / ParseError / 40001 / 401-403 → bubble).
13. **`feat(data-sources): registry wires AKShare for HK/FUND + CN withFallback`** — registry 接 4 个新 env vars；HK/FUND primary = AKShare adapter；CN = `withFallback(tushareCn, akshareCn)` when enabled.
14. **`feat(mobile+seed): AKShare env bootstrap + HK/FUND seed scenarios`** — `EXPO_PUBLIC_AKSHARE_*` 读入；seed `default:hk-only` / `default:fund-only` / `default:cross-market`.

    **── Phase 2 DoD: 用户录 `HK:00700` / `FUND:000001` / `FUND:510300` + 看到真实价 ──**

### Wrap-up

15. **`docs(spec+adr): mark this spec + ADR 011 Phase 2 实施完成 + bump session-state`** — Block A 收尾.

**Order rationale**: Phase 1A 跑通 CN → Phase 2 引入 Python service + AKShare + fallback wrapper → CN/HK/FUND 全市场 Stage 3 self-use ready。每个 commit 独立 PR-able。AKShare wrapper service 在 commit #10 起独立 Vercel deploy，不影响 mobile app build pipeline.

---

## Test plan (per `docs/testing-strategy.md`)

| AC                 | Layer       | Artifact / how to run                                                                                                                       |
| :----------------- | :---------- | :------------------------------------------------------------------------------------------------------------------------------------------ |
| A1.1 / A1.2        | L1 (unit)   | `__tests__/tushare-cn.spec.ts` / `tushare-hk.spec.ts` with mocked `fetcher`                                                                 |
| A1.3 / A1.4        | L1          | `__tests__/tushare-fund.spec.ts` — discriminator: open-end vs ETF                                                                           |
| A1.5 / A1.6 / A1.7 | L1          | `__tests__/tushare-client.spec.ts` — all error-mapping branches                                                                             |
| A1.8               | L1          | `__tests__/symbol-resolver.spec.ts` — table-driven                                                                                          |
| A1.9               | L1          | `tushare-cn.spec.ts` — assert `fetcher` is **never called** during `searchSymbols`                                                          |
| A1.10              | L1          | `tushare-cn.spec.ts` — historical window with mocked 5-day response                                                                         |
| A1.11              | L1          | `registry.spec.ts` — token-absent branch                                                                                                    |
| **Live smoke**     | L4 (manual) | After commit 9: `pnpm seed:default:cn-only` → record `CN:600519` → see live CNY price in `/portfolio`. Run once with real token, not in CI. |

**Property tests** — not warranted at this layer. Tushare adapter is a pure data-shape mapper. Property tests live in `@arc/core` for TWR / rebalance invariants (Block D). The most useful invariant here ("`ts_code → symbol → ts_code` is idempotent") is implicitly covered by S3-AC-A1.8's table.

---

## Risks (refined 2026-05-20 after Tushare 免费版 实证)

| Risk                                                          | Likelihood                                  | Impact                                        | Mitigation                                                                                                                 |
| :------------------------------------------------------------ | :------------------------------------------ | :-------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------- |
| **Tushare 免费版 (20 积分) 仅覆盖 A 股 daily**                | **Confirmed**                               | HK / FUND / `stock_basic` 完全不可访问        | **AKShare wrapper (ADR 011 Phase 2) 必启** —— Block A 实施计划已并入 commit #10-14                                         |
| `stock_basic` 需 2000 积分 → CN searchSymbols 无 Tushare 路径 | Confirmed                                   | CN 搜索 Stage 3 dev 期不可用 (除非走 AKShare) | Phase 2 AKShare adapter `searchSymbols` 承担 CN search；用户升 ¥200 后 commit #3 解锁切回                                  |
| AKShare wrapper Vercel 冷启动 1-3s                            | Med                                         | 用户首次 HK/FUND 拉价感知卡顿                 | `priceCache` 5-min TTL；一次冷启动后同 symbol 命中缓存                                                                     |
| AKShare 底层抓取源 TOS 风险（L3 行情数据未授权传播）          | Low (Stage 3 self-use)；High (Stage 4 公开) | 法务问题 Stage 4 触发                         | ADR 011 §决策四 Phase 3 sunset 评估；wrapper service 必须 token 鉴权（限本人 app）                                         |
| `pct_chg` field absent on certain Tushare API versions        | Med                                         | `changePercent: null` shipped                 | Adapter accepts `null` already (PriceQuote contract); watchlist / daily-snapshot fall back to "—" display                  |
| Tushare endpoint occasional 5xx                               | Med                                         | Quote temporarily unavailable                 | Cache layer + `withFallback(tushareCn, akshareCn)` (Phase 2 commit #13)；ADR 010 stale-quote 兜底                          |
| Bundled JSON drift vs Tushare master list                     | Low                                         | Search misses new symbols                     | Quarterly manual refresh + GH Action in Block F                                                                            |
| User-provided token leaks via crash report                    | Low                                         | API key exposure                              | Sentry scrubber config already filters `EXPO_PUBLIC_*` (verify in commit 8); rotate token from Tushare dashboard if leaked |
| `fund_nav` requires extra call for changePercent              | Low (deferred)                              | 2× 积分 burn per FUND fetch                   | Stage 3 dev 期 FUND 走 AKShare（无积分）；用户升 2000 积分后再启 Tushare `fund_nav` + cache prev unit_nav                  |

---

## Verification checklist before merging back to `dev/stage-3`

### Phase 1A DoD (commits #1, 2, 4, 7-9)

- [ ] S3-AC-A1.1 / A1.5 / A1.6 (QuotaError) / A1.7 / A1.8 (CN行) / A1.9 (NotImplementedError 阶段性) / A1.10 / A1.11 通过
- [ ] Live smoke: `CN:600519` round-trip on real Tushare with user token
- [ ] `pnpm typecheck` 6/6 ✅ / `pnpm lint` 6/6 ✅ / `pnpm test` ✅
- [ ] `apps/mobile/.env.example` 加 `EXPO_PUBLIC_TUSHARE_TOKEN=`

### Phase 2 DoD (commits #10-14)

- [ ] AKShare wrapper Vercel 部署 + `X-Arc-Token` 鉴权可工作
- [ ] `withFallback` classifier 表（ADR 011 §决策三）全部通过 unit test
- [ ] Live smoke: `HK:00700` / `FUND:000001` / `FUND:510300` round-trip via AKShare
- [ ] Live smoke: 模拟 Tushare CN `RateLimitError` → 自动切 AKShare CN
- [ ] `apps/mobile/.env.example` 加 `EXPO_PUBLIC_AKSHARE_WRAPPER_URL=` `EXPO_PUBLIC_AKSHARE_WRAPPER_TOKEN=` `EXPO_PUBLIC_ENABLE_AKSHARE_CN_FALLBACK=true`

### Block A 收尾

- [ ] `session-state.md` bumped (Block A Accepted; next = Block B `multi-portfolio-stage-3.md`)
- [ ] ADR 011 Phase 2 状态升级为「已实施」

---

## Hand-off

- **Implementation owner**:
  - Phase 1A commits #1-2, 4, 7-9 → Sonnet/Cursor (Finnhub template + commit #1 已就绪)
  - Phase 2 commits #10 (Vercel Python infra) → Sonnet + 用户协作部署；#11-14 → Sonnet/Cursor
- **Review owner**: Opus (architecture review at commit #1 fold-in、ADR 011 §决策三 classifier、Phase 2 法务边界 reconfirm)
- **External dependency**:
  - 用户 Tushare token（commit #1 fold-in 已不需要 token 跑测试；commit #8 之后真实拉价才需要）
  - 用户 Vercel 账号 + Vercel CLI 本地登录（commit #10 部署 AKShare wrapper）
  - 用户复读 `docs/legal-risk-map.md` L3 / L6 / §六.6 — AKShare TOS 自用阶段评估
- **Blocking ADR**: ADR 011 已 Accepted（2026-05-20）；Phase 2 实施直接走 commit chain

---

## Context bundle

```bash
pnpm ctx:feature tushare-adapter
```

Config: `.specify/feature-specs/stage-3/tushare-adapter.repomix.json`
