# Feature: Holdings table + asset detail + multi-timeframe charts + cross-market tx entry (Stage 3 — Block C expanded)

- **Status**: Accepted — 13 resolved decisions (8 architecture + 5 UX-level locked 2026-05-20 BoyangJiao approved A/A/A/A/A)
- **Author**: Claude Opus 4.7 (draft) + BoyangJiao (review)
- **Created**: 2026-05-20
- **Implements**: `.specify/feature-specs/stage-3/stage-3-roadmap.md` §Block C；扩展原 Block C 范围（chart UI）加入跨市场 transaction entry + AKShare wrapper search 扩展
- **Conforms to**: `.specify/constitution.md` (Decimal everywhere, immutability of transactions, real-flow integrity), ADR 003 v3.1 (Business tokens), ADR 006 (`@arc/ui` layering), ADR 008 (accent discipline), ADR 011 (multi-source fallback)
- **Touches**: `packages/ui` (new `charts/` layer + finance components + market chip), `apps/mobile` (asset detail route + tx entry rewrite + symbol picker + hooks), `services/akshare-wrapper` (1 new endpoint `/api/search`), `packages/data-sources` (AKShare client add `searchSymbols`), seed (holdings + tx fixtures), i18n (~50 strings)
- **Does NOT touch**: `transactions` / `assets` / `portfolios` schema (Stage 2 已足够), Block A/B adapter contracts, business compute (rebalance / daily-snapshot 已自动按 portfolio 维度)
- **Depends on**:
  - Block B ✅ (active portfolio context + multi-portfolio CRUD)
  - `coingecko-adapter-stage-3.md`（并行 spec — CRYPTO market 必须先 registry-resolvable，否则 tx entry 录 CRYPTO 即断）

---

## Why this feature exists

Block A/B 已经把 5 个市场的 adapter 接好、多 portfolio 管理跑通、Insights 卡片仪表盘上线。**但是**：

1. **没有持仓表** — 用户进 Portfolio Tab 只看到总值数字 + Daily Snapshot card；不知道自己持有什么、各自占多少
2. **没有资产详情** — 想看 BTC 一周走势 → 没入口
3. **录入 UI 锁死美股** — `/portfolio/[id]/transactions/new.tsx` 现状只能输 US ticker（[transaction entry 现状]，未实测但 grep `market === "US"` 应可证）；其他 4 个市场的 adapter 拉得到价但**无法录交易**
4. **CN/HK/FUND symbol search 缺口** — Block A Tushare CN `searchSymbols` 抛 `NotImplementedError`（commit #3 阻塞在 2000 积分）；HK/FUND AKShare wrapper 还没暴露 search endpoint

Stage 3 DoD "所有真实持仓全录入 + 自用 ≥ 4 周" 在本 spec 完成之前**根本无法启动**。这是 Block C 真正的范围 —— 不是单纯的 chart UI，是**daily-use 完整闭环**。

Block D（算法 Opus 主场）也依赖本 spec：TWR / Performance Attribution 需要真实多市场持仓 + 真实历史价格作为 property test 输入，不然 fast-check 只能 mock 自己。

---

## User journey (J11-J14)

### J11 — 录入第一支 A 股

**Given** active portfolio = "A股账户"，目前空持仓
**When** Portfolio Tab → "+ 录入交易" → 弹 modal
**And** 顶部 market chip selector 默认高亮 "CN"（按 active portfolio 最近一次录入 market 推断）
**And** 搜索框输入 "茅台" → 下拉显示 "贵州茅台 (CN:600519)"
**When** tap 选中 → 自动跳到表单 step 2
**And** 表单字段：type (BUY/SELL/DIVIDEND/SPLIT) / shares / price_per_share / currency (默认 CNY 来自 asset) / fee / trade_date (默认今天) / notes
**When** 填 BUY × 100 shares × ¥1680 → 确认
**Then** `transactions` 表新增一行；Portfolio Tab 持仓表立刻出现 "贵州茅台 600519 × 100"
**And** 价格列双显："¥1820 / ¥1820"（原始 CNY + 报告 CNY 相同因为 portfolio reporting_currency = CNY）

### J12 — 切换 active 后录 BTC（跨市场场景）

**Given** 切到 "加密钱包" (reporting USD)
**When** "+ 录入交易" → market chip 默认 "CRYPTO"（"加密钱包" 上次录入是 CRYPTO）
**And** 搜索 "btc" → 下拉 "Bitcoin (CRYPTO:BTC)"
**When** 录 BUY × 0.5 × $67,000
**Then** 持仓表显示 "Bitcoin BTC × 0.5"
**And** 价格列："$67,234 / $67,234"（原始 USD = 报告 USD）

