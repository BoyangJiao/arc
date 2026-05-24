# Feature: Data Sources — Stage 1 Adapters

- **Status**: Done
- **Author**: BoyangJiao + Claude
- **Created**: 2026-05-14
- **Implements**: dev-plan §六 数据源选型、IA v2.2 J2-J3、CLAUDE.md §3.4 Adapter 抽象铁律
- **Conforms to**: `.specify/data-model-invariants.md`（PriceQuote / FxRate 类型契约）

---

## Why

User Journey J2 验收要求"录入 AAPL → 看到 CNY 计价市值"，需要：

1. 拉 AAPL 实时价（USD）
2. 拉 USD → CNY 汇率
3. 计算 `shares × price × fxRate`

Stage 3 起会接 4 个新市场（CN / HK / FUND / CRYPTO），每个市场不同数据源。所以**必须先建抽象层**，否则到 Stage 3 业务代码会被 vendor SDK 绑死。

CLAUDE.md §3.4 立的铁律："业务代码只能通过 `packages/data-sources/` 的 adapter 接口访问外部 API；不准在 `apps/` 或 `packages/core/` 中直接 fetch 厂商 API"。

---

## 设计决策

### 1. Adapter 接口形态：function factory 而不是 class

```ts
// 不是
class AlphaVantageAdapter implements PriceAdapter { ... }
new AlphaVantageAdapter({ apiKey });

// 是
const createAlphaVantageAdapter = (config) => ({ ... });
const adapter = createAlphaVantageAdapter({ apiKey });
```

**理由**：

- 测试时换 fetcher 更简洁（直接传函数，不用 mock class methods）
- 没有 `this` 隐式状态，纯 closure
- TypeScript 推断更友好

### 2. Stage 1 数据源选择

| 市场    | 数据源            | 限制              | 替代方案（Stage 3）            |
| :------ | :---------------- | :---------------- | :----------------------------- |
| US 股票 | Alpha Vantage     | 25 req/day, 5/min | Polygon.io (付费实时), Finnhub |
| FX 汇率 | Frankfurter (ECB) | 仅日终，主流币种  | 商业实时 FX 数据源             |

**Frankfurter 选择理由（替代 exchangerate.host）**：

- exchangerate.host 2024 年起需 API key（之前免费）
- Frankfurter 仍完全免费、无 key、ECB 数据可信
- 限制：只支持主流法币（CNY/USD/HKD/JPY/EUR/GBP 等）
- 加密货币和小币种 Stage 3 接 CoinGecko 等

### 3. 双层缓存

```
TanStack Query (in-memory, 60s staleTime)
        │
        ↓ miss / stale
Supabase price_snapshots / fx_rates (DB cache, 15min / 4h freshness)
        │
        ↓ miss
Adapter (Alpha Vantage / Frankfurter)
        │
        ↓ result
Write back to DB cache + return up the stack
```

**好处**：

- TanStack Query 防 React 重渲染抖动
- Supabase 缓存让多用户共享 → 25/day 配额够用
- 三层都有针对性的失效策略

### 4. 错误分层（typed errors）

```
AdapterError (base)
├─ NetworkError       — fetch 失败 / 5xx
├─ RateLimitError     — 限流（含 retryAfterMs）
├─ ParseError         — schema 漂移
├─ NotFoundError      — symbol/currency 不存在
└─ NotImplementedError — adapter 不支持该方法
```

业务层（mobile hook / UI）按错误类型决定 UX：

- `RateLimitError` → "配额用完，X 分钟后再试" + 降级显示缓存
- `NetworkError` → "离线" banner + 重试按钮
- `ParseError` → 静默 + Sentry（厂商改 schema 是 P0）
- `NotFoundError` → "找不到资产 XYZ"

### 5. RLS 写入限制（Stage 1 接受，Stage 4 修复）

Stage 1 schema migration 把 `price_snapshots` / `fx_rates` 设为 **public-read + service-role-write**。client 写不进去。

Stage 1 选择：**接受 cache 写失败**（cache.set 内部 console.warn 后吞掉错误）。TanStack Query 的 60s in-memory cache 防止单 session 内重复 fetch。

**Stage 2/4 修复路径**：

- 选项 A：Edge Function `cache:price-snapshots` + `cache:fx-rates`，client 调它，函数用 service role 写入
- 选项 B：放宽 RLS — 给 `authenticated` 加 INSERT policy（但有滥用风险）

推荐 A，更干净。

### 6. Registry 路由

```ts
const registry = createRegistry({
  priceAdapters: { US: alphaVantage }, // Stage 3 加 CN/HK/CRYPTO/FUND
  fxAdapter: frankfurter,
});

const adapter = registry.resolvePriceAdapterByAssetId("US:AAPL"); // → alphaVantage
```

业务 hook 不持有具体 adapter；从 `registry` 解析。Stage 3 加新市场时，业务 hook 0 改动。

---

## 已完成

### packages/data-sources（新增）

