# ADR 011 — 多数据源 fallback 策略 + AKShare 候补集成方案

- **状态**: 已接受（BoyangJiao 一句话签收 2026-05-20 + 经 Tushare 文档实证后 reshape — Phase 2 AKShare 升级为 Stage 3 必启）
- **日期**: 2026-05-19 起草；2026-05-20 reshape（确认 Tushare 免费版仅覆盖 A 股 daily，HK 需单独审批，公募基金接口 2000 积分起）
- **作者**: Claude (Opus 4.7) + BoyangJiao (approved A/A/A/A/A + HK=b)
- **相关 ADR**: 001（技术栈 — 数据源约束），007（Dev Auth & 种子数据 — real-flow integrity），008/008a（fixture 已退役），009（Daily Snapshot 时点），010（Dev 缓存信任）
- **相关 spec**: `.specify/feature-specs/stage-3/tushare-adapter-stage-3.md`（单源 Tushare 契约已锁定 + 2026-05-20 reshape），`.specify/feature-specs/stage-3/stage-3-roadmap.md` §决策 8
- **触发**: `tushare-adapter-stage-3.md` §决策 12 把 Tushare `code 40203`（频率超限）/ `code 40002`（积分不足）的兜底显式留给本 ADR；用户 2026-05-20 注册 Tushare 时发现免费版（20 积分起）仅覆盖 A 股 daily —— **HK / FUND / `stock_basic` 全部不可访问**（实证：`fund_basic` `fund_nav` 需 2000 积分 / `fund_daily` 需 5000 积分 / `hk_daily` 单独审批）。这把 AKShare 从"可选候补"翻转为 Stage 3 Block A 主路径之一。

---

## 背景

Stage 2 收尾时数据源谱系是简单的：

| 市场   | 主源         | 副源                                        | 降级        |
| :----- | :----------- | :------------------------------------------ | :---------- |
| `US`   | Finnhub      | Alpha Vantage (legacy，registry 未默认装载) | stale cache |
| `CASH` | 常量 adapter | —                                           | —           |
| `FX`   | Frankfurter  | —                                           | stale cache |

Stage 3 Block A 把 `CN` / `HK` / `FUND` 加入 — Tushare Pro 是主源（spec 已锁），但 Tushare 免费版的两条已知约束让"只用 Tushare"不够稳：

1. **积分门槛** — `daily` / `hk_daily` 等核心日线接口 documented as 免费可访问，但部分细分接口（如 `fund_nav` 历史长窗口）实际触发 `code 40002`
2. **频率限制** — 每分钟 60-200 次（按 endpoint），HEY 一旦 watchlist + 组合估值 + 历史图表并发就容易 hit 限流

Stage 2 ADR 010 给 cache-first 模式打了一个补丁：seed-dev / fixture / 无 `changePercent` 的旧缓存被识别为 stale，触发真实拉取。但这条护栏依赖**主源可用**。如果 Tushare 也不可用，整条链路退化为「显示 stale + banner」——可接受，但 Stage 3 的"自用 ≥ 4 周"DoD 期间，每次 Tushare 抖动都让用户看 stale 数据，体感会破坏 scratch-your-own-itch 原则。

AKShare 是显而易见的候补：开源 Python 库，聚合东方财富 / 新浪 / 同花顺 等国内行情源，覆盖 CN / HK / FUND 全部市场。但它有两个 Arc-specific 难题：

1. **Python 库不能在 Expo/RN/TS 端直接调用** — 必须自建 HTTP wrapper service
2. **底层抓取的 TOS 因源而异** — Stage 3 自用阶段法务风险可控（参考 `legal-risk-map.md` L3「行情数据未经授权传播」），Stage 4 公开发布前必须复审

本 ADR 锁定方案，**不**强制在 Stage 3 完成 AKShare 实施 —— 把"准备到位"与"实际启用"分开，避免在 Tushare 免费版还没碰壁前先建一个 Python service。

---

## 决策

### 决策一：多源 fallback 优先级表（Stage 3 — 实证后 reshape）

**关键事实**（2026-05-20 抓 Tushare 文档实证）：

- Tushare 新用户注册赠送 **20 积分**（不是 100）
- `daily`（A 股日线）→ 120 积分免费可达 ✅
- `stock_basic` `fund_basic` `fund_nav` → **2000 积分**（≈ ¥200/年捐助，1 元 = 10 积分）
- `fund_daily`（ETF/LOF）→ **5000 积分**（≈ ¥500/年）
- `hk_daily` → **单独审批**，与积分无关