### J13 — Tap 持仓行进资产详情

**Given** Portfolio Tab 持仓表显示 "贵州茅台 × 100"
**When** tap 该行
**Then** 跳 `/asset/CN/600519`
**And** 详情页头部：name + ticker + 当前价 + 24h 变动 chip + 最近 update timestamp
**And** 时间段 segmented control：`1D | 1W | 1M | 3M | YTD | 1Y | ALL`，默认 `1M`
**And** 中间区域：HeroUI Pro line-chart 渲染历史价 + crosshair on tap
**And** 底部："我的持仓" 区域：份额 + 平均成本 + 未实现盈亏（双币种）

### J14 — Portfolio Tab 累计净值曲线

**Given** "A股账户" 已有 30 天交易 + daily snapshot 数据（migration 0003 表）
**When** 进 Portfolio Tab → 顶部 "累计净值" 卡片
**Then** HeroUI Pro area-chart 渲染近 30 天 portfolio_value_snapshots 数据（紫色渐变填充）
**And** 时间段 segmented control 1D / 1W / 1M / 3M / YTD / 1Y / ALL（与资产详情同选项）
**And** 顶部标注 peak / trough 数字（与 Delta 历史记录卡同模式）

---

## Resolved decisions

### 1. HeroUI Pro chart 走 `@arc/ui/charts/` 封装层（roadmap §决策 6 已锁）

业务侧：`import { LineChart, AreaChart } from '@arc/ui'`。`@arc/ui/charts/` 内部 subpath import `heroui-native-pro/line-chart` / `heroui-native-pro/area-chart` 等。Donut 保留 `react-native-svg` 自绘 `AllocationDonut`（Stage 2 J9 `DeviationDonut` 改名扩展）。

### 2. Time-range 选项 = `1D | 1W | 1M | 3M | YTD | 1Y | ALL`（去掉 1H）

Block A 全部 adapter 是 EOD daily 数据（Tushare / AKShare / Finnhub free / CoinGecko historical 都没 sub-daily 颗粒度），`1H` 选项给不出真数据 → 删。

### 3. Asset 详情 URL = `/asset/[market]/[symbol]`（两段）

不用 `/asset/[id]` + URL encode `CN:600519` → `CN%3A600519`。expo-router 拆 segment 更直观 + 浏览器 history readable + 复制 URL 友好。Composer `<asset_id>` 内部仍是 `market:symbol` 格式。

### 4. Holdings table 按 `asset.market` 分组

分组顺序：US → CN → HK → FUND → CRYPTO → CASH。同组内按"报告币种价值"降序。每组带 section header（"美股 · $12,300"），方便用户快速跳到自己想看的市场。

### 5. 价格列双显示（原始币种 + 报告币种）

每持仓行的 "价值" 列分 2 行：原始币种价值（如 CNY ¥168,000）+ 报告币种价值（如 USD $23,500）。如果两者币种相同（CN 持仓 + portfolio reporting=CNY）→ 只显示 1 行避免冗余。

### 6. Tx entry 跨市场 = 单一 form 路由 + 顶部 market chip + 内嵌 symbol picker

不开 5 个分立路由（避免 `/portfolio/[id]/transactions/new-us`, `-cn`, `-hk` 等冗余）。一个 `/portfolio/[id]/transactions/new.tsx` 内部 step-by-step：

1. Market chip selector（horizontal scroll：US / CN / HK / FUND / CRYPTO）
2. SymbolPicker（搜索 + 下拉，调对应 market 的 `searchSymbols`）
3. Form fields（type / shares / price / currency / fee / trade_date / notes）

### 7. AKShare wrapper 新增 `/api/search?market=CN|HK|FUND&q=...`

filled Block A `searchSymbols` for CN/HK/FUND。本 spec 同步描述 wrapper 端实现 + adapter `searchSymbols` 接入。详见 §Architecture。

### 8. Tx entry `trade_date` 字段 = 用户可改的日期选择器（默认今天）

Schema 现已支持 user-input `tradeDate`。Block C 表单 expose 日期 picker（HeroUI Pro `DatePicker`），允许 back-date（用户补录历史交易）。`createdAt` 自动 = `now()`，记录系统写入时间。两者**分离**用于 Block D TWR 计算（用 tradeDate 不用 createdAt）。

---

## Locked 2026-05-20 (BoyangJiao approved A/A/A/A/A)

### 决策 9 — AllocationDonut 按 asset 分组（A）

