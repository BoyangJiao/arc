# Cursor 启动 prompt — Stage 3 CoinGecko adapter（Block A 漏单收口）

> 复制下方代码块到 Cursor Composer / Chat。该 prompt 不指定模型 —— Cursor auto 按 `CLAUDE.md §七 + §十二` 自评估路由（提示：6 个 commit 全部 = Sonnet 套路 adapter 集成，与 Finnhub 模板 ~80% 重合）。
>
> **本 spec 是 Block C 闭环的前置**：CoinGecko 实施完 + registry mount `CRYPTO` 之后，Block C 的跨市场 transaction entry 才能录加密资产。

---

```
接力 Arc Stage 3 — CoinGecko (CRYPTO) adapter，Block A 漏单收口。

## 必读（按此顺序，不要跳）

1. `CLAUDE.md` — 项目铁律（§三 工程铁律 + §五 monorepo 结构 + §七 模型分工 + §十二 自我路由）
2. `.specify/constitution.md` — P0 约束（Decimal everywhere / Real-flow integrity / Adapter 抽象边界）
3. `.specify/session-state.md` — Stage 3 当前进度
4. `.specify/feature-specs/stage-3/coingecko-adapter-stage-3.md` — **本任务契约**（Status = Accepted，6 决策，0 open questions，6 commits）
5. `docs/adr/011-multi-source-fallback-and-akshare.md` — 多源 fallback；CRYPTO 单源 CoinGecko，无 secondary

## 模板（必读 + 必照搬模式）

- `packages/data-sources/src/adapters/finnhub.ts` + `__tests__/finnhub.spec.ts` —— 形态 ~80% 一致：GET REST + 行式 JSON + 单市场 + searchSymbols + AdapterError 子类
- `packages/data-sources/src/adapters/tushare/symbol-resolver.ts` —— ticker ↔ external-id 映射模板（CoinGecko ticker → coin_id 同模式）
- `packages/data-sources/src/registry.ts` —— mount 新 adapter 的位置（CRYPTO 永远挂载，无 token 依赖）
- `packages/data-sources/src/interfaces.ts` —— `PriceAdapter` 契约（**不要改这个文件**）

## CoinGecko API 关键事实（spec §Architecture 完整描述）

- 公共 endpoint: `https://api.coingecko.com/api/v3/`
- Free tier: 10-30 req/min，**无 API key**（Stage 4 评估 Demo key + `x-cg-demo-api-key` header）
- `/simple/price?ids={coin_id}&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true` → `{ "bitcoin": {"usd": 67234.5, "usd_24h_change": 2.34, "last_updated_at": 1747612800} }`
- `/coins/{id}/market_chart?vs_currency=usd&days=N` → `{ "prices": [[ts_ms, price], ...] }`
- `/search?query=btc` → `{ "coins": [{id, symbol, name, market_cap_rank, ...}] }`
- `/coins/list` → 全币种列表（仅用于 bundled JSON 生成；adapter runtime 不调）
- 错误：429 + `Retry-After` 限流 / 404 / 5xx；**不存在 QuotaError**（无积分概念）

## 任务 — coingecko spec § Implementation plan 6 commits

按顺序执行，每个 commit 独立 PR-able。每个 commit 末尾跑 `pnpm typecheck && pnpm lint && pnpm --filter @arc/data-sources test`（全 6/6 + 绿）。

### commit #1 — `feat(data-sources): coingecko client + error mapping`

- 新建 `packages/data-sources/src/adapters/coingecko/client.ts`
  - `createCoingeckoClient({ fetcher?, apiKey? })` → 内部 GET helper
  - 错误归一化：
    - HTTP 429 + Retry-After → RateLimitError(source, retryAfterMs)
    - HTTP 404 / 响应空对象 `{}` → NotFoundError(source, ticker)
    - HTTP 401 / 403 → NetworkError(source, "HTTP 401/403...") (Stage 4 demo key 才可能)
    - HTTP 5xx → NetworkError
    - fetch throw → NetworkError(source, cause)
    - JSON parse fail → ParseError
- 新建 `packages/data-sources/__tests__/coingecko-client.spec.ts`
  - mocked fetcher，~10 个 case 覆盖每个错误分支 + happy path
- 不要 `QuotaError` —— CoinGecko 没有"积分耗尽"概念

### commit #2 — `feat(data-sources): coingecko coin-id resolver + bundled top200 JSON`

- 新建 `packages/data-sources/src/adapters/coingecko/coin-id-resolver.ts`
  - `tickerToCoinId(ticker, bundled, liveSearchFallback?)` 函数：优先 bundled JSON 查找；未命中 fallback live `/search`（返回 coin_id 给 caller 用，二级查）
- 新建 `packages/data-sources/src/static/coingecko-coins-top200.json`
  - 结构 `{ "BTC": "bitcoin", "ETH": "ethereum", "USDC": "usd-coin", "SOL": "solana", ... }` (200 entries)
  - 用户跑一次 `pnpm tsx tools/refresh-coingecko-coins.ts`（你写这个 script + 提示用户运行）拉 `/coins/list` 全量按 market_cap_rank 排序取 top 200
  - 文件大小 ~10-15KB，可直接 commit
- 新建 `__tests__/coingecko-coin-id-resolver.spec.ts` 表格驱动测试

### commit #3 — `feat(data-sources): coingecko adapter (fetchLatest + fetchHistorical + searchSymbols)`

