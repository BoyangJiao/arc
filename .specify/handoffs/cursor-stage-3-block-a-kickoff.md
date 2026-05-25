# Cursor 启动 prompt — Stage 3 Block A：Tushare CN + AKShare wrapper 实施

> 复制下方代码块到 Cursor Composer / Chat。该 prompt 不指定模型 —— Cursor auto 按 `CLAUDE.md §七 + §十二` 自评估路由（提示：commit #2-9 / #11-14 是「Adapter 集成 + Registry」= Sonnet 主场；commit #10 Vercel Python infra = 用户协作；若 commit #12 `withFallback` classifier 反复改不对 → 按 §十二 升 Opus）。
>
> **本 prompt reshape 2026-05-20**：Tushare 免费版实证仅覆盖 A 股 daily（HK 需单独审批；FUND 接口 ≥ 2000 积分），故 Block A 拆为 Phase 1A (Tushare CN) + Phase 2 (AKShare wrapper for HK/FUND)。原 spec 中 commit #3/#5/#6 全部 deferred。详见 ADR 011 §决策一 / §决策五（已 Accepted）。

---

```
接力 Arc Stage 3 Block A —— Tushare CN baseline + AKShare wrapper 实施 commit 链。

## 必读（按此顺序，不要跳）

1. `CLAUDE.md` — 项目铁律（§三 工程铁律 + §五 monorepo 结构 + §七 模型分工 + §十二 自我路由）
2. `.specify/constitution.md` — P0 约束（Decimal everywhere / Real-flow integrity / Adapter 抽象边界）
3. `.specify/session-state.md` — 当前 Stage 3 Block A 进度表 + Active blockers
4. `.specify/feature-specs/stage-3/tushare-adapter-stage-3.md` — **本任务的契约**（15 决策已锁，**reshape 2026-05-20**：Phase 1A + Phase 2 拆分；HK / FUND adapters Stage 3 走 AKShare 而非 Tushare）
5. `docs/adr/011-multi-source-fallback-and-akshare.md` — **多源 fallback ADR 已 Accepted**（决策一 fallback 表 + 决策三 classifier + 决策五 phasing；commit #10-14 实施 ADR 011 §决策五 Phase 2）

## 已就绪的工作 — commit #1 不需要再写

Opus 已 fold-in QuotaError 子类到 commit #1。当前 working tree 包含：
- `packages/data-sources/src/errors.ts` — 新增 `QuotaError extends AdapterError` 子类（与 RateLimitError 同辈）
- `packages/data-sources/src/adapters/tushare/client.ts` — `code 40002` 映射到 QuotaError；`code 40001` 仍 NetworkError
- `packages/data-sources/__tests__/tushare-client.spec.ts` — 14 个 test 全绿（82/82 在 `pnpm --filter @arc/data-sources test`）

**你的第一动作**：
1. `git status` 看变更
2. `pnpm --filter @arc/data-sources test` 确认 82/82 ✅
3. `git add -A && git commit` 用如下信息：

```

feat(data-sources): tushare client + error mapping + QuotaError fold-in

- POST JSON-RPC 单 endpoint client；列式响应解析；source 注入支持 3 个 market 工厂共享
- 错误映射：code 0 success / 40001 NetworkError (token invalid; bubble) / 40002 QuotaError
  (积分不足; withFallback try-secondary, ADR 011 §决策三) / 40203 RateLimitError(60s) / 其他非零 NetworkError
- HTTP 层错误镜像 Finnhub（429 / 401 / 5xx）
- assertTushareRowsNonEmpty 抽成 helper，给 per-market adapter 调（S3-AC-A1.7）
- errors.ts 新增 QuotaError extends AdapterError 直接（非 NetworkError）—— ADR 011 §决策三 classifier
  用 instanceof QuotaError 一行判定，不 sniff cause 字符串
- 14 unit tests, 82/82 ✅

Covers S3-AC-A1.5 / A1.6 (QuotaError 精化) / A1.7. Implements ADR 011 §决策一 + 决策三 + 决策五 Phase 1A.

