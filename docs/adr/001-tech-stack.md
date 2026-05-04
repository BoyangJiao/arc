# ADR 001 — 技术栈选型

- **状态**: 已接受
- **日期**: 2026-05-04
- **作者**: BoyangJiao

---

## 背景

Arc 是一个面向中国全球资产配置者的投资追踪 App，需要同时覆盖 iOS / Android / Web 三端，并处理多币种、多市场的金融数据。作为兼职独立开发（6-12h/周），技术栈选型的核心约束是：

1. **单人可维护** — 不引入复杂的微服务或多语言后端
2. **金融数据安全** — 财务计算必须精确，浮点误差不可接受
3. **跨端一致** — 一套代码同时出 Native App + Web，减少维护负担
4. **BaaS 免运维** — MVP 阶段不自建服务器

---

## 决策

### 跨端框架：Expo SDK 54 + Expo Router

**选择**：Expo（单代码库出 iOS / Android / Web）

**放弃**：
- Next.js — Expo Web 已能覆盖 Web 需求；引入 Next.js 会分裂代码库
- React Native CLI — 失去 Expo 生态（OTA 热更新、EAS Build、托管工作流）

**关键约束**：导航使用 Expo Router（file-based），与 Next.js 心智模型一致，便于后期扩展。

---

### 金融计算：decimal.js（严禁 `number`）

**选择**：所有价格、份额、成本、汇率、净值字段必须使用 `Decimal` 类型

**理由**：`0.1 + 0.2 === 0.30000000000000004`。在金融场景，浮点误差会导致持仓计算错误、收益率失真，属于 P0 bug。

**执行**：ESLint 规则 + Code Review 双重保障；任何 `number` 类型的财务字段视为 bug。

---

### 后端：Supabase（PostgreSQL + Auth + RLS + Storage）

**选择**：Supabase 全托管 BaaS

**放弃**：
- 自建 PostgreSQL — 需要运维，超出 MVP 阶段能力范围
- Firebase — 文档型数据库不适合关系型金融数据（交易 / 持仓 / 汇率之间有大量 JOIN）
- PlanetScale — 无 Row Level Security，个人金融数据安全性不足

**关键点**：Row Level Security 是个人金融数据的安全底线，Supabase 原生支持。

---

### ORM：Drizzle ORM

**选择**：Drizzle ORM + drizzle-kit（schema 即 TypeScript 类型）

**放弃**：
- Prisma — Serverless / Edge 环境下冷启动慢；Prisma Client 体积大
- Kysely — 无 migration 工具，需自行管理 schema 变更

**优势**：schema 定义即类型，无需额外代码生成步骤；Serverless 友好。

---

### 样式：NativeWind v4 + Tailwind CSS + HeroUI Pro

**选择**：NativeWind 作为 React Native 的 Tailwind 实现；HeroUI Pro 作为组件库基础

**架构**：分层封装（见 CLAUDE.md §五）
- `packages/ui/primitives/` — re-export HeroUI（薄封装，业务代码只 import 这里）
- `packages/ui/tokens/` — 颜色/字号/间距/语义色（含红涨绿跌切换）
- `packages/ui/finance/` — 自建领域组件

**铁律**：业务代码永远 `import { Button } from '@arc/ui'`，不直接 import HeroUI。

---

### 数据源：Adapter 层抽象

**选择**：所有外部 API 通过 `packages/data-sources/adapters/` 访问，业务代码面向接口编程

```ts
interface PriceAdapter {
  readonly market: Market;
  fetchLatest(symbol: string): Promise<PriceQuote>;
  fetchHistorical(symbol: string, from: Date, to: Date): Promise<PriceSnapshot[]>;
}
```

**MVP 数据源**：
- A股/港股：Tushare Pro（付费，合规）
- 美股/ETF：Alpha Vantage（免费层 25 calls/day）
- 加密货币：CoinGecko（免费）
- 汇率：exchangerate.host（免费）
- 基金净值：天天基金公开 JSON 端点（灰色，广泛使用）

---

### i18n：i18next + react-i18next

**选择**：i18next 生态，双语 Day 1（中文默认，英文 fallback）

**执行**：所有文案禁止硬编码在组件内；通过 `useTranslation()` hook 获取。

---

### 明确不选

| 技术 | 原因 |
|:---|:---|
| tRPC | Expo 生态对 tRPC 兼容有摩擦；MVP 阶段 Supabase RPC 足够 |
| Redux | 过度工程；Zustand + TanStack Query 更轻量 |
| styled-components | 与 NativeWind 功能重叠 |
| Detox / Playwright E2E | Stage 3 末才引入 |
| 自动 API 同步 | 国内平台无开放 API；MVP 全手动 + CSV |

---

## 后果

- ✅ 单代码库覆盖三端，维护成本低
- ✅ decimal.js 强制精确计算，消除浮点风险
- ✅ Supabase RLS 保障个人金融数据安全隔离
- ✅ Adapter 层让数据源可随时替换（Tushare → 其他），业务代码零改动
- ⚠️ Expo 对部分原生模块有限制（如高频交易图表），需评估 Victory Native / Skia 性能
- ⚠️ Alpha Vantage 免费层 25 calls/day 在 Stage 2 需升级为 Polygon.io（$29/月）