每持仓 = 一段（BTC / ETH / 茅台 / 腾讯 各占一片）。用户能看到"哪只单一资产权重最重"；与 Stage 2 J9 `DeviationDonut` 一致；持仓多时（>10）扇形碎在 Block F1 redesign 评估改进。

### 决策 10 — Time-range 默认值 = 1M（A）

资产详情页 + Portfolio Tab 累计净值 area-chart 共用默认 `1M`。月级是日常关注尺度（Delta / 雪球同款）。用户切换后**不持久化**该选择（每次进页面回到 1M；避免持久化复杂度）。

### 决策 11 — SymbolPicker 默认 market = per-portfolio 上次记忆（A）

AsyncStorage key `arc.lastUsedMarket.{portfolioId}`（与 Block B `arc.activePortfolioId` 同模式）。首次（无 key）默认 US。用户切到其他 market chip 后立即写入。

### 决策 12 — 持仓表 tap 行 = 进资产详情（A）

`/asset/[market]/[symbol]`。不做 inline expand。整行 PressableFeedback + accessibility role button。

### 决策 13 — Tx entry 录入完跳回 Portfolio Tab + "继续录入" 按钮（A + C 子选项）

默认成功后跳回 Portfolio Tab + toast 顶部小 banner "继续录入" 按钮。tap "继续录入" → 切到 C 模式：留在 tx entry 页 + 重置表单字段保留 market chip + portfolio context（适合批量补录历史）。两条 path 并存，用户自选。

---

## Data model

**零 schema 变更**。本 spec 全部基于 Stage 2 + Block A/B 已有表：

- `assets` (Stage 1) — Block A 已加 CN/HK/FUND seed (migration 0010)；Block C tx entry 录新 ticker 走 `ensureAsset` upsert
- `transactions` (Stage 1) — Block C tx entry 写入
- `price_snapshots` (Stage 2) — 历史价缓存；Block C `useHistoricalQuotes` 写入
- `portfolio_value_snapshots` (Stage 2 migration 0003) — 累计净值曲线数据源；Block C area-chart 读

### `ensureAsset` 在 tx entry 录新 ticker 时

```ts
// 用户搜索 + 选中 "腾讯控股 HK:00700" → tx submit 前：
await ensureAsset({
  id: "HK:00700",
  market: "HK",
  symbol: "00700",
  name: "腾讯控股",
  currency: "HKD",
});
// upsert with onConflict: "id", ignoreDuplicates: true (与 Block B transfer 同模式)
```

Block A migration 0010 RLS 已允许 authenticated INSERT for `market IN ('CN', 'HK', 'FUND')`；CRYPTO 需要在本 spec 加 migration 0013：

```sql
-- migration 0013_assets_authenticated_insert_crypto.sql
-- 编号 reshape 2026-05-21: 0012 已被 Block B UAT prep migration 占用
-- (portfolio_value_snapshots_user_insert_manual.sql)，本 spec 顺延到 0013。
CREATE POLICY "assets_authenticated_insert_crypto"
  ON "assets"
  FOR INSERT
  TO authenticated
  WITH CHECK (market = 'CRYPTO');
```

US 已在 migration 0001 允许。本次只补 CRYPTO 一个。

---

## Architecture

### File layout (new + modified)

```
packages/ui/src/
├── charts/                         ← NEW LAYER (ADR 006 §决策树 case 6)
│   ├── LineChart.tsx               ← wraps heroui-native-pro/line-chart
│   ├── AreaChart.tsx               ← wraps heroui-native-pro/area-chart
│   ├── ChartCrosshair.tsx          ← wraps heroui-native-pro/chart-crosshair
│   ├── TimeRangeSelector.tsx       ← segmented control 1D/1W/1M/3M/YTD/1Y/ALL
│   └── index.ts                    ← flat barrel
├── finance/
│   ├── HoldingsTable.tsx           ← NEW — multi-market grouped + dual currency
│   ├── HoldingRow.tsx              ← NEW — single row presenter
│   ├── MarketChip.tsx              ← NEW — US/CN/HK/FUND/CRYPTO/CASH chip
│   ├── AllocationDonut.tsx         ← extend J9 DeviationDonut（rename or extract）
│   └── PortfolioValueOverTimeCard.tsx  ← NEW — area-chart + time range
└── index.ts                        ← export 全部新组件

apps/mobile/
├── app/
│   ├── asset/
│   │   └── [market]/
│   │       └── [symbol].tsx        ← NEW — asset detail page
│   └── portfolio/[id]/transactions/
│       └── new.tsx                 ← REWRITE — cross-market step-flow
├── src/
│   ├── components/
│   │   ├── SymbolPicker.tsx        ← NEW — debounced search + dropdown
│   │   └── MarketSelector.tsx      ← NEW — top horizontal chip scroller
│   └── lib/
│       ├── queries/
│       │   ├── use-historical-quotes.ts  ← NEW — adapter.fetchHistorical wrapper
│       │   ├── use-asset-detail.ts       ← NEW — latest quote + metadata
│       │   ├── use-symbol-search-cross-market.ts  ← NEW — routes by market
│       │   └── use-portfolio-value-snapshots.ts   ← NEW — area-chart 数据源
│       └── store/
│           └── last-used-market.ts    ← NEW — per-portfolio AsyncStorage

packages/data-sources/src/adapters/
├── akshare/client.ts               ← extend with searchSymbols (per-market)
└── tushare/cn.ts                   ← searchSymbols 仍 NotImpl（fallback AKShare via Block B withFallback）

services/akshare-wrapper/
├── api/
│   └── search.py                   ← NEW — GET /api/search?market=...&q=...
└── lib/
    └── akshare_client.py           ← extend with search_cn / search_hk / search_fund
```