| 文件                           | 角色                                                             |
| :----------------------------- | :--------------------------------------------------------------- |
| `src/interfaces.ts`            | `PriceAdapter` / `FxAdapter` / `PriceCache` / `FxCache` 接口契约 |
| `src/errors.ts`                | 5 个 typed error 子类                                            |
| `src/adapters/alphavantage.ts` | US 股票实时价；处理 Note / Information rate-limit 信号           |
| `src/adapters/frankfurter.ts`  | ECB 汇率；同币短路；guard 不支持的币种                           |
| `src/cache/price-cache.ts`     | Supabase price_snapshots 读写（DI: SupabaseClient）              |
| `src/cache/fx-cache.ts`        | Supabase fx_rates 读写                                           |
| `src/fetch-with-cache.ts`      | facade: 读优先 cache → adapter → 写回                            |
| `src/registry.ts`              | Market → adapter 路由                                            |
| `src/index.ts`                 | barrel                                                           |

### apps/mobile（新增）

| 文件                             | 角色                                                                   |
| :------------------------------- | :--------------------------------------------------------------------- |
| `src/lib/market-data.ts`         | 单例：注册 Alpha Vantage US adapter + Frankfurter FX + Supabase caches |
| `src/lib/query-client.ts`        | TanStack Query QueryClient（staleTime=60s, gcTime=5min, retry=2）      |
| `src/lib/queries/use-price.ts`   | `usePrice(assetId)` hook，自动过 facade                                |
| `src/lib/queries/use-fx-rate.ts` | `useFxRate(from, to)` hook，含同币短路                                 |
| `src/lib/queries/index.ts`       | barrel                                                                 |
| `app/_layout.tsx`                | 加 `QueryClientProvider` 在 HeroUI 与 Auth 之间                        |
| `app/index.tsx`                  | "Live Data Preview" Card：实测 AAPL + USD/CNY + 10 股 AAPL CNY 计价    |

### Tests (31/31 passing)

- `__tests__/alphavantage.spec.ts` (13 tests): success parsing, all error types, header-based rate-limit
- `__tests__/frankfurter.spec.ts` (8 tests): success, same-currency short-circuit, unsupported currency, historical endpoint
- `__tests__/fetch-with-cache.spec.ts` (10 tests): hit/miss/bypass for both price + FX facades

### env

`apps/mobile/.env`:

```
EXPO_PUBLIC_ALPHAVANTAGE_API_KEY=ZMNVB4TDFMXXNFYD  # free tier 25/day
```

Frankfurter 需要 0 key，硬编码在 adapter。

---

## 验证（端到端）

### 自动测试

```bash
pnpm --filter @arc/data-sources test    # 31/31 pass
pnpm typecheck                           # 6/6 workspaces clean
```

### 手动（在 Expo Go 中）

登录后 Home 屏幕看「Live Data Preview」Card：

- AAPL 价应显示真实当前价（如 $245.32 USD）+ 交易日
- USD→CNY 应显示 ECB 最新（如 ¥7.18）+ 日期
- 「10 shares of AAPL in CNY」自动计算（如 ¥17,609.99）
- 数字下方应有"仅供参考，可能延迟"角标

### 错误场景验证

- **限流**：把 .env 里 key 改成无效值 → AAPL Card 应显示限流/auth 错误（红字）
- **离线**：关 WiFi 重 mount → 应显示 NetworkError
- **缓存命中**：60 秒内重新登录 → AAPL Card 瞬时显示（不发 API call）

### Supabase advisor 验证

```bash
# Stage 1 step 1 跑过；Stage 1 step 3 不动 schema，无需重跑
```

---

## 已知限制 / Stage 2+ 后续

1. **Cache 写失败被吞**：Stage 4 用 Edge Function 修复
2. **Alpha Vantage 25/day 限额**：Stage 3 升级到 Polygon.io ($29/月) 或类似
3. **`asOf` 时间近似**：Alpha Vantage 用 "20:00 UTC ≈ NYSE close"，DST 期间偏差 1h；Frankfurter 用 "15:00 UTC ≈ ECB publish"。Stage 3 接精确 trading calendar 后修
4. **不处理 stale-while-revalidate**：cache 命中即返回，不在后台更新；Stage 2+ 加
5. **没有 history**：Alpha Vantage / Frankfurter adapter 都只实现 fetchLatest；Stage 3 加 fetchHistorical（J13 多时间段图表需要）
6. **没有 retry/backoff**：依赖 TanStack Query 默认 2 次重试；Stage 2 可加 p-retry 自定义策略

---

## Stage 3 entry（2026-05-19）

US market switched **Alpha Vantage → Finnhub** for **60/min** vs **25/day** quota. `createAlphaVantageAdapter` retained in `@arc/data-sources` for rollback; default registry wiring uses `createDefaultPriceAdapters` → `createFinnhubAdapter`. Mobile env: `EXPO_PUBLIC_FINNHUB_API_KEY` (see repo-root `.env.example`).

---

## 不在本 step 范围

- Stage 3 数据源（Tushare CN/HK、CoinGecko 加密、天天基金 FUND）→ Stage 3
- Edge Function for cache writes → Stage 4
- 历史价格 fetchHistorical → Stage 3
- 价格异动推送（J15）→ Stage 3
- AI 截图导入（J17）→ Stage 4