| Market   | Primary (Stage 3 dev)                                            | Secondary (Stage 3)                                                              | Degraded             | Stage 4 公开发布路径                                           |
| :------- | :--------------------------------------------------------------- | :------------------------------------------------------------------------------- | :------------------- | :------------------------------------------------------------- |
| `US`     | Finnhub                                                          | Alpha Vantage（registry opt-in）                                                 | stale cache + banner | 保留双源                                                       |
| `CN`     | Tushare Pro 免费（`daily` 够用）                                 | **AKShare wrapper**（限流时切；`stock_basic` 也走 AKShare 直到用户升 2000 积分） | stale cache + banner | 升 ¥200/2000 积分 → Tushare 主源；AKShare sunset               |
| `HK`     | **AKShare wrapper**（决定 b：Stage 3 不申请 Tushare `hk_daily`） | —（Stage 3 单源 AKShare；Tushare HK 不实施）                                     | stale cache + banner | 评估 Tushare 商业版申请 HK 权限；AKShare sunset                |
| `FUND`   | **AKShare wrapper**（Tushare 免费版不覆盖 fund\_\*）             | Tushare Pro 2000 积分（升级后开放 OF NAV 主源）                                  | stale cache + banner | 升 ¥200/2000 积分 OF + 评估 ¥500/5000 积分 ETF；AKShare sunset |
| `CRYPTO` | CoinGecko                                                        | —（Stage 3 单源）                                                                | stale cache + banner | 评估付费源（如 CoinMarketCap）                                 |
| `CASH`   | 常量 adapter                                                     | —                                                                                | —                    | —                                                              |
| `FX`     | Frankfurter                                                      | —（ECB 日终已足够稳定）                                                          | stale cache          | 评估实时商业级 FX                                              |

**与初稿（2026-05-19）的差异**：

1. AKShare 从 "Secondary 条件启用" 升级为 HK / FUND 的 **Primary (Stage 3 dev)**
2. CN 主源仍是 Tushare 免费版，但 `stock_basic`（搜索 / fund_basic 同理）阻塞在 2000 积分，Stage 3 dev 期 CN `searchSymbols` 也走 AKShare
3. HK 决定 b 已锁定：Stage 3 不申请 Tushare hk_daily 权限，全交 AKShare（Tushare HK adapter `commit #5` Stage 3 不实施）

**`EXPO_PUBLIC_ENABLE_AKSHARE_FALLBACK` 仍保留**作为 CN 的 fallback 开关（默认 true Stage 3，因 CN 限流时也走 AKShare）；HK / FUND 不走 fallback wrapper，直接 registry 主源就是 AKShare adapter。

### 决策二：AKShare 集成架构 — Vercel Python serverless wrapper

四个候选评估：

| 选项                            | 优点                                                           | 缺点                                           | 适配度         |
| :------------------------------ | :------------------------------------------------------------- | :--------------------------------------------- | :------------- |
| A. FastAPI on Fly.io / Render   | 长驻进程，无冷启动；可定制                                     | 月费 $5+，多一项要维护的 service               | 中             |
| **B. Vercel Python serverless** | **免费 hobby tier；与 Arc 未来 marketing 域同栈；冷启动 < 2s** | 免费版函数 10s 超时；冷启动期间延迟波动        | **高**（推荐） |
| C. Supabase Edge Function       | 与 Arc 后端同栈                                                | **Deno runtime 不支持 Python — 直接淘汰**      | 不可用         |
| D. Cloudflare Workers Python    | 全球边缘；Python 支持 beta                                     | 包大小限制 + AKShare 重依赖（pandas）—— 不适配 | 低             |

**选项 B** 落地形态：

```
arc-akshare-wrapper/                ← 新 repo 或 Arc monorepo 内 services/
├── api/
│   ├── quote.py                    ← GET /api/quote?market=CN&symbol=600519
│   ├── historical.py               ← GET /api/historical?market=CN&symbol=600519&from=...&to=...
│   └── _shared/
│       └── akshare_client.py       ← AKShare 包装 + 错误归一化
├── requirements.txt                 ← akshare, pandas (Vercel 自动安装)
└── vercel.json                      ← Python runtime config
```

返回 JSON 形态**对齐 Arc 内部 PriceQuote 结构**（不模仿 Tushare 列式），让 `adapters/akshare/client.ts` 解析逻辑最薄：