```

## 模板（必读 + 必照搬接口形状）

- `packages/data-sources/src/adapters/finnhub.ts` — adapter 形状模板（`fetcher` 注入、错误抛 `AdapterError` 子类、`searchSymbols` optional）
- `packages/data-sources/__tests__/finnhub.spec.ts` — 单测密度参照（~15 个 case；mock `fetcher` 不打真网络）
- `packages/data-sources/src/adapters/tushare/client.ts` — 你刚 commit 的，Phase 1A 后续 adapter 共享它
- `packages/data-sources/src/registry.ts` — 多市场路由 + `createDefaultPriceAdapters` 当前形状
- `packages/data-sources/src/interfaces.ts` — `PriceAdapter` 契约（**不要改这个文件**）

## 关键差异（Tushare vs Finnhub）

| 维度          | Finnhub                              | Tushare Pro                                                          |
| :------------ | :----------------------------------- | :------------------------------------------------------------------- |
| 协议          | GET 多个 REST endpoint               | **POST 单一 endpoint** + body 区分 `api_name`                          |
| 响应 shape    | 行式 JSON                            | **列式** `{code, msg, data: {fields, items}}`                          |
| 错误模型      | HTTP 状态码 (429 / 401)              | **HTTP 200 + body `code`**（`40001` token / `40002` 积分 / `40203` 限流） |
| 时间戳        | Unix seconds                         | **YYYYMMDD `trade_date`** → 收盘时间 ISO                              |
| Stage 3 市场覆盖 | 1 市场 (US)                         | **CN only Stage 3**（HK/FUND 走 AKShare wrapper Phase 2）              |

## 任务 — Phase 1A 余下 commit + Phase 2 全部 commit

按顺序执行，**每个 commit 独立 PR-able**。每个 commit 末尾跑 `pnpm typecheck && pnpm lint && pnpm --filter @arc/data-sources test`。

### Phase 1A — Tushare CN baseline（commit #2, 4, 7-9）

**commit #2 — `feat(data-sources): tushare symbol resolver`**

- 新建 `packages/data-sources/src/adapters/tushare/symbol-resolver.ts`
  - `cnSymbolToTsCode(symbol)`：`60*` → `.SH` / `00*` `30*` → `.SZ` / `68*` → `.SH` / `8*` `4*` → `.BJ`，非法 throw ParseError
  - `hkSymbolToTsCode(symbol)`：strip leading zeros + `padStart(5, "0")` + `.HK`（Stage 3 不被业务调用但保留，Phase 2 后若启 Tushare HK 复用）
  - `fundSymbolToTsCode(symbol, hint?)`：同 spec §Architecture（保留供 Stage 3 末 / Stage 4 commit #6 解锁后用）
- 新建 `__tests__/tushare-symbol-resolver.spec.ts`，**表格驱动**覆盖 S3-AC-A1.8 全部 11 行（CN / HK / FUND 全保留）

**commit #4 — `feat(data-sources): tushare CN adapter`**

- 新建 `packages/data-sources/src/adapters/tushare/cn.ts`
  - `createTushareCnAdapter({ client })` → PriceAdapter
  - `fetchLatest(symbol)`：调 `daily` 取最新一行
  - `fetchHistorical(symbol, from, to)`：调 `daily` 用 YYYYMMDD `start_date` / `end_date`
  - `searchSymbols(query)`：抛 `NotImplementedError("tushare-cn", "searchSymbols")` —— Stage 3 dev 期由 AKShare 接管 search（spec §决策 1 + ADR 011 §决策一）；commit #3 (deferred) 解锁后改读 `static/stock.json`
  - 时区：`trade_date` (YYYYMMDD) → 07:00 UTC 同日（15:00 Asia/Shanghai）
- 新建 `__tests__/tushare-cn.spec.ts`，密度参考 `finnhub.spec.ts`
  - 覆盖 S3-AC-A1.1 / A1.10 / S3-AC-A1.7 (单 symbol NotFound) / `searchSymbols` 抛 NotImplementedError

**commit #7 — `feat(data-sources): registry CN-only Tushare wiring`**

- 修改 `packages/data-sources/src/registry.ts`：
  - `DefaultPriceAdaptersConfig` 增加 `tushareToken?: string`
  - `createDefaultPriceAdapters`: token 存在时挂 `CN: createTushareCnAdapter(...)`；**HK / FUND 不挂（Phase 2 才接 AKShare）**
- 修改 `__tests__/registry.spec.ts`：
  - token 缺失分支：`resolvePriceAdapter("CN")` 抛 `NotFoundError` (S3-AC-A1.11)
  - token 存在分支：`CN` resolve 成功；`HK` `FUND` 仍抛 `NotFoundError`（Phase 1A 期间预期；Phase 2 commit #13 后再扩展该测试）

**commit #8 — `feat(mobile): bootstrap reads EXPO_PUBLIC_TUSHARE_TOKEN`**

- 在 Stage 2 现有的数据源 bootstrap 文件（搜 `EXPO_PUBLIC_FINNHUB_API_KEY` 找到位置；通常是 `apps/mobile/src/lib/data-sources.ts`）透传 `process.env.EXPO_PUBLIC_TUSHARE_TOKEN` 进 `createDefaultPriceAdapters`
- `apps/mobile/.env.example` 加 `EXPO_PUBLIC_TUSHARE_TOKEN=`（占位）
- **不要泄露用户已贴过的 token**

**commit #9 — `feat(seed): CN-only fixture rows`**

- `supabase/functions/_shared/seed-core.ts` + `tools/seed-dev-data.ts` 增加 `default:cn-only` 场景（≥1 CN holding，如 `CN:600519` × 100 shares）
- 复用 ADR 007 SQL 注入路径，不短路真实 adapter
- DEV 面板二级菜单"功能 → 场景"挂载
- HK / FUND seed 推到 commit #14

**── Phase 1A DoD: 用户配置 token + 跑 `pnpm seed:cn-only` → 录 CN:600519 → 看到真实 CNY 价 ──**

### Phase 2 — AKShare wrapper（ADR 011 §决策五 Phase 2 必启；commit #10-14）

**commit #10 — `chore(services): akshare-wrapper Vercel Python serverless init`**

- 新建 `services/akshare-wrapper/`（monorepo 子目录，pnpm workspace 不纳入）
  - `vercel.json` Python runtime 配置
  - `requirements.txt`：`akshare`, `pandas`
  - `api/quote.py`：`GET /api/quote?market=CN|HK|FUND&symbol=...&token=...` 返回 Arc PriceQuote JSON 形态
  - `api/historical.py`：`GET /api/historical?market=...&symbol=...&from=...&to=...` 返回 PriceQuote[]
  - `api/_shared/akshare_client.py`：AKShare 库封装 + 错误归一化（限流 → 503 + `Retry-After`；积分耗尽 → 429 + JSON `{code: "quota"}`；symbol 不存在 → 404）
- 路由 token 鉴权（`X-Arc-Token` header；与 `AKSHARE_WRAPPER_TOKEN` Vercel env 对比）
- **用户协作**：用户在 Vercel 控制台开 project + 用 `vercel link` + `vercel env add` 设置 `AKSHARE_WRAPPER_TOKEN`；Cursor 起架构 + 写代码
- 部署后用户 ping 你 wrapper URL（`https://arc-akshare-wrapper.vercel.app`），写进 `.env.example`