### AKShare wrapper `/api/search` 实现

```python
# api/search.py
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
import json
from lib.akshare_client import _require_token, fetch_search

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            _require_token(self.headers)
            qs = parse_qs(urlparse(self.path).query)
            market = (qs.get("market") or [""])[0]
            q = (qs.get("q") or [""])[0]
            if not market or not q:
                self.send_response(400); self.end_headers()
                self.wfile.write(json.dumps({"message": "market and q required"}).encode())
                return
            results = fetch_search(market, q)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(results).encode())
        except PermissionError: ...  # same shape as quote.py
        except LookupError: ...
        except (ConnectionError, TimeoutError, OSError): ...
        except Exception: ...
```

```python
# lib/akshare_client.py 加：
def fetch_search(market: str, q: str) -> list[dict[str, Any]]:
    m = market.upper()
    q_lower = q.lower()
    if m == "CN":
        # stock_zh_a_spot_em 提供 6 位代码 + 名称（无需 stock_basic 2000 积分）
        df = ak.stock_zh_a_spot_em()
        mask = (df["代码"].astype(str).str.contains(q_lower)) | \
               (df["名称"].astype(str).str.contains(q, case=False, na=False))
        rows = df[mask].head(8)
        return [{"assetId": f"CN:{r['代码']}", "symbol": r["代码"], "name": r["名称"], "market": "CN", "currency": "CNY"} for _, r in rows.iterrows()]
    if m == "HK":
        df = ak.stock_hk_spot_em()
        # 类似过滤 by 代码 / 名称
        ...
    if m == "FUND":
        df = ak.fund_name_em()  # 公募基金名称表
        ...
    raise ValueError(f"unsupported market: {market}")
```

**注意**：`stock_zh_a_spot_em` 拉全市场实时数据，~5000 行 ~5MB。冷启动一次后缓存到模块级 `_DF_CACHE = {}` dict，避免每次 search 重拉。`fund_name_em` 类似。可接受 5-10s 冷启动延迟（first user search after Vercel idle）。

### Adapter side: AKShare client `searchSymbols`

```ts
// adapters/akshare/client.ts 加：
async searchSymbols(market: "CN" | "HK" | "FUND", query: string): Promise<ReadonlyArray<SymbolSearchResult>> {
  const body = await request<SymbolSearchResult[]>("/api/search", { market, q: query });
  return Array.isArray(body) ? body.slice(0, 8) : [];
}

// adapters/akshare/cn.ts 加：
searchSymbols: (query) => client.searchSymbols("CN", query),
// hk.ts / fund.ts 同模式
```

CN adapter（Tushare）的 `searchSymbols` 继续抛 NotImpl；通过 `withFallback(tushareCn, akshareCn)` 时 fallback classifier 也要 try-secondary on `NotImplementedError`。

**ADR 011 §决策三 classifier 需要更新**：加一条 `NotImplementedError → try-secondary`。Block C commit 包含此小改 + with-fallback.spec.ts 加一条 case。

### Cross-market symbol search 路由

```ts
// use-symbol-search-cross-market.ts
export const useSymbolSearch = (market: Market, query: string) => {
  const debounced = useDebounce(query, 350);
  return useQuery({
    queryKey: ["symbol-search", market, debounced],
    enabled: debounced.length >= 2,
    queryFn: async () => {
      const adapter = registry.resolvePriceAdapter(market);
      if (!adapter.searchSymbols) return [];
      try {
        return await adapter.searchSymbols(debounced);
      } catch (err) {
        if (err instanceof RateLimitError || err instanceof QuotaError) {
          // 返回空 + UI inline 显示 "搜索暂不可用，请稍后再试"
          return [];
        }
        throw err;
      }
    },
  });
};
```