```json
{
  "assetId": "CN:600519",
  "price": "1820.50",
  "currency": "CNY",
  "asOf": "2026-05-16T07:00:00.000Z",
  "source": "akshare",
  "changePercent": "1.23"
}
```

`adapters/akshare/{cn,hk,fund}.ts` 与 Tushare 三个工厂同构 —— 共享 `createAkshareClient({baseUrl})` HTTP client，每个市场一个工厂。

### 决策三：`withFallback` wrapper 的错误分类（基于 `instanceof QuotaError`）

`withFallback(primary, secondary, classifier?)` 是 `PriceAdapter` 同 shape 的高阶包装。`classifier(error)` 决定是否切到 secondary。**用 `instanceof` 判定，不 sniff 字符串** —— 见 `packages/data-sources/src/errors.ts` `QuotaError` 子类（2026-05-20 commit #1 fold-in）：

| Primary 抛错                                                     | classifier 判定 | 行为                                     |
| :--------------------------------------------------------------- | :-------------- | :--------------------------------------- |
| `RateLimitError` (Tushare `code 40203` / HTTP 429)               | `try-secondary` | 立即调 secondary                         |
| **`QuotaError`** (Tushare `code 40002` / AKShare 配额耗尽)       | `try-secondary` | `instanceof QuotaError` 一行判定         |
| `NetworkError` HTTP 5xx                                          | `try-secondary` | 通过 `cause` 字符串 / 状态码字段二次判定 |
| `NetworkError` HTTP 401 / 403 (Tushare `code 40001` 同)          | `bubble`        | 配置 / token 错误，secondary 无意义      |
| **`NotImplementedError`** (e.g. Tushare CN `searchSymbols` stub) | `try-secondary` | 切 AKShare CN search 等候补实现          |
| **`NotFoundError`**                                              | `bubble`        | symbol 不存在，secondary 也找不到        |
| `ParseError`                                                     | `bubble`        | 数据形态变化，应该报警                   |

实施位置：`packages/data-sources/src/adapters/with-fallback.ts`。`searchSymbols` 不走 fallback（bundled JSON 永远命中 / AKShare adapter 自带 search）。`fetchHistorical` 走同一 classifier。

**默认 classifier**：

```ts
const defaultClassifier = (err: unknown): "try-secondary" | "bubble" => {
  if (err instanceof RateLimitError) return "try-secondary";
  if (err instanceof QuotaError) return "try-secondary";
  if (err instanceof NetworkError) {
    // 5xx 切下家；401/403 / Tushare 40001 通过 cause 字符串识别 → bubble
    const causeStr = String((err as NetworkError).cause ?? "");
    if (
      causeStr.includes("40001") ||
      causeStr.includes("HTTP 401") ||
      causeStr.includes("HTTP 403")
    ) {
      return "bubble";
    }
    return "try-secondary";
  }
  return "bubble";
};
```

**Observability**：每次 fallback 触发写一条 `console.warn({primary: "tushare-cn", secondary: "akshare-cn", reason: err.name})`；Stage 4 接 Sentry breadcrumb。

### 决策四：法务边界 — AKShare 仅 Stage 3 自用，Stage 4 公开前 sunset

`docs/legal-risk-map.md` L3「行情数据未经授权传播」是 🔴 高风险。AKShare 底层抓取来源（东方财富 / 新浪 / 同花顺等）TOS 因源而异，**未授权商用传播**会触发该风险。

- **Stage 3 自用**：AKShare wrapper 只服务 BoyangJiao 单用户、单设备，数据不"传播"到第三方 — 落在「研究 / 个人备份」灰色地带，法务风险 🟢 低（参考 `legal-risk-map.md` §六.6 — Tushare Pro 商用条款也是这一档审查时机）
- **Stage 4 公开发布**：AKShare wrapper 给陌生用户提供数据 = 实质上的"行情转售/分发" → 🔴 触发 L3 / L6（加密货币业务红线类似法理）。届时必须：
  1. **撤除 AKShare from production fallback chain**（保留代码，但 `EXPO_PUBLIC_ENABLE_AKSHARE_FALLBACK` 强制 false），或
  2. **取得 AKShare 底层源的商业授权**（实际不可行，源头分散），或
  3. **只使用 AKShare 中聚合自公开市场数据且无明确 TOS 限制的 endpoint**（律师认定 case-by-case）

**Stage 3 准入硬约束**：AKShare wrapper service 部署在 Vercel 期间，HTTP 必须带 Token 鉴权（仅 Arc app 已知的 secret），防止外部直接调用 → 缩小"传播"事实面。