- 新建 `packages/data-sources/src/adapters/coingecko/index.ts`
  - `createCoingeckoAdapter(config?)` → PriceAdapter
  - `market: "CRYPTO"`, `source: "coingecko"`
  - `fetchLatest(ticker)`：tickerToCoinId → `/simple/price` → 解析 → PriceQuote
  - `fetchHistorical(ticker, from, to)`：tickerToCoinId → `/coins/{id}/market_chart?vs_currency=usd&days=N` → 数组按 asOf asc 返回
  - `searchSymbols(query)`：先 bundled 命中 ≥ 3 直接返回；否则 fallback `/search` filter market_cap_rank ≤ 500 取前 8
- 新建 `__tests__/coingecko.spec.ts`，密度参照 finnhub.spec.ts
  - 覆盖 spec §AC 全部 S3-AC-A2.1 ~ A2.8

### commit #4 — `feat(data-sources): registry mounts CRYPTO = CoinGecko`

- 修改 `packages/data-sources/src/registry.ts`：
  - `DefaultPriceAdaptersConfig` 加 `coingeckoApiKey?: string` (Stage 4 用)
  - 内部：`adapters.CRYPTO = createCoingeckoAdapter({ apiKey: config.coingeckoApiKey })` —— 永远挂载，无 token 前置条件
- 修改 `__tests__/registry.spec.ts`：
  - CRYPTO market 即使无 key 也 resolve 成功（free tier）
  - `resolvePriceAdapterByAssetId("CRYPTO:BTC")` 返回 CoinGecko adapter

### commit #5 — `feat(mobile+seed): CRYPTO seed scenario`

- `supabase/functions/_shared/seed-core.ts` + `tools/seed-dev-data.ts` 增加 `default:crypto-only` 场景：
  - assets：CRYPTO:BTC / CRYPTO:ETH / CRYPTO:USDC（migration 0001 / 0010 应已允许 USD market 但 CRYPTO 不一定，详情见 Block C spec 决策的 migration 0012 —— 但本 spec 不写 migration，等 Block C 一并出；本 commit 用 service_role 绕 RLS 写）
  - transactions：BTC × 0.5 / ETH × 5 / USDC × 1000，trade_date 在最近 30 天
- DEV 面板挂载 `crypto-only` 场景（按现有 group 模式）

### commit #6 — `docs(spec+session-state): mark coingecko-adapter-stage-3 Accepted + bump session-state`

- spec status 已经 Accepted（Opus 改了）
- session-state CoinGecko 行从 ⏳ 改 ✅
- 触发 next step：Block C 主链可以起（用户给 `cursor-stage-3-block-c-kickoff.md` handoff prompt —— Opus 那边会准备）

## 路线图边界（不要超出本 spec 范围）

- **不要**改 `interfaces.ts` 契约
- **不要**碰 Block B / Block C 范围（持仓表 / asset 详情 / tx entry 这些是 Block C，别提前动）
- **不要**写 migration 0012 (CRYPTO assets RLS) —— Block C spec 已把这个 migration 归到那边；CoinGecko spec scope **不含**任何 DB 变更
- **不要**改 ADR 011 —— Block C spec 会改 §决策三（NotImpl→try-secondary）

## 路由自评估（每个 commit 边界做一次，按 §十二）

- commit #1-#5 全部 Sonnet 套路
- 任何 commit 反复改不对 ≥ 2 次（错误映射 / coin-id resolver edge case / market_chart 时间 window 解析）→ 升 Opus

## Hand-off 回 Opus 的触发点

- 6 commits 全部完成后 ping Opus → 我跑 grep + typecheck + tests + 抽查 commit diff
- 中间不必 ping（每个 commit 都简单）

## DoD（本 spec 结束 = CRYPTO adapter live + 准备进 Block C）

- commit #1-6 全部 merged 进 `dev/stage-3`
- `pnpm typecheck` 6/6 ✅ / `pnpm --filter @arc/data-sources test` ≥ 130/130 ✅（加 ~10 个 CoinGecko unit tests）
- DEV 跑 `pnpm seed:crypto-only` → app 显示 CRYPTO 持仓 + 真实 USD 价 + 24h 变动
- 准备开 Block C handoff prompt（Opus 起 `cursor-stage-3-block-c-kickoff.md`）

## 当前已知 Active blockers

- 无（CoinGecko free tier 不需要任何 token / 账号注册 / 部署协作）

开始吧。先验证 working tree 干净（`git status`），再起 commit #1（client + error mapping）的实施计划让我（用户）拍板。
```

---

## 用户使用说明

1. **打开 Cursor**，新建 Composer / Chat 会话
2. **粘贴上面 ` ``` ` 框内的全部内容**
3. Cursor 第一步会输出 commit #1 实施计划 → 你拍板（"OK" 或纠正）→ 写代码
4. 6 commits 全部推完后切回 Claude Code（本会话）让 Opus 整体 review
5. Review 通过后 Opus 起 `cursor-stage-3-block-c-kickoff.md`（Block C 13 commits 主链）

## 三人分工速查（CoinGecko 阶段）

| 角色                      | 当前任务                                                                                                                                                        |
| :------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **你 (BoyangJiao)**       | (1) 并行跑 Block B UAT 4 sessions（已就绪）；(2) commit #2 之前手动跑 `pnpm tsx tools/refresh-coingecko-coins.ts` 拉一次 top200 JSON；(3) 每个 commit UAT smoke |
| **Cursor (Sonnet)**       | commit #1-6 顺序实施                                                                                                                                            |
| **Claude (Opus, 本会话)** | (1) CoinGecko 6 commits post-batch review；(2) 之后起 Block C handoff prompt                                                                                    |