### `useHistoricalQuotes`

```ts
export const useHistoricalQuotes = (
  assetId: string,
  range: TimeRange // "1D" | "1W" | "1M" | "3M" | "YTD" | "1Y" | "ALL"
) => {
  const adapter = useMemo(() => registry.resolvePriceAdapterByAssetId(assetId), [assetId]);
  const { from, to } = rangeToWindow(range); // returns {from: Date, to: Date}
  return useQuery({
    queryKey: ["historical", assetId, from.toISOString(), to.toISOString()],
    enabled: !!adapter.fetchHistorical,
    queryFn: () => adapter.fetchHistorical!(parseAssetId(assetId).symbol, from, to),
    staleTime: 5 * 60 * 1000, // 5min cache（与现价 cache TTL 一致）
  });
};
```

`rangeToWindow`：

- 1D → today
- 1W → -7 days
- 1M → -30 days
- 3M → -90 days
- YTD → Jan 1 of current year
- 1Y → -365 days
- ALL → asset.created_at（或某 fixed earliest date）

---

## UI contract

### Portfolio Tab 持仓表

```
┌─────────────────────────────────────────────────┐
│  ▼ My Portfolio (CNY)                    ⚙  + │  ← PortfolioSwitcher + tx entry FAB
├─────────────────────────────────────────────────┤
│  累计净值 (PortfolioValueOverTimeCard)            │
│  ¥125,300 +1.2% 今日                            │
│  [area-chart 30 天]                              │
│  [ 1D | 1W | 1M | 3M | YTD | 1Y | ALL ]          │
├─────────────────────────────────────────────────┤
│  美股 · $12,300 (¥88,400)              [collapse]│
│   AAPL  Apple    100 × $189.50  +1.2%           │
│                  $18,950 / ¥136,440             │
│   NVDA  Nvidia    20 × $875.42  +3.2%           │
│                  $17,508 / ¥126,058             │
│                                                 │
│  A股 · ¥168,000                                 │
│   600519  贵州茅台  100 × ¥1,680  -0.3%         │
│                  ¥168,000                       │
│                                                 │
│  港股 · HK$50,000                               │
│   00700  腾讯控股  500 × HK$100  +2.1%           │
│                  HK$50,000 / ¥45,500            │
│                                                 │
│  CASH ¥5,000 + $1,000                           │
│   CNY                          ¥5,000           │
│   USD              $1,000 / ¥7,200              │
└─────────────────────────────────────────────────┘
```

- 每市场 section header 含小计；section 可折叠（state in component）
- 行尾不显示 "更多" icon —— tap 整行进 `/asset/[market]/[symbol]`
- 价格双列只在原始币种 ≠ 报告币种时显示 2 行（CN 持仓 + CNY portfolio → 1 行；US 持仓 + CNY portfolio → 2 行）

### Asset 详情页 `/asset/CN/600519`

```
┌─────────────────────────────────────────────────┐
│  ← 贵州茅台                                       │
│  CN:600519 · 上证                                │
│                                                 │
│  ¥1,820  +1.23% 今日                            │
│  最后更新 2026-05-20 15:00                       │
│                                                 │
│  [ 1D | 1W | 1M ▼ | 3M | YTD | 1Y | ALL ]        │
│                                                 │
│  ┌─────────────────────────────────────────────┐ │
│  │ [HeroUI Pro line-chart]                    │ │
│  │   crosshair + tooltip                       │ │
│  └─────────────────────────────────────────────┘ │
│                                                 │
│  ── 我的持仓 ──                                  │
│  持有       100 股                                │
│  平均成本   ¥1,680                               │
│  当前价值   ¥182,000                             │
│  未实现盈亏 +¥14,000 (+8.33%)                    │
│                                                 │
│  [ + 录入此资产交易 ]                             │
└─────────────────────────────────────────────────┘
```

### Cross-market tx entry `/portfolio/[id]/transactions/new`

```
┌─────────────────────────────────────────────────┐
│  ← 录入交易                                       │
│                                                 │
│  市场                                            │
│  [US] [CN] [HK] [FUND] [CRYPTO]                  │ ← MarketChip selector
│   ●                                             │ ← 选中 US（default）
│                                                 │
│  搜索资产                                         │
│  ┌─────────────────────────────────────────────┐ │
│  │ 🔍 输入名称或代码... AAPL                    │ │
│  └─────────────────────────────────────────────┘ │
│  Apple Inc.            US:AAPL              [+]│
│  AMD                   US:AMD               [+]│
│                                                 │
└─────────────────────────────────────────────────┘
```