### 决策五：实施 phasing — Tushare CN-only first，AKShare 必启 wrapper for HK/FUND

**与初稿（2026-05-19）的差异**：Phase 2 从「条件触发」**升级为 Stage 3 Block A 必启**。原因：Tushare 免费版根本不覆盖 HK / FUND，没有 AKShare 就跑不出 Block A 的 DoD。

```
Stage 3 Block A reshape (locked 2026-05-20):

[Phase 1A] Tushare CN baseline (免费 daily 够用)
  ✅ commit #1   tushare client + error mapping + QuotaError fold-in
     commit #2   symbol-resolver (CN rules only; HK/FUND 函数 stub)
     commit #4   tushare CN adapter (fetchLatest via daily; searchSymbols throws NotImplementedError until #3)
     commit #7   registry CN-only wiring
     commit #8   bootstrap reads EXPO_PUBLIC_TUSHARE_TOKEN
     commit #9   CN-only seed fixture
     ── DoD A1: record CN:600519 transaction + see real CNY price ──

[Phase 2] AKShare wrapper — Stage 3 Block A 必启（HK + FUND 无 Tushare 免费替代）
     commit #10  services/akshare-wrapper init + Vercel Python deploy
     commit #11  adapters/akshare/{client,cn,hk,fund} + tests
     commit #12  with-fallback wrapper + tests (覆盖决策三 classifier 表)
     commit #13  registry wire AKShare (HK + FUND primary; CN withFallback secondary)
     commit #14  HK + FUND seed fixture scenarios
     ── DoD A2: record HK:00700 / FUND:000001 / FUND:510300 + see real prices ──

[Deferred — Stage 3 末 / Stage 4]
     commit #3   refresh-tushare-basics — 阻塞在用户升 ¥200 / 2000 积分
     commit #5   tushare HK adapter — Stage 3 不实施（HK=b 决定锁定）
     commit #6   tushare FUND adapter — 升 2000 积分后再做（OF 切回 Tushare 主源）
     CN searchSymbols via static stock.json — 在 #3 之后

[Phase 3] Stage 4 公开发布前 sunset 评估（律师介入）
     评估 AKShare 是否撤除 / 替换 / 商业授权 — 见决策四
```

**Phase 2 升级理由（vs 初稿条件触发）**：

- Tushare 免费版（20 积分）不覆盖 `fund_basic` `fund_nav`（2000 积分） / `fund_daily`（5000 积分） / `hk_daily`（单独审批）→ HK / FUND 无 Tushare 路径
- 若选 "Tushare 免费 + 用户立即升 ¥200" 路径，仍只解锁 OF NAV，ETF（`fund_daily`）+ HK 仍需 ¥500/年 + HK 审批
- AKShare 即使在 Stage 3 末用户升级到 2000 积分后，对 HK / ETF 仍是默认主源 → "必启" 不是 over-engineering
- Stage 3 dev 单用户 + 不分发场景下，AKShare 的法务风险落在 🟢 低（决策四已 sunset 评估到位）

---

## 后果

### 正面

- **Stage 3 不被 Python 服务拖累** — Tushare 单源够用时，AKShare 是"图纸上的灭火器"，零运维成本
- **fallback 契约清晰** — `withFallback` wrapper 是 single point，未来加 secondary（Alpha Vantage US fallback、CoinMarketCap CRYPTO fallback）都套同一壳
- **错误分类显式** — `NotFoundError` / `ParseError` 不会被错误地降级到 secondary（避免"假数据掩盖真问题"）
- **法务边界先写明** — Stage 4 公开发布前不需要紧急法务复审；现在就知道哪些路径要 sunset
- **observability hook 预留** — Sentry breadcrumb 接入只需一行 `withFallback` 内部改 `console.warn` → `Sentry.addBreadcrumb`

### 负面

- **AKShare 实施推迟可能造成 Stage 3 后期返工** — 如果"表现受限"在 Block E 末才触发，realtime fallback 接入要插队 + Block D property tests 可能需要重跑（property test 不依赖 secondary，影响实际可控）
- **Vercel Python serverless 冷启动** — 首次 fallback 触发延迟 1-3s（vs Tushare ~200ms），用户体感"突然卡一下"。靠 cache 缓解（一次 fallback 后 5min 内同 symbol 直接读缓存）
- **`EXPO_PUBLIC_ENABLE_AKSHARE_FALLBACK` 又多一个 env 变量** — 测试矩阵 +1 维度。可接受（dev 用户单环境）

