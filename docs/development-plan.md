全球资产配置追踪器 — 0→1 开发计划

> **文档定位**：作为 MVP 搭建的 high-level 指导方针。每个阶段标注推荐模型与 Skills，便于在不同模型间切换协作。
>
> **配套文档**：
> - `docs/project-background.md` — 项目背景与战略（Why）
> - `docs/preflight-checklist.md` — 启动前要准备的账号/资源清单
> - `docs/legal-risk-map.md` — 准律师初步法律风险地图

---

## 目录
1. [全局原则](#一全局原则)
2. [技术栈定稿](#二技术栈定稿)
3. [Monorepo 结构](#三monorepo-结构)
4. [UI 基建层（HeroUI 分层）](#四ui-基建层heroui-分层)
5. [数据模型设计](#五数据模型设计)
6. [数据源选型](#六数据源选型)
7. [阶段拆解](#七阶段拆解)
8. [模型分工指南](#八模型分工指南)
9. [Skill 应用时机](#九skill-应用时机)
10. [测试策略](#十测试策略)
11. [部署与发布](#十一部署与发布)
12. [节奏跟踪](#十二节奏跟踪)

---

## 一、全局原则

> 这些原则在任何阶段都不能违反。新功能、新决策都先检查与原则的相容性。

### 1.1 工程原则

1. **数据模型不变性原则** —— 资产 ID（market:symbol）、原始币种、交易时间戳一经写入永不修改；任何"修正"都通过新增「调整交易」实现，留下审计痕迹
2. **单一来源真相** —— 持仓 = Σ(交易) + Σ(快照修正)；不允许直接编辑持仓数字
3. **Adapter 层抽象数据源** —— 所有外部 API（行情、汇率、基金净值）必须先经过 `packages/data-sources/` 下的 adapter 接口，业务代码看不到任何具体厂商
4. **币种永不丢失** —— 资产录入时保留原始币种；显示时按用户报告货币换算；存储中绝不预先换算
5. **历史 != 当下** —— 历史净值用历史汇率/价格；当前净值用最新价。混用是 P0 bug

### 1.2 产品原则

1. **scratch your own itch** —— 自己每周用 ≥3 次的功能才进 MVP；自己用不上的功能延期
2. **手动优先 > 自动** —— MVP 全部手动录入 + CSV 导入，自动同步是 V1.5+ 议题
3. **数据可信优先 > 功能丰富** —— 宁愿少一个图表，也不展示一个可能错的数字
4. **文案铁律** —— 永不"建议买入/卖出"；用"达到/偏离目标配置"，不用"该/应该"
5. **隐私在产品名片上** —— 敏感数字一键脱敏、本地优先存储、最小化云端字段

### 1.3 协作原则

1. **决策写下来才算数** —— 关键架构选择存为 `docs/adr/NNN-标题.md`（Architecture Decision Record），方便切换模型时上下文延续
2. **每周一次 demo** —— 哪怕只跑通一个按钮，也要在周末有一个可演示状态
3. **能用就先用，再优化** —— MVP 阶段 hardcode 完全可接受，重构推到 MVP-2 再做

---

## 二、技术栈定稿

| 层 | 选型 | 理由 |
|:---|:---|:---|
| **跨端框架** | Expo SDK 53+ + Expo Router | 单代码库出 iOS/Android/Web，原生模块生态成熟 |
| **语言** | TypeScript（strict） | 金融领域类型安全是底线 |
| **样式** | NativeWind v4 + Tailwind | 与 HeroUI 同源，跨端一致 |
| **UI 组件** | HeroUI Pro（已购）+ 自建 finance/charts | 见 §四 |
| **状态管理** | Zustand + TanStack Query | 轻量；服务端状态走 TanStack Query 缓存 |
| **表单** | React Hook Form + Zod | 与数据模型 schema 统一 |
| **导航** | Expo Router（file-based） | 与 Next.js 心智一致 |
| **后端** | Supabase（PostgreSQL + Auth + Storage） | BaaS，免运维；Row Level Security 适合个人金融数据 |
| **ORM** | Drizzle ORM | Serverless 友好；schema 即 TS 类型 |
| **API 风格** | Supabase RPC + 必要时 Edge Functions | MVP 不上 tRPC（Expo 生态对 tRPC 兼容仍有摩擦），V1.0 可评估 |
| **图表** | Web: Recharts；RN: Victory Native（基于 Skia） | 一层 ChartProps 抽象统一 API |
| **i18n** | i18next + react-i18next | 双语 day1，文案分离 |
| **日期/时区** | date-fns + date-fns-tz | 多市场时区必需 |
| **金额计算** | decimal.js（或 dinero.js） | **绝不能用 number**；浮点误差在金融场景不可接受 |
| **本地存储** | MMKV（RN）/ IndexedDB（Web） | 离线优先 + 加密键值 |
| **错误监控** | Sentry（免费层） | RN + Web 通用 |
| **分析** | PostHog（免费层，self-hostable 备选） | 隐私友好，可自托管 |
| **CI** | GitHub Actions | 免费额度足够 MVP |
| **构建** | EAS Build（Mobile）+ Vercel（Web） | 零运维 |
| **AI**（V1.0+） | Claude API（直接）+ 简单 RAG | `claude-api` skill 加速接入 |

> ⚠️ **明确不选**：Next.js（Expo Web 已够）、tRPC（MVP 不引入）、Redux（过度工程）、styled-components（与 NativeWind 重复）。

---

## 三、Monorepo 结构

```
delta/
├── apps/
│   └── mobile/              ← Expo 应用（含 Web 输出）
│       ├── app/             ← Expo Router 文件路由
│       ├── components/      ← 业务组件（页面级）
│       └── ...
├── packages/
│   ├── ui/                  ← UI 基建层（见 §四）
│   │   ├── primitives/      ← re-export HeroUI
│   │   ├── blocks/          ← HeroUI Pro 源码 blocks
│   │   ├── finance/         ← 自建领域组件
│   │   ├── charts/          ← 图表组件
│   │   └── tokens/          ← 颜色/字号/间距
│   ├── core/                ← 领域逻辑（无 UI/IO 依赖）
│   │   ├── domain/          ← Account/Holding/Transaction 类型与计算
│   │   ├── returns/         ← TWR/MWR/累计收益率
│   │   ├── rebalance/       ← 再平衡引擎
│   │   └── fx/              ← 多币种换算
│   ├── data-sources/        ← 外部 API adapter
│   │   ├── adapters/        ← tushare / eastmoney / coingecko / alphavantage
│   │   ├── interfaces.ts    ← 统一接口
│   │   └── cache/           ← 行情缓存
│   ├── db/                  ← Drizzle schema + migrations
│   └── i18n/                ← 文案
├── docs/
│   ├── project-background.md
│   ├── development-plan.md  ← 本文件
│   ├── preflight-checklist.md
│   ├── legal-risk-map.md
│   └── adr/                 ← Architecture Decision Records
└── tools/                   ← 一次性脚本（CSV 模板生成等）
```

**包管理**：pnpm workspaces（比 npm/yarn 处理 monorepo 更稳）。
**任务编排**：Turborepo（缓存 + 并行）。

---

## 四、UI 基建层（HeroUI 分层）

### 4.1 分层架构

```
业务页面（apps/mobile/app/*）
   ↓ import @/ui
packages/ui/
   ├── primitives/   ← re-export HeroUI（薄封装）
   ├── blocks/       ← HeroUI Pro 源码 blocks（按需 copy）
   ├── finance/      ← 自建领域组件（不依赖 HeroUI）
   ├── charts/       ← 图表（Web/RN 双实现）
   └── tokens/       ← 设计 tokens（颜色/字号/间距/语义色）
        ↑
  HeroUI theme 与 NativeWind config 都从这里读
```

**铁律**：业务代码永远 `import { Button } from '@/ui'`，绝不直接 `import { Button } from '@heroui/react'`。

### 4.2 各层职责

| 层 | 内容举例 | 是否依赖 HeroUI |
|:---|:---|:---:|
| **primitives/** | Button, Input, Modal, Tabs, Select, Switch, Tooltip, Dropdown | ✅ 是（re-export） |
| **blocks/** | DashboardLayout, AuthForm, SettingsPanel | ✅ 是（基于 Pro 源码） |
| **finance/** | PriceCell, PnLBadge, AllocationDonut, MaskedNumber, AssetRow, GainLossArrow, CurrencyAmount | ❌ 否（纯自建） |
| **charts/** | LineChart, AreaChart, DonutChart, TreeMap, CandlestickChart | ❌ 否（Recharts/Victory Native 直接用） |
| **tokens/** | colors.ts, spacing.ts, typography.ts, semantic.ts（含红涨绿跌切换） | ❌ 否（纯常量） |

### 4.3 Token 系统设计

```ts
// packages/ui/tokens/semantic.ts
export const semanticTokens = {
  light: {
    gain: { red: '#E1372E', green: '#00A86B' },  // 红涨绿跌可切换
    loss: { red: '#00A86B', green: '#E1372E' },
    surface: '#FFFFFF',
    surfaceElevated: '#F7F7F8',
    // ...
  },
  dark: {
    gain: { red: '#FF3B30', green: '#00FF88' },
    loss: { red: '#00FF88', green: '#FF3B30' },
    surface: '#0B0B0E',
    surfaceElevated: '#16161A',
  },
};
```

用户偏好（红涨绿跌 vs 绿涨红跌）+ 主题（亮/暗）= 4 种组合，全部由 token 切换。

### 4.4 自建组件命名规约

- 领域组件用**领域语言**命名：`PriceCell`、`AllocationDonut`、`PnLBadge`
- 通用组件参考 HeroUI 命名风格：`MaskedNumber` 而非 `HiddenNumber`
- 不加 `My` / `App` / `Custom` 前缀（看路径就知道是不是自建）

### 4.5 切换 HeroUI 的退出成本

如果未来想换库（极小概率，但要预案）：
1. 保持 `primitives/` 接口不变
2. 重写 `primitives/Button.tsx` 内部实现指向新库
3. 业务代码零改动

> 实际操作中如果 HeroUI v3→v4 大改，也走同样流程吸收 breaking change。

---

| **finance/** | PriceCell, PnLBadge, AllocationDonut, MaskedNumber, AssetRow, GainLossArrow, CurrencyAmount | ❌ 否（纯自建） |
| **charts/** | LineChart, AreaChart, DonutChart, TreeMap, CandlestickChart | ❌ 否（Recharts/Victory Native 直接用） |
| **tokens/** | colors.ts, spacing.ts, typography.ts, semantic.ts（含红涨绿跌切换） | ❌ 否（纯常量） |

## 五、数据模型设计

> 这是整个项目最关键的部分，一旦上线就难改。建议在 MVP-0 阶段花一整周专门 review。

### 5.1 核心实体（PostgreSQL / Drizzle）

```
User                       账户
 └── Portfolio (1:N)       投资组合（一个用户可有多个）
      ├── TargetAllocation 目标配置（再平衡用）
      └── Holding (1:N)    持仓（资产 in 组合）
           └── Transaction 交易（持仓的来源真相）

Asset                      资产元数据（全局共享，不属于任何用户）
 └── PriceSnapshot         历史价格快照

FxRate                     汇率（按日存）

UserPreference             用户偏好（语言/报告货币/红绿色/主题）
```

### 5.2 关键字段（核心字段，非完整 schema）

```sql
-- assets：全局资产字典
asset (
  id            text PRIMARY KEY,    -- 'CN:600519' / 'HK:00700' / 'US:AAPL' / 'FUND:110022' / 'CRYPTO:BTC'
  market        text NOT NULL,       -- 'CN' | 'HK' | 'US' | 'FUND' | 'CRYPTO'
  symbol        text NOT NULL,
  name_zh       text,
  name_en       text,
  currency      text NOT NULL,       -- 资产计价币种 'CNY'|'HKD'|'USD'|...
  asset_class   text NOT NULL,       -- 'equity'|'etf'|'fund'|'crypto'
  is_qdii       boolean DEFAULT false,
  metadata      jsonb                -- 存特殊字段（基金类型/ISIN 等）
);

-- portfolios
portfolio (
  id            uuid PRIMARY KEY,
  user_id       uuid NOT NULL,
  name          text NOT NULL,
  reporting_currency text NOT NULL DEFAULT 'CNY',
  created_at    timestamptz,
  archived_at   timestamptz
);

-- target_allocation
target_allocation (
  portfolio_id  uuid,
  bucket        text,                -- 'CN_EQUITY'|'US_EQUITY'|'CRYPTO'|...
  target_pct    decimal(5,2),        -- 0.00 - 100.00
  PRIMARY KEY (portfolio_id, bucket)
);

-- holdings：聚合视图（可由 transactions 派生，但缓存以提速）
holding (
  id            uuid PRIMARY KEY,
  portfolio_id  uuid NOT NULL,
  asset_id      text NOT NULL,
  shares        decimal(28,8) NOT NULL,
  avg_cost      decimal(28,8) NOT NULL,    -- 原始币种成本均价
  cost_currency text NOT NULL,
  notes         text,
  UNIQUE (portfolio_id, asset_id)
);

-- transactions：来源真相
transaction (
  id            uuid PRIMARY KEY,
  portfolio_id  uuid NOT NULL,
  asset_id      text NOT NULL,
  type          text NOT NULL,       -- 'buy'|'sell'|'dividend'|'split'|'adjust'
  shares        decimal(28,8) NOT NULL,
  price         decimal(28,8) NOT NULL,    -- 原始币种
  currency      text NOT NULL,
  fee           decimal(28,8) DEFAULT 0,
  trade_date    date NOT NULL,
  trade_time    timestamptz,
  fx_rate_used  decimal(28,8),       -- 录入时记录的汇率（可空，表示用历史汇率服务）
  notes         text,
  source        text DEFAULT 'manual'-- 'manual'|'csv'|'api'
);

-- price_snapshots：历史价
price_snapshot (
  asset_id      text NOT NULL,
  date          date NOT NULL,
  close         decimal(28,8) NOT NULL,
  source        text NOT NULL,
  fetched_at    timestamptz NOT NULL,
  PRIMARY KEY (asset_id, date)
);

-- fx_rates：每日汇率（USD 为基准）
fx_rate (
  date          date NOT NULL,
  currency      text NOT NULL,       -- 'CNY'|'HKD'|'USD'|...
  rate_to_usd   decimal(20,10) NOT NULL,
  source        text NOT NULL,
  PRIMARY KEY (date, currency)
);
```

### 5.3 关键设计决策（写进 ADR）

1. **资产 ID 用 `market:symbol` 复合主键** —— 避免 A 股 600519 和某些海外 ticker 冲突
2. **shares 用 decimal(28,8)** —— A 股最小 1 股、基金小数点后 4 位、Crypto 8 位都覆盖
3. **金额永远存原始币种** —— `fx_rate_used` 字段允许「录入时锁定汇率」（适合一次性大额交易）
4. **transactions 是真相，holdings 是缓存** —— 提供一个 `recompute_holding(portfolio_id)` RPC
5. **price_snapshot 按日存** —— MVP 不需要分钟级；交易当日价从 transaction.price 取
6. **fx_rate 以 USD 为基准** —— 任意两币种换算都通过 USD 中转（精度损失可接受 ≤ 1bps）

### 5.4 计算口径（必须文档化）

- **市值（原始币种）** = shares × latest_price
- **市值（报告币种）** = shares × latest_price × fx(price_currency → reporting_currency, today)
- **成本（报告币种）** = Σ(transactions where buy/sell, 用每笔的 trade_date 汇率换算)
- **未实现盈亏** = 市值 - 成本
- **TWR** = ∏(1 + r_i) - 1，其中每个 r_i 是不含资金注入/取出的子区间收益率
- **目标偏离度** = current_pct - target_pct（绝对值越大越需要再平衡）

---

## 六、数据源选型

### 6.1 行情数据源对比

| 资产 | 推荐方案 | 价格 | 限额 | 合规性 | MVP 优先级 |
|:---|:---|:---|:---|:---|:---:|
| **A 股 / 港股** | Tushare Pro | ¥200-2000/年（按等级） | 接口分钟级限制 | ✅ 合规付费 | P0 |
| **A 股 / 港股**（备选） | 聚宽 JoinQuant 数据 | ¥几百/年 | 类似 | ✅ | 备选 |
| **公募基金净值** | 天天基金公开 JSON 端点 | 免费 | 自律 | ⚠️ 灰色（爬取，但被广泛使用） | P0 |
| **公募基金净值**（更稳） | Tushare Pro 基金接口 | 已含 | 同上 | ✅ | P1 升级 |
| **美股 / ETF** | Alpha Vantage（免费层 25 calls/day）→ Polygon.io（$29/月） | 免费起步 | 充足 MVP | ✅ | P0 |
| **加密货币** | CoinGecko 公共 API | 免费 | 30 calls/min | ✅ | P0 |
| **汇率** | exchangerate.host（免费）/ OpenExchangeRates（$12/月） | 免费起步 | 当日 + 历史 | ✅ | P0 |

### 6.2 Adapter 接口设计

```ts
// packages/data-sources/interfaces.ts
export interface PriceAdapter {
  readonly market: Market;
  fetchLatest(symbol: string): Promise<PriceQuote>;
  fetchHistorical(symbol: string, from: Date, to: Date): Promise<PriceSnapshot[]>;
}

export interface FundNavAdapter {
  fetchNav(fundCode: string, date?: Date): Promise<NavQuote>;
}

export interface FxAdapter {
  fetchRates(date: Date, base?: Currency): Promise<FxRateMap>;
}
```

每个具体厂商一个文件实现 adapter，业务代码通过 `getPriceAdapter(market)` 工厂获取。

### 6.3 缓存与限流策略

- 所有外部调用走 `packages/data-sources/cache/`
- 行情缓存：开盘中 60s、闭市后 24h
- 基金净值：当日缓存到次日 00:30
- 汇率：当日 1h，历史永久
- 限流用 `p-throttle`，避免被封禁
- 失败回退顺序：主源 → 备源 → DB 缓存 → 显示「数据不可用」徽章

### 6.4 成本预估（MVP 阶段）

| 项 | 月成本 | 备注 |
|:---|:---|:---|
| Tushare Pro 入门档 | ≈ ¥17/月（年付 ¥200） | A 股 + 港股 + 基金 |
| Alpha Vantage | $0 | 免费层 MVP 够用 |
| CoinGecko | $0 | 免费 |
| exchangerate.host | $0 | 免费 |
| Supabase | $0 | 免费层 |
| Vercel | $0 | 免费层 |
| EAS Build | $0 | 免费 30 builds/月 |
| Sentry / PostHog | $0 | 免费层 |
| **合计** | **< ¥30/月** | |

> Apple Developer ($99/年) 和域名 (¥80/年) 是一次性开销，记入 preflight checklist。

---

## 七、阶段拆解

### Stage 0：Pre-flight（1 周，6-12h）

**目标**：把所有「不写代码也能做」的事做完，让 Stage 1 真正只剩写代码。

**任务清单**：
- [ ] 完成 `docs/preflight-checklist.md` 所有 ☐ 项
- [ ] 注册并配置：GitHub、Apple Developer、Supabase、Vercel、Tushare、Sentry、PostHog
- [ ] 确定产品名（建议：3-5 候选 → 域名查询 → App Store 重名查询 → 国内商标初查）
- [ ] 设计 system 在 Figma 完成 4 张关键页：① 组合主页 ② 添加交易 ③ 资产详情 ④ 再平衡视图
- [ ] 设计 token 与 HeroUI theme 对应表填好
- [ ] 拉一个个人 OKR：MVP-1 上线日期、自用 ≥4 周这两个硬指标
- [ ] 阅读 `legal-risk-map.md`，把所有 UI 文案铁律记在 Figma comment 里

**Definition of Done**：所有账号可登、Figma 关键页完成、产品名定下来、preflight checklist 100% 勾完。

**推荐模型**：
- 决策类问题（产品名、设计取舍）→ **Opus**（深度推理）
- 调研工具与厂商 → **Sonnet**（快速 + 联网检索）

**推荐 Skills**：
- `init` —— 初始化 CLAUDE.md（标记产品边界文案铁律，让所有后续模型都遵守）
- `update-config` —— 配 hook、配权限白名单
- `fewer-permission-prompts` —— 减少日后的 permission 弹窗

---

### Stage 1：MVP-0 端到端骨架（3 周，15-25h）

**目标**：3 Tab 骨架 + 「创建组合 → 手动加一笔 AAPL → 看到 CNY 市值」端到端最小闭环。**Markets / Insights Tab 是空态**，把骨架立起来。

**任务清单**：
- [ ] Monorepo 初始化（已完成）+ HeroUI Pro / Native 集成（已完成）
- [ ] `packages/ui/src/tokens/` 落地：Foundation 扩展（info / skeleton / pressed）+ Semantic 12 + Business 5 + `useBusinessTokens` hook（见 ADR 003）
- [ ] Supabase 项目 + Drizzle schema 核心表（asset / portfolio / holding / transaction / fx_rate / price_snapshot / user_preferences）
- [ ] Auth：邮箱 + magic link
- [ ] 数据源 adapter：Alpha Vantage（美股）+ exchangerate.host（汇率）单条链路
- [ ] **3 Tab 骨架 + Me 全屏页**（IA v2.2 §四）：
  - [ ] `/sign-in`
  - [ ] `/(tabs)/index` Portfolio Tab + 默认组合卡片
  - [ ] `/(tabs)/markets` 空态（"Coming in Stage 2"）
  - [ ] `/(tabs)/insights` 空态（"Coming in Stage 2"）
  - [ ] `/portfolio/[id]` 组合详情（持仓表 + 总市值）
  - [ ] `/portfolio/[id]/transactions/new` 添加交易 Modal
  - [ ] `/me` 全屏页（渐变头像 + 邮箱 + 设置链接 + 注销，见 ADR 004）
  - [ ] `/me/settings`（报告货币 / 语言 / 红涨绿跌切换 / 深浅色）
- [ ] 计算：`computeHoldings(transactions)` + `computeMarketValue(holdings, prices, fx, reportingCurrency)`
- [ ] i18n 双语（中英），所有文案分离
- [ ] 部署：Vercel 上 web 版可访问；EAS preview build 可装

**Definition of Done**（对应 user-journeys J1-J5）：
- ✅ 用 Web 版录入一笔 AAPL → 看到 CNY 市值
- ✅ 切换报告货币 CNY ↔ USD → 数字精确
- ✅ 切换语言 zh ↔ en → 全 5 个页面 + 1 Modal 无残留
- ✅ 切换红涨绿跌偏好 → 涨跌色变化（前提：先有持仓）
- ✅ TestFlight build 在手机上能开

**推荐模型**：
- **Opus**：架构搭建（tokens、adapter 接口）— 一次定型
- **Sonnet**：页面、表单、组件实现 — 主力
- **Haiku**：补丁、文档 typo、依赖升级

**推荐 Skills**：`simplify`（第三周末清一次）、`session-start-hook`、`design-snapshot`（按需 opt-in）

**风险提示**：
- ⚠️ 不要把 i18n 推迟到后期
- ⚠️ 不要用 `number` 存金额
- ⚠️ Markets / Insights 空态文案要克制（不承诺 ETA），只说"coming soon"

---

### Stage 2：让 3 Tab 真正跑起来（3 周，15-25h）

**目标**：消除 Stage 1 的空态；首登有欢迎；用户每天有打开 app 的理由（Daily Snapshot）；再平衡跑通。

**任务清单**：
- [ ] **Daily Snapshot 卡片**（Portfolio Tab 顶部）：今日 ¥+352 / +1.2% + 涨跌前 3
  - [ ] 24h 前估值快照表（`portfolio_value_snapshot`）
  - [ ] 凌晨 cron 写快照（Supabase Edge Function）
- [ ] **CSV 导入**（FAB Sheet 第 2 项）：固定模板，预览 → 字段映射 → 确认
- [ ] **Markets Tab Watchlist**（轻量版）：
  - [ ] `/(tabs)/markets` 列表（自选 + 实时价 + 涨跌幅）
  - [ ] `/markets/search` 搜索 Modal（Alpha Vantage）
  - [ ] `watchlist_item` 表
- [ ] **Insights Tab Rebalance 基础版**：
  - [ ] `/insights/rebalance/setup` 首次目标配置（按资产）
  - [ ] `/insights/rebalance` 当前 vs 目标对比（双环 / 偏离度条）
  - [ ] `/insights/rebalance/actions` 行动单（"达到目标需要 ±X 股"）
  - [ ] `target_allocation` 表
  - [ ] `computeRebalance` 实现（含偏离度阈值、行动单生成）
- [ ] **首登欢迎屏** `/welcome`：1 屏（30 秒视觉介绍 + "添加第一笔资产"按钮），首次登录后展示一次

**Definition of Done**：
- ✅ Daily Snapshot 反映真实今日变动
- ✅ CSV 导入 100 行 < 10s
- ✅ 用 Watchlist 加 3 个自选 → 实时刷新涨跌
- ✅ Rebalance 设置 60% AAPL / 40% 现金 → 实测偏离 → 行动单数字正确
- ✅ 首登欢迎屏 30 秒内能完成 → 进入 Portfolio Tab

**推荐模型**：
- **Opus**：rebalance 引擎（偏离度算法 / 行动单生成）
- **Sonnet**：Daily Snapshot UI、CSV 解析、Watchlist 列表
- **Haiku**：文案打磨、空态升级、欢迎屏文案

**推荐 Skills**：`simplify`、`review`（rebalance 模块必跑）、`design-snapshot`（每个 Tab 完成后 opt-in 出一次稿）

---

### Stage 3：MVP-1 自用版（8-10 周，60-100h）

**目标**：你自己每天能用、能完整管理你的真实持仓。这是最关键的阶段。

**功能清单（按优先级）**：

**P0（必须有）**：
- [ ] A 股 / 港股数据源接入（Tushare Pro）
- [ ] 基金净值接入（天天基金 + Tushare 备份）
- [ ] CoinGecko 加密货币
- [ ] 多组合管理（创建、命名、归档）
- [ ] 资产配置环形图（Web + RN 双实现）
- [ ] 持仓表：原始币种 + 报告币种双列；点击进资产详情
- [ ] 资产详情页：历史持仓、交易记录、累计收益率、当前未实现盈亏
- [ ] 多时间段图表（1H/1D/1W/1M/YTD/1Y/ALL）
- [ ] 今日变动指标（持仓行级别）
- [ ] CSV 导出（备份；Me 入口）
- [ ] 顶栏右上 **AI 图标点亮**（占位 + 预设 Q&A，不接 LLM）
- [ ] **Me / Inbox 子页**（价格提醒触发记录，Revolut 范式）
- [ ] **订阅体系**（Free / Pro / Pro+ 三档）

**P1（强烈建议有）**：
- [ ] TWR 收益率计算 + 时间区间切换
- [ ] 价格异动提醒（推送 + 邮件）→ 落到 Inbox
- [ ] 数字脱敏开关（`<RedactedNumber>` 组件，见 ADR 003）
- [ ] Markets 行情分类浏览（Tab 内 segmented control）
- [ ] **Performance Attribution**（哪些资产贡献了今年收益）
- [ ] **Drawdown 分析**
- [ ] 离线本地存储（MMKV）+ 上线时同步

**P2（看时间）**：
- [ ] 多账户标签（券商/钱包标签，仅展示，不接 API）
- [ ] 历史净值导出 PDF
- [ ] 全局搜索 affordance（顶栏左头像旁）

**Definition of Done**：
- ✅ 你的所有真实持仓全录入，组合视图准确反映你的实际净资产
- ✅ 自用 ≥4 周，期间至少修复 3 个自己发现的 bug
- ✅ TWR 数字与雪球/同花顺误差 < 1%（抽 3 个标的验证）

**推荐模型**：
- **Opus**：TWR / Performance Attribution / Drawdown 算法
- **Sonnet**：页面、表单、CSV 解析、状态管理 — 主力（≈ 70% 时间）
- **Haiku**：文案微调、a11y 修复、依赖升级

**推荐 Skills**：
- `simplify` — 每完成一个大功能跑一次
- `security-review` — Stage 3 末期跑一次（金融数据敏感）
- `claude-api` — 如果提前接入 AI，用这个 skill 保证 prompt caching 默认启用
- `design-snapshot` — 多组合 + 资产详情 + 收益分析等大块完成后 opt-in 出稿

**节奏建议**：每周末 demo；每两周写 ADR；月底看 API / Vercel / Supabase 用量

---

### Stage 4：MVP-2 闭门测试（4-6 周，30-60h）

**目标**：5-15 个种子用户使用，收集反馈，修最严重 bug，验证「自己用得爽 ≠ 别人也觉得爽」。同时完成"连接 + 协作"扩展。

**任务清单**：
- [ ] 招募 5-15 个种子用户（朋友、即刻、小红书私信）
- [ ] 用户反馈渠道：飞书/Notion/简单 Typeform
- [ ] 用户引导：种子用户用 Stage 2 的欢迎屏即可，**完整 onboarding 推到 Stage 5**
- [ ] 错误监控：所有 Sentry 报错 < 24h 修复
- [ ] 性能：首屏 < 2s（Web）、冷启动 < 1.5s（Mobile）
- [ ] 数据准确性：每个用户至少一次「我的数字怎么不对」的对账
- [ ] 隐私协议 + 用户协议（generator 起初稿）

**功能扩展（与 Stage 3 P0 平行可以做的）**：
- [ ] 🎯 **AI 截图识别导入**（支付宝/同花顺/盈透截图）— Stage 4 P0 差异化亮点（IA v2.2 §六 Stage 4）
- [ ] 连接管理 UI（券商/交易所/钱包，只读，进 FAB Sheet）
- [ ] 家庭协作（共享组合 / 权限）
- [ ] 风险报告 Pro（夏普比率、最大回撤、相关性矩阵）
- [ ] **AI 接入 LLM**：流式回答 + 上下文注入；详情页 "Why is it moving?" 入口
- [ ] Good & Bad Decisions（Markets Tab 子模块）
- [ ] 数据隐私（本地 / 云同步）+ 推送通知配置（Me 子页）

**反馈分级**：
- P0 数据错误 → 24h 内修
- P1 严重体验问题 → 1 周内修
- P2 nice-to-have → 进 backlog
- P3 个别诉求 → 多数延期

**Definition of Done**：
- ✅ ≥10 个用户使用 ≥4 周
- ✅ 留存：≥5 用户每周打开 ≥2 次
- ✅ 净推荐意愿：明确 ≥3 用户说"会推荐给朋友"
- ✅ 0 个 P0 / P1 未修
- ✅ AI 截图识别导入对至少 3 种主流截图（支付宝 / 同花顺 / 盈透）准确率 ≥90%

**推荐模型**：
- **Sonnet**：bug 修复主力
- **Haiku**：小修小补（文案、UI 偏移、单测补充）
- **Opus**：判断题（"这个反馈是改架构还是改实现"）+ AI 截图识别 prompt 设计

**推荐 Skills**：
- `review` — 每个 PR 跑一次
- `security-review` — 进入 Stage 5 前再跑一次
- `claude-api` — AI 接入时强制使用，保证 prompt caching 默认启用
- `design-snapshot` — 大改后 opt-in 出稿

---

### Stage 5：V1.0 公开发布（4-8 周，30-60h）

**目标**：App Store + 国内安卓上架、订阅系统上线、官网。

**任务清单**：
- [ ] **合规**：
  - [ ] 注册公司主体（如确认推进）
  - [ ] ICP 备案（30-60 天）
  - [ ] 软件著作权（30 天）
  - [ ] 隐私政策 + 用户协议正式版（律师过目）
  - [ ] PIPL 个人信息处理清单
- [ ] **应用商店**：
  - [ ] App Store（中国区 + 海外）：截图、icon、描述、年龄分级
  - [ ] 国内安卓：华为、小米、OPPO、vivo、应用宝（每家审核策略不同）
  - [ ] **类目选「效率工具」或「记账」，绝不选「金融」**
- [ ] **订阅系统**：
  - [ ] StoreKit / Google Play Billing 集成（首选）
  - [ ] Free / Pro / Pro+ 三档实现
  - [ ] 国内：考虑独立支付（支付宝/微信）—— V1.5+
- [ ] **官网**：
  - [ ] 一页式 landing（用 Expo Web 复用组件）
  - [ ] 应用商店徽章 + 隐私政策 + 用户协议链接
- [ ] **AI 深度能力**（Stage 4 已接入 LLM；Stage 5 加深度）：
  - [ ] **AI 组合体检报告**（Insights，长文 + 图表生成）
  - [ ] AI 再平衡建议（超越规则引擎）
  - [ ] AI 决策复盘
  - [ ] AI 偏好学习（风险偏好 / 投资理念自动 profiling）
  - [ ] AI 抽屉支持多轮对话 + 历史会话 + 导出报告
  - [ ] 严格 prompt 控制不出现「建议买入/卖出」字样
- [ ] **完整 onboarding**（多步引导）：3-5 屏首次教学

**Definition of Done**：
- ✅ App Store 上架成功
- ✅ 至少 1 家国内安卓商店上架成功
- ✅ Pro 订阅完成首单（自己买也算）
- ✅ 官网可访问，SEO 基础元数据齐
- ✅ AI 组合体检报告稳定运行 ≥1 周

**推荐模型**：
- **Opus**：合规审查、AI prompt 设计、订阅状态机
- **Sonnet**：应用商店素材、订阅 UI、官网
- **Haiku**：备案材料整理、文案润色

**推荐 Skills**：
- `claude-api` —— 接入 AI 时强制使用，确保 caching 默认开
- `security-review` —— 上架前必跑
- `review` —— 任何接入支付/订阅的 PR 必跑

---

## 八、模型分工指南

> 本节的目的：你切到不同模型时知道该让哪个干什么。

### 8.1 横向能力速查表

| 任务类型 | 首选 | 备选 | 不推荐 |
|:---|:---|:---|:---|
| 架构决策 / ADR 起草 | **Opus** | Sonnet | Haiku |
| 数据模型设计 | **Opus** | Sonnet | Haiku |
| 算法实现（TWR / 再平衡 / FX 链） | **Opus** | Sonnet | — |
| React Native 页面实现 | **Sonnet** | Opus | Haiku |
| 表单 / 验证 / CRUD | **Sonnet** | Haiku | — |
| CSV 解析 / 数据迁移脚本 | **Sonnet** | Haiku | — |
| Bug 修复（已诊断） | **Sonnet** | Haiku | — |
| Bug 诊断（复杂） | **Opus** | Sonnet | Haiku |
| UI 微调 / 文案 / a11y | **Haiku** | Sonnet | — |
| 依赖升级 / typo / lint 修复 | **Haiku** | Sonnet | — |
| 文档编写 | Sonnet | Haiku | Opus（成本不值） |
| Prompt engineering（AI 模块） | **Opus** | Sonnet | Haiku |
| 合规 / 法律风险审查 | **Opus** | Sonnet | Haiku |
| 安全 review | **Opus** | Sonnet | Haiku |

### 8.2 切换模型的交接物（务必准备）

切到新模型时，让它读：
1. `CLAUDE.md`（项目根，由 `init` skill 维护）
2. `docs/project-background.md`
3. `docs/development-plan.md`（本文件）
4. 最近的 3 条 ADR（`docs/adr/`）
5. 当前你正在做的功能的 issue 描述

> 这 5 个物料 = 任意模型秒上手的最小集。

### 8.3 切换模型的判断信号

- **Sonnet 反复改不对一个 bug** → 升 Opus
- **Opus 在做无脑 CRUD** → 降 Sonnet
- **Sonnet 在改 typo / 升级版本** → 降 Haiku
- **Haiku 漏掉 edge case** → 升 Sonnet

---

## 九、Skill 应用时机

| Skill | 何时用 | 用在哪个 Stage |
|:---|:---|:---:|
| `init` | 项目初始化第一次 + 每次重大架构变更后更新 | Stage 0 / Stage 1 |
| `update-config` | 配置 hooks（如 SessionStart 自动 install）、permission 白名单 | Stage 0 |
| `fewer-permission-prompts` | Stage 1 末期跑一次，减少日常摩擦 | Stage 1 |
| `session-start-hook` | Web sessions 自动准备测试/lint 环境 | Stage 1 |
| `simplify` | 每完成一个大功能模块（再平衡引擎、CSV 导入...） | Stage 2 / Stage 3 / Stage 4 |
| `review` | 任何涉及金融计算或支付的代码 | Stage 2+ |
| `security-review` | Stage 3 末、Stage 5 上架前 | Stage 3 / Stage 5 |
| `claude-api` | 接入 LLM 的任意时刻；保证 prompt caching 默认开 | Stage 4 / Stage 5 |
| `loop` | 监控 CI、轮询 App Store 审核状态 | Stage 5 |
| `design-snapshot` | 完整 journey 闭环或较大布局调整后 opt-in 出稿 | 任意 Stage（用户主导触发）|
| `keybindings-help` | 个人偏好；想自定义 Claude Code 快捷键时 | 任何阶段 |

---
| UI 微调 / 文案 / a11y | **Haiku** | Sonnet | — |
| 依赖升级 / typo / lint 修复 | **Haiku** | Sonnet | — |
| 文档编写 | Sonnet | Haiku | Opus（成本不值） |
| Prompt engineering（AI 模块） | **Opus** | Sonnet | Haiku |
| 合规 / 法律风险审查 | **Opus** | Sonnet | Haiku |
| 安全 review | **Opus** | Sonnet | Haiku |


## 十、测试策略

> 金融场景对正确性要求高，但兼职开发不可能 100% 覆盖。下面是**性价比最高**的测试投入。

### 10.1 必测（property-based 优先）

| 模块 | 测试方式 | 工具 |
|:---|:---|:---|
| **金额计算（add/sub/mul/div）** | property-based：交换律、结合律、零元 | fast-check |
| **TWR / 累计收益率** | 黄金样例：手算 5 个场景 + 雪球对账 | vitest |
| **再平衡算法** | 边界：现金为 0、单一资产 100%、目标 = 当前 | vitest |
| **汇率链** | A→B→C 应等于 A→C；历史汇率不能用今天 | vitest |
| **CSV parser** | 各种异常格式的鲁棒性 | vitest |

### 10.2 该测但 MVP 可省

| 模块 | 推迟到 |
|:---|:---|
| 端到端 E2E（Detox/Playwright） | Stage 4 末 |
| 视觉回归 | Stage 5 |
| 性能基准 | Stage 5 |

### 10.3 不需要测

- 第三方 SDK（HeroUI、Supabase）的内部行为
- 单纯的展示组件（视觉测试更值）
- 配置文件

### 10.4 测试覆盖率目标

- `packages/core/`：≥ 80%（金融计算）
- `packages/data-sources/`：≥ 60%（adapter 接口）
- `apps/mobile/`：不强求覆盖率

---

## 十一、部署与发布

### 11.1 环境

| 环境 | 用途 | 数据 |
|:---|:---|:---|
| **dev** | 你本地 | 本地 Supabase / 测试数据 |
| **preview** | EAS preview + Vercel preview | 共享 staging Supabase 项目 |
| **prod** | TestFlight + 生产 Web | 生产 Supabase |

> ⚠️ MVP 阶段可以只有 dev + prod 两环境，省事；Stage 4 招种子用户时再拆 staging。

### 11.2 发布流程

```
git push → CI 跑测试 + lint
        ↓
   Vercel 自动部署 web
        ↓
   主分支合并 → EAS Build → TestFlight 内测
        ↓
   人工提审 App Store
```

### 11.3 数据库 migration

- Drizzle migrations 走 PR review
- **绝不在生产手改 schema**
- 任何破坏性变更（drop column / change type）先在 staging 跑 ≥1 周

### 11.4 Rollback

- Web：Vercel instant rollback
- Mobile：Expo OTA（JS-only 改动可热修复）
- 数据库：每天自动备份（Supabase 默认 7 天保留）

---

## 十二、节奏跟踪

### 12.1 周节奏

- **周一 30min**：看上周完成情况，定本周一个主目标
- **周三晚 1h**：写代码（短任务）
- **周末 4-6h**：写代码（长任务、设计、demo）
- **周日晚**：写一句话进度同步到 ADR 或 Notion

### 12.2 阶段门控

每个 Stage 完成时回答 3 个问题：
1. DoD 是否真的达到？
2. 上一阶段的 P0/P1 风险是否已闭环？
3. 下一阶段的前置依赖是否已就绪？

任意一个回答「否」→ 不进入下一阶段，先补齐。

### 12.3 进度可视化

- GitHub Projects 或 Notion 维护一个简易看板（Backlog / Doing / Done）
- ADR 目录下每个文件就是一个里程碑标记
- 每完成一个 Stage 在 README 加一个 ✅

---

## 附录 A：关键决策日历

| 时点 | 决策 |
|:---|:---|
| Stage 0 末 | 产品名敲定、设计 token 锁定 |
| Stage 1 末 | 数据模型定型（之后只增不改） |
| Stage 2 末 | 是否进入 Stage 3（核心 Tab 全部跑通 + 自用 ≥2 周） |
| Stage 3 中 | 是否提前引入 AI 模块（一般 Stage 4 才接，但可前置 prompt 设计） |
| Stage 3 末 | 是否进入 Stage 4（自评满意 + 自用 ≥4 周） |
| Stage 4 末 | 是否启动公司主体注册（看种子用户反馈） |
| Stage 5 中 | 是否需要专项律师 review（看是否含支付/AI） |

## 附录 B：紧急情况预案

- **数据源大面积不可用** → 显示「数据不可用」徽章，停止刷新；不要展示陈旧数据
- **Supabase 故障** → 本地 MMKV 缓存保证只读体验；写操作排队
- **App Store 审核拒绝** → 改类目而非删功能；保持工具属性纯粹
- **个人时间断档 ≥2 周** → 停在最近一个稳定 commit；写一段 RECOVERY.md 说明回归时第一件事