Tap "Apple Inc." 后跳到 step 2 表单：

```
┌─────────────────────────────────────────────────┐
│  ← Apple US:AAPL (CASH currency USD)             │
│                                                 │
│  类型    [ BUY ▼ ]   ← BUY/SELL/DIVIDEND/SPLIT  │
│  份额    [ 100      ]                            │
│  单价    [ 189.50   ] USD                        │
│  手续费  [ 0        ] USD                        │
│  日期    [ 2026-05-20 ▼ ]  ← HeroUI Pro DatePicker│
│  备注    [                  ]                    │
│                                                 │
│  合计 -$18,950 (买入)                            │
│                                                 │
│  [ 确认录入 ]                                    │
└─────────────────────────────────────────────────┘
```

成功后 toast："已录入 Apple × 100" + 跳回 Portfolio Tab（默认）+ 顶部小 banner "继续录入" 按钮（决策 5 推荐）。

---

## Acceptance criteria (S3-AC-C.x)

### S3-AC-C.1 — 持仓表渲染 + market 分组 + 双币种

**Given** 录有 US/CN/HK/CRYPTO/CASH 各一持仓的 portfolio (reporting=CNY)
**When** 进 Portfolio Tab
**Then** 持仓表按 US → CN → HK → FUND → CRYPTO → CASH 顺序分组渲染
**And** 每 section header 显示原始币种小计
**And** US/HK/CRYPTO 行价值列双显（原始 + CNY 换算）；CN 行单显（已是 CNY）

### S3-AC-C.2 — Tap 持仓行进资产详情

**Given** 持仓行 "贵州茅台 CN:600519"
**When** tap
**Then** 跳 `/asset/CN/600519`，URL 含两段路径
**And** 详情页头部显示 name + ticker + 当前价 + 24h 变动 + asOf

### S3-AC-C.3 — 时间段切换重拉数据

**Given** 资产详情页默认 1M
**When** tap "1Y"
**Then** `adapter.fetchHistorical("600519", today-365d, today)` 调一次
**And** chart 重渲染；segmented control 高亮 1Y

### S3-AC-C.4 — Cross-market tx entry：录 CN 标的

**Given** active portfolio = "A股账户"
**When** "+ 录入交易" → 选 CN chip → 搜 "茅台" → 选中
**Then** AKShare wrapper `/api/search?market=CN&q=茅台` 调一次
**And** 下拉显示 "贵州茅台 CN:600519"（+ 可能其他茅台关键词）

### S3-AC-C.5 — Cross-market tx entry：录新 CRYPTO 触发 ensureAsset

**Given** 录 `CRYPTO:DOGE`，assets 表无此行
**When** tx submit
**Then** mutation 自动 `ensureAsset({id:"CRYPTO:DOGE", market:"CRYPTO", symbol:"DOGE", currency:"USD"})`
**And** assets 表新增 1 行（migration 0013 RLS 允许）
**And** transactions 表新增 1 行

### S3-AC-C.6 — Tx entry trade_date back-date

**Given** 录 BUY × 100 NVDA × $700 / trade_date = 2026-03-15
**When** submit
**Then** `transactions.trade_date = "2026-03-15T..."` (用户输入)
**And** `transactions.created_at = now()` (系统)
**And** 两者不相同

### S3-AC-C.7 — Symbol picker 默认 market 记忆

**Given** "加密钱包" portfolio 上次录入是 CRYPTO
**When** 再次进 tx entry
**Then** MarketSelector 默认高亮 CRYPTO chip
**Given** "A股账户" 上次录入是 CN
**When** 切到 A股账户 + tx entry
**Then** 默认高亮 CN

### S3-AC-C.8 — AllocationDonut by asset

**Given** "美股" portfolio 持仓 AAPL ($18950) + NVDA ($17508) + GOOG ($5000)
**When** 进 Insights Tab `PortfolioInsightCard` 看 donut
**Then** donut 分 3 段，按权重大小：AAPL ~46% / NVDA ~42% / GOOG ~12%
**And** 不按 market 分组（决策 1 = A）

### S3-AC-C.9 — Portfolio value-over-time area-chart

**Given** "A股账户" 已有 30 天 `portfolio_value_snapshots` 数据
**When** Portfolio Tab area-chart 渲染 1M
**Then** HeroUI Pro `area-chart` 显示连续 30 天数据点（紫色渐变填充）
**And** time range 切到 1Y → 重拉 365 天数据

### S3-AC-C.10 — Symbol search 限流降级