### 中性

- ADR 011 即使 Stage 3 不实施 AKShare，**也是 valuable** — 它锁定了"如果将来要做，路径是怎样" + "Stage 4 前必须 sunset 评估"，避免后续 session 又重复推导
- Tushare spec §决策 12 的"throw + 不 fallback"在本 ADR 下精确化为"throw → 由 `withFallback` 包装层决定 try-secondary 还是 bubble"。当 `withFallback` 未启用时（默认），行为与 Tushare spec 完全一致

---

## 实施清单（按 phasing — Phase 1 + Phase 2 均默认执行 Stage 3）

### Phase 1A — Stage 3 Block A Tushare CN baseline

- [x] 本 ADR 状态 草案 → 已接受（BoyangJiao 签收 2026-05-20）
- [x] `errors.ts` 新增 `QuotaError extends AdapterError` 子类（commit #1 fold-in）
- [x] `client.ts` `mapTushareCode` 把 `code 40002` 映射到 `QuotaError`（40001 仍 NetworkError）
- [x] `tushare-client.spec.ts` `code 40002 → QuotaError` + `code 40001 → NetworkError not QuotaError`（覆盖 ADR §决策三 seam）
- [ ] `tushare-adapter-stage-3.md` 同步 reshape（commit chain + 决策 + AC + Risks）
- [ ] `docs/legal-risk-map.md` 表 L3 行的 Mitigation 列追加 `+ AKShare 见 ADR 011 决策四`
- [ ] `session-state.md` Stage 3 Block A 表 reshape

### Phase 2 — AKShare wrapper（Stage 3 Block A 必启）

- [ ] `services/akshare-wrapper/` (monorepo 内子目录) Vercel Python serverless 部署
  - `/api/quote?market=CN|HK|FUND&symbol=...`
  - `/api/historical?market=...&symbol=...&from=...&to=...`
  - Token-protected (header `X-Arc-Token`)
- [ ] Vercel env: `AKSHARE_WRAPPER_TOKEN` + Arc app env: `EXPO_PUBLIC_AKSHARE_WRAPPER_URL` + `EXPO_PUBLIC_AKSHARE_WRAPPER_TOKEN`
- [ ] `packages/data-sources/src/adapters/akshare/{client,cn,hk,fund,index}.ts` + 同等密度 tests（mocked fetcher，对齐 Tushare adapter 测试密度）
- [ ] `packages/data-sources/src/adapters/with-fallback.ts` + `__tests__/with-fallback.spec.ts`（决策三表格驱动）
- [ ] `registry.ts` 接 AKShare：
  - `HK` `FUND` market primary = AKShare adapter
  - `CN` market primary = Tushare CN + `withFallback(tushareCn, akshareCn)` when `EXPO_PUBLIC_ENABLE_AKSHARE_FALLBACK=true`
- [ ] UAT: 真实跑通 `HK:00700` / `FUND:000001` / `FUND:510300` real-flow

### Phase 3 — Stage 4 公开发布前 sunset 评估（律师介入）

- [ ] 律师复审 AKShare 底层数据源 TOS（参考 `legal-risk-map.md` §六.6 律师筛选）
- [ ] 决议：撤除 / 替换 / 商业授权（三选一）
- [ ] 本 ADR 追加 Stage 4 sunset 决议或新立 ADR 标注 supersedes ADR 011

### Phase 3 — Stage 4 公开发布前 sunset 评估

- [ ] 律师复审 AKShare 底层数据源 TOS（参考 `legal-risk-map.md` §六.6 律师筛选）
- [ ] 决议：撤除 / 替换 / 商业授权（三选一）
- [ ] 本 ADR 追加 Stage 4 sunset 决议或新立 ADR 标注 supersedes ADR 011

---

## 后续

- 如果 CoinGecko 限流（30/min 免费）在 Block A 暴露问题，单开 ADR 012 同样套 `withFallback` 模板 — 本 ADR 的契约可直接复用
- 如果未来 Finnhub 主源切换，US fallback 表（Finnhub → Alpha Vantage）也走 `withFallback`，无需新 ADR
- AKShare wrapper service 如果 Phase 2 启用，独立 repo or `services/` 子目录的取舍单开小决策（不进本 ADR）
- 法务复审材料（Phase 3）的 prep work（数据源 TOS 摘录、AKShare 调用频次审计）可在 Stage 3 末 Block E polish 阶段提前 1-2 周整理