**commit #11 — `feat(data-sources): akshare adapters (cn/hk/fund)`**

- 新建 `packages/data-sources/src/adapters/akshare/`
  - `client.ts`：`createAkshareClient({baseUrl, token, fetcher?})` → `AkshareClient` 接口（GET + token header）
  - `cn.ts` `hk.ts` `fund.ts`：三个 PriceAdapter 工厂，shape 对齐 Tushare CN adapter (commit #4)
  - `index.ts` barrel export
- 错误映射：wrapper service HTTP 429 + `{code: "quota"}` → `QuotaError`；503 + `Retry-After` → `RateLimitError`；404 → `NotFoundError`；其他 → `NetworkError`
- 新建 `__tests__/akshare-cn.spec.ts` `akshare-hk.spec.ts` `akshare-fund.spec.ts` + `akshare-client.spec.ts`，密度对齐 Tushare adapter

**commit #12 — `feat(data-sources): withFallback wrapper`**

- 新建 `packages/data-sources/src/adapters/with-fallback.ts`
  - `withFallback(primary: PriceAdapter, secondary: PriceAdapter, classifier?: (err) => "try-secondary" | "bubble"): PriceAdapter`
  - 默认 classifier：见 ADR 011 §决策三 默认 classifier 代码块（`instanceof QuotaError` / `RateLimitError` → try-secondary；`NetworkError` cause 含 `40001`/`HTTP 401`/`HTTP 403` → bubble，其他 → try-secondary；NotFound / ParseError → bubble）
  - 触发 fallback 时 `console.warn({primary: source, secondary: source, reason: err.name})`
- 新建 `__tests__/with-fallback.spec.ts`，**表格驱动**覆盖 ADR §决策三 全部 6 行错误分类
  - Primary success → 不调 secondary
  - Primary RateLimitError → try-secondary
  - Primary QuotaError → try-secondary
  - Primary NetworkError (40001 / 401) → bubble (secondary 不调)
  - Primary NetworkError (5xx) → try-secondary
  - Primary NotFoundError → bubble
  - Primary ParseError → bubble

**commit #13 — `feat(data-sources): registry wires AKShare for HK/FUND + CN withFallback`**

- 修改 `registry.ts`：
  - `DefaultPriceAdaptersConfig` 增加 `akshareWrapperUrl?: string` + `akshareWrapperToken?: string` + `enableAkshareCnFallback?: boolean`（默认 true）
  - 当 `akshareWrapperUrl` 存在时：
    - `HK: createAkshareHkAdapter({client})` primary（决策 14：HK=b 全程走 AKShare）
    - `FUND: createAkshareFundAdapter({client})` primary
    - `CN: withFallback(tushareCn, akshareCn)` 若 `enableAkshareCnFallback !== false`
- 修改 `registry.spec.ts`：
  - akshareWrapperUrl 缺失 → HK / FUND 抛 NotFoundError
  - akshareWrapperUrl 存在 + tushare token 存在 + enable=true → CN 走 withFallback，HK/FUND 走 AKShare
  - akshareWrapperUrl 存在 + tushare token 缺失 → CN 走 AKShare primary（withFallback fallback to AKShare 或直接 AKShare 取决于 secondary 缺失的处理）

**commit #14 — `feat(mobile+seed): AKShare env bootstrap + HK/FUND seed`**

- `apps/mobile/src/lib/data-sources.ts` 读 `EXPO_PUBLIC_AKSHARE_WRAPPER_URL` `EXPO_PUBLIC_AKSHARE_WRAPPER_TOKEN` `EXPO_PUBLIC_ENABLE_AKSHARE_CN_FALLBACK`
- `.env.example` 三个 var 加占位
- `seed-core.ts`：`default:hk-only` `default:fund-only` `default:cross-market`（含 CN + HK + FUND mix）
- DEV 面板挂载

**── Phase 2 DoD: 用户可以录 `HK:00700` / `FUND:000001` / `FUND:510300` + 看到真实价；模拟 Tushare CN limit 走 AKShare ──**

### commit #15 — `docs(spec+adr): mark Block A complete + bump session-state`

- spec Status 升级 + ADR 011 Phase 2 状态升级
- session-state Block A progress 全部 ✅；next = Block B `multi-portfolio-stage-3.md`（Opus 主场）

## 路线图边界（不要超出本 Block A 范围）

- **不要**改 `interfaces.ts`（spec §决策 4）
- **不要**碰 holdings table / asset detail / portfolio switcher / TWR — Block B/C/D
- **不要**为 Tushare endpoint 写专门 cache 层 — 现有 `PriceCache` (Stage 2) 已覆盖
- **不要**实施 commit #3 (`tools/refresh-tushare-basics.ts`) — 阻塞在用户升 ¥200/2000 积分；spec §决策 11 已 deferred
- **不要**实施 commit #5 (Tushare HK adapter) — 决策 14 锁定 Stage 3 不实施
- **不要**实施 commit #6 (Tushare FUND adapter) — 等用户升 2000 积分

## 路由自评估（每个 commit 边界做一次，按 §十二）

- commit #2 (symbol resolver) — Sonnet 套路 CRUD
- commit #4 (CN adapter `fetchLatest`/`fetchHistorical`) — Sonnet 但 timezone 边界（trade_date → ISO）容易错；若 test 反复改不对 → 升 Opus
- commit #10 (Vercel Python infra) — Sonnet + 用户协作；Python AKShare 库不熟可 / Vercel runtime 配置可问 Opus
- commit #12 (`withFallback` classifier) — Sonnet 起手；分类表 6 行有 1 行错就改不对 → 升 Opus 评估
- commit #13 (registry env-flag 多路径) — Sonnet 起手；condition matrix 反复错 → 升 Opus

## Hand-off 回 Opus 的触发点

- 每完成 1 个 commit 推到 `dev/stage-3` 后，**ping Opus review**（用户负责切回 Opus 会话）
- ADR 011 已 Accepted；不要碰 ADR 011 文件
- 如果遇到 spec 没写到的 edge case（e.g. AKShare wrapper service Python AKShare 调用怎么写、Vercel Python deploy 报 timeout 怎么调）→ 先抛在 Cursor chat 给用户 + Opus 决定，不要自己拍板

## DoD（本 Block A 结束 = 用户可以在 Arc 真实记 CN/HK/FUND 持仓 + 看到真实价）

- commit #1（已 fold-in QuotaError）+ #2 + #4 + #7-9 全部 merged → Phase 1A ✅
- commit #10-14 全部 merged → Phase 2 ✅
- 用户真实 Tushare + AKShare wrapper Live smoke：CN:600519 / HK:00700 / FUND:000001 / FUND:510300 ✅
- ADR 011 Phase 2 实施完成（spec §决策 14 + 15 + ADR §决策五）
- `session-state.md` Block A 表格全部 ✅
- 下一站 = Block B `multi-portfolio-stage-3.md` spec 起草（Opus 主导）

## 当前已知 Active blockers

- 用户 Tushare token 注册中（commit #8 真实拉价依赖）—— commit #1 已无 token 依赖（fold-in 完成）
- 用户 Vercel 账号 + AKShare wrapper 部署协作（commit #10 必需）
- `docs/legal-risk-map.md` L3/L6 复读（commit #10 前用户确认 AKShare 自用阶段合规边界）

开始吧。先验证 commit #1 已就绪（git status / 跑测试 / git commit），再起 commit #2 (symbol resolver) 的实施计划让我（用户）拍板。
```

---

## 用户使用说明

1. **打开 Cursor**，新建 Composer 或 Chat 会话
2. **粘贴上面 ` ``` ` 框内的全部内容**
3. Cursor 第一步会验证 commit #1（QuotaError fold-in 已由 Opus 完成）→ git commit → 起 commit #2 实施计划等你拍板
4. 每个 commit 推完，切回 Claude Code 让 Opus review
5. 你的 Tushare token 到位后，commit #8 真实拉价可跑通
6. 你的 Vercel 账号到位后，commit #10 协作部署 AKShare wrapper

## 三人分工速查（reshape 2026-05-20）

| 角色                      | 当前任务                                                                                                                                                                                     |
| :------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **你 (BoyangJiao)**       | (1) 注册 Tushare Pro（免费版即可起步，commit #1-7 不需要）；(2) 注册 Vercel 账号 + `vercel login`；(3) 复读 `docs/legal-risk-map.md` L3/L6/§六.6；(4) 决定是否在 Stage 3 末升 ¥200/2000 积分 |
| **Cursor (Sonnet)**       | commit #1 git commit → #2 #4 #7-9（Phase 1A）→ #10-14（Phase 2）→ #15 收尾                                                                                                                   |
| **Claude (Opus, 本会话)** | (1) commit #1 fold-in QuotaError ✅；(2) ADR 011 Accepted ✅；(3) Cursor 每个 commit review；(4) Block B `multi-portfolio-stage-3.md` 待 Phase 1A 收尾后起草                                 |