**Given** AKShare wrapper 返回 503 Retry-After (限流)
**When** 搜索 CN 标的
**Then** SymbolPicker 显示 "搜索暂不可用，请稍后再试"（inline，不清掉已有 results）
**And** 之前的搜索结果保留可见（与 J8 watchlist S2-AC-2.8 同模式）

### S3-AC-C.11 — Tushare CN searchSymbols → AKShare fallback

**Given** 主源 `withFallback(tushareCn, akshareCn)` 包装
**When** Tushare CN `searchSymbols` 抛 `NotImplementedError`
**Then** withFallback classifier 识别 NotImpl → try-secondary
**And** 自动调用 AKShare CN `searchSymbols` 返回结果

### S3-AC-C.12 — Asset detail "我的持仓" 区域

**Given** 持有 600519 × 100 share，avg cost = ¥1680
**When** 进 `/asset/CN/600519`
**Then** "我的持仓" 区显示 持有 100 / 平均成本 ¥1680 / 当前价值 ¥182000 / 未实现盈亏 +¥14000 (+8.33%)
**And** 未实现盈亏数字颜色 = 当前 finance color mode 的 gain 色

---

## Out of scope

- **Sub-daily (intraday) candle chart** — Block A 全部 EOD；Stage 4 评估付费源
- **Asset detail 图表上叠加交易标记**（buy/sell 点状标） — Stage 4 polish
- **Tx entry 多笔批量录入**（CSV import） — Block F1
- **Tx 列表 / 编辑 / 删除** — Stage 4（决策：transactions 不可变，编辑 = 新增 ADJUSTMENT；UI 推到 Stage 4）
- **Asset detail 新闻 / 公告 / 财报** — Stage 4 + 数据源评估
- **Watchlist tap row 进 asset detail** — 可顺手做，Block C 末小幅扩 J8（grep `apps/mobile/app/(tabs)/markets.tsx` 找到 tap handler 改路由）
- **多 portfolio 同时显示某资产汇总持仓** — Block F1 UX redesign
- **Currency picker 在 tx entry** — 默认从 asset.currency 取，用户不调（CN 持仓的 transaction currency = CNY 强制）
- **HeroUI Pro `bar-chart` / `chart-indicator`** — Block D（性能 bar chart）/ Stage 4

---

## Implementation plan

> Routing: Sonnet/Cursor —— Block C 大部分是 UI + hook。**3 个点 Opus 介入**：(a) `@arc/ui/charts/` wrapper 层 ADR（首次引入 HeroUI Pro chart）；(b) withFallback classifier 加 NotImpl → try-secondary（ADR 011 §决策三 改）；(c) Block C 收尾 spec review。
>
> Block C 估时 12-15h（roadmap 原估）+ 5-7h（cross-market tx entry + wrapper search）= **~17-22h** 总。

### Phase 1 — Foundation

1. **`feat(db): migration 0013 assets CRYPTO insert RLS`** — 1 line SQL；用户在 Supabase 跑
2. **`feat(ui): @arc/ui/charts/ wrapper layer (LineChart / AreaChart / ChartCrosshair / TimeRangeSelector)`** — 新建 `packages/ui/src/charts/` + subpath import HeroUI Pro + flat barrel export；**Opus review wrapper 层 ADR 必要性**
3. **`feat(ui): MarketChip + AllocationDonut extract from J9 DeviationDonut + HoldingsTable + HoldingRow`** — 复用 J9 donut 实现
4. **`feat(data-sources): with-fallback classifier add NotImplementedError → try-secondary`** — ADR 011 §决策三 同步改 + test 加一条 case；**Opus review**
5. **`feat(akshare-wrapper): /api/search endpoint + lib search_cn/hk/fund`** — Python；用户 redeploy Vercel

### Phase 2 — Cross-market read

6. **`feat(data-sources): akshare client searchSymbols + per-market adapter wires`** — CN/HK/FUND adapter `searchSymbols` 接 wrapper
7. **`feat(mobile): use-symbol-search-cross-market + use-historical-quotes + use-asset-detail + use-portfolio-value-snapshots`** — 4 个 query hooks
8. **`feat(mobile): last-used-market AsyncStorage store + per-portfolio key`** — `arc.lastUsedMarket.{portfolioId}` key

### Phase 3 — UI

9. **`feat(mobile): /asset/[market]/[symbol] detail page`** — header / chart / time-range / 我的持仓 区
10. **`feat(mobile): Portfolio Tab integrate HoldingsTable + PortfolioValueOverTimeCard`** — tap row → detail；area-chart 顶部 card
11. **`feat(mobile): SymbolPicker + MarketSelector + /portfolio/[id]/transactions/new rewrite`** — 跨市场 step flow + form
12. **`feat(seed): full-portfolio + multi-market scenarios`** — `portfolios:multi-market-full`(US + CN + HK + CRYPTO 各 2 持仓 + CASH) + `portfolios:30-days-history`(配 portfolio_value_snapshots 数据)

### Phase 4 — 收尾

13. **`docs(spec+adr+session-state)`** — spec Accepted + ADR 011 §决策三 update + session-state bump；next = Block D

13 commits。Phase 1-3 可分批 commit / 大 commit 由 Cursor 决定（Block B 我们接受 1 大 commit 模式）。

---

## Test plan

| AC                | Layer   | Artifact                                                         |
| :---------------- | :------ | :--------------------------------------------------------------- |
| C.1 / C.2         | L4      | `seed:portfolios:multi-market-full` → 进 Portfolio Tab + tap row |
| C.3 / C.9         | L4      | Asset detail / Portfolio Tab area-chart 时间段切 → 看图重渲染    |
| C.4 / C.10 / C.11 | L1 + L4 | mocked AKShare search 200/503；UAT CN 录入 + RateLimit 模拟      |
| C.5               | L1 + L4 | ensureAsset upsert test + UAT 录 CRYPTO:DOGE                     |
| C.6               | L1 + L4 | tx submit `trade_date` vs `created_at` SQL verify                |
| C.7               | L4      | 切 portfolio → 看 MarketSelector 默认                            |
| C.8               | L1 + L4 | computeAllocation property test (by asset)                       |
| C.12              | L4      | seed → 进 detail → 验证 4 个数字 + gain 色                       |

---

## Risks

| Risk                                                                        | Likelihood | Impact                | Mitigation                                                               |
| :-------------------------------------------------------------------------- | :--------- | :-------------------- | :----------------------------------------------------------------------- |
| HeroUI Pro chart subpath import 在 RN web Metro 解析失败                    | Med        | Block C 末两周白屏    | wrapper 层 + 早期 commit #2 隔离；遇坑当晚升 Opus debug                  |
| AKShare wrapper `stock_zh_a_spot_em` 冷启动 5-10s 单次                      | High       | 首次 CN search 等很久 | wrapper 端模块级 `_DF_CACHE` + 24h TTL；Stage 4 可加 Redis               |
| `stock_zh_a_spot_em` 数据量大（~5MB） + Vercel free 函数 256MB 限制         | Low        | 内存超                | 测试时验证；超就改 `fund_basic`-like 单独 endpoint 降数据量              |
| Asset detail 历史拉的是真数据 + Block A `historical` 端到端跑通失败         | Med        | 详情页空              | Block A P1-1 修复 prod 已部署；UAT spot check `historical?market=CN&...` |
| Tushare CN `searchSymbols` NotImpl 走 fallback → AKShare wrapper 当 primary | Low        | 多一跳延迟            | withFallback log 显示 "fallback to akshare-cn"；可观测                   |
| Tx entry 表单大 — 多 step UX 复杂                                           | Med-High   | 用户烦                | Phase 3 commit #11 完成后 demo 截图发我；F1 redesign sprint 重做         |

---

## Hand-off

- **Implementation owner**: Sonnet/Cursor（Block B 已证明 Composer 2.5 工程判断力够）
- **Review owner**: Opus
  - commit #2 `@arc/ui/charts/` wrapper 层架构 — 首次引入 HeroUI Pro chart，wrapper 层是否单 ADR
  - commit #4 with-fallback classifier 改（ADR 011 §决策三 同步）
  - commit #11 cross-market tx entry rewrite — 跨多文件 + symbol picker + market chip，post-batch review 重点
- **External dependency**:
  - 用户在 Supabase SQL Editor 跑 migration 0013
  - 用户 redeploy AKShare wrapper（commit #5 加 `/api/search` 之后）
  - 用户 spot check `coingecko-adapter-stage-3.md` 跑通后才能进 Phase 3 tx entry CRYPTO
- **Blocking dep**: `coingecko-adapter-stage-3.md` commit #4 (registry mounts CRYPTO) 必须先 merge，否则 Block C tx entry 录 CRYPTO 抛 NotFoundError

---

## Next after Block C

Block D `twr-stage-3.md` / `performance-attribution-stage-3.md` / `drawdown-stage-3.md` —— **Opus 主场**，property tests ≥ 20，依赖 Block C 真实多市场持仓 + 真实历史数据。

---

## Context bundle

```bash
pnpm ctx:feature holdings-and-transactions
```

Config: `.specify/feature-specs/stage-3/holdings-and-transactions.repomix.json`
