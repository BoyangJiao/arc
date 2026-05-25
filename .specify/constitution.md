# Arc Constitution

> Single source of truth for any AI agent or human contributor.
> Every PR must satisfy these constraints.
>
> If a request conflicts with this document, **ask the user** before proceeding.

---

## Identity

- **Project**: Arc（中文：循迹）
- **Type**: 个人金融资产追踪 + 再平衡助手
- **Audience**: 在 A股 / 港股 / 美股 / 公募基金 / 加密货币 中持有 ≥3 类资产、跨 ≥2 个平台的中国投资者
- **Cadence**: Solo, part-time, 6-12h/week
- **Stack baseline**: see CLAUDE.md §四

---

## Core Principles

1. **数据准确性 > 功能丰富度** — 宁可少一个图表，也不展示一个可能错的数字
2. **手动优先 > 自动同步** — MVP 全部手动录入 + CSV 导入；自动同步 V1.5+
3. **类型严格 > 运行时灵活** — TypeScript strict + Decimal + readonly fields
4. **决策记录 > 隐式约定** — 关键架构选择必须立 ADR
5. **scratch your own itch** — 自己每周用 ≥3 次的功能才进 MVP
6. **隐私在产品名片上** — 敏感数字一键脱敏、本地优先、最小化云端字段

---

## Code Constraints (P0 — violation blocks merge)

### Money & precision

- **任何金额、份额、价格、汇率字段必须使用 `Decimal`（decimal.js）**
- **绝不使用 `number` 类型存储财务数值**
- `0.1 + 0.2 !== 0.3` 是 P0 bug，不是 edge case
- 比较金额用 `.eq()` / `.gt()` / `.lt()`，不用 `===` / `>` / `<`

### Immutability

- 资产 ID `market:symbol`（如 `CN:600519`）一经写入永不修改
- Transaction 一经创建不修改；如需"修正"，新增 ADJUSTMENT 交易抵消
- Holding 是派生数据：`computeHoldings(transactions)`，不允许直接编辑
- 详见 `data-model-invariants.md`

### Currency

- 资产录入保留原始币种；显示时按用户报告货币换算
- **存储中绝不预先换算**
- 历史净值用历史汇率/价格；当前净值用最新价
- 混用历史/当前价 = P0 bug

### Data sources

- 业务代码只能通过 `packages/data-sources/adapters/` 接口访问外部 API
- 禁止在 `apps/` 或 `packages/core/` 中直接 `fetch` 厂商 API
- 厂商替换时，业务代码必须**零改动**

### UI styling

- **任何颜色必须用 HeroUI Foundation token**（`bg-accent` / `text-success` 等）或 Arc Business token（`text-gain` / `bg-loss-soft` 等）
- **禁止硬编码 `#xxx` / `rgb()` / `oklch()` / Tailwind 内置色**（如 `bg-red-500`）
- **禁止业务代码直接消费 Primitive 色阶**（如 `bg-brand-300`）—— 这违反 ADR 003 v3.1 跳级规则
- 涨跌色必须经过 `useBusinessTokens()` hook，支持「红涨绿跌」切换

### Accessibility (a11y)

- 颜色 contrast 必须 ≥ WCAG AA（normal text 4.5:1，large text 3:1）
- 触控目标 ≥ 44×44 pt
- 所有交互元素必须有 `accessibilityLabel`（或等价的可见文本）
- `Button` / `Pressable` 必须有 `accessibilityRole`

### Accent discipline (ADR 008)

**实色 accent**（`text-accent` / `bg-accent` / `border-accent`，**不**含 `*-soft` 变体）**仅允许**用于：

1. `Button variant="primary"` 主行动按钮填充
2. Focus ring（即 `--focus` token）
3. Brand 标识（logo / splash / 品牌图形）

**禁止**用于：列表/设置项值文本、Header/nav icon、Tab bar active 指示器、Toast/Banner/Badge/Chip 背景、Gain/loss 数字徽章、DEV/debug 工具。改用 `*-soft` 软底或中性 token。详见 CLAUDE.md §六、ADR 008、[packages/ui/DESIGN-TOKENS.md](../packages/ui/DESIGN-TOKENS.md)。

### i18n

- **任何 UI 文案严禁硬编码在组件内**
- 必须使用 `@arc/i18n` 的 `useTranslation()` hook
- 中英双语 Day 1，新增文案必须同时在 `en.ts` 和 `zh.ts` 添加

### Components

- 业务代码永远 `import { Button } from '@arc/ui'`
- 绝不直接 `import` 自 `heroui-native` / `heroui-native-pro` / `react-native-safe-area-context` / `lucide-react-native` / `@gorhom/*` / `@dicebear/*`
- `@arc/ui` 是接口层，对外只暴露 flat namespace；内部分层（primitives / primitives-pro / wrappers / navigation / finance / charts / avatar / tokens）业务代码不感知
- 详见 ADR 006

### Real-flow integrity

- Dev / test / preview 提效手段允许**减少操作步骤**（自动填邮箱、加长 token 寿命、缓存 OTP autofill），但**严禁跳过任何业务链路环节**：
  - Auth（认证 / 会话 / RLS）
  - Hooks（React Query / Zustand 等真实数据获取层）
  - Adapter（外部 API 调用 / cache / rate limit）
  - Compute（领域计算 — TWR / 再平衡 / FX / valuation）
- 一旦出现 `if (DEV_*) return mock` 类短路代码视为违反铁律，必须改造为真实链路 + 真实数据（dev seed 走 SQL 注入）
- 唯一例外：单元测试 / property-based test 内部的 per-test mock，需保证测试隔离
- 详见 ADR 007

---

## Forbidden UX Phrases (P0 — violation blocks merge)

**绝不能出现的词**（任何 UI 文案、AI 输出、PR 描述都不许用）：

- ❌ 建议买入 / 建议卖出 / 推荐购买 / 应该买 / 应该卖
- ❌ 将获得 X% 收益 / 预期回报 / 保本 / 稳赚
- ❌ 专业建议 / 投资顾问 / 理财规划

**必须使用的替代表达**：

- ✅ 「达到目标配置需要的份额变化为 X」（不是"建议买入 X 股"）
- ✅ 「偏离目标配置 Y%」（不是"建议调整"）
- ✅ 「仅供参考，可能延迟」（任何价格/净值旁必须配此标识）
- ✅ 「本工具不构成投资建议」（免责声明，全局可见）

完整法律风险地图：`docs/legal-risk-map.md`

---

## Architectural Constraints (P1 — should be honored)

- ADR 002: UI 库为 HeroUI Native + Pro（branch A：Uniwind + Tailwind v4）
- ADR 003 v3.1: 3 层 token 架构（Primitive 色阶 → Foundation → Component/Business）
- ADR 004: 头像用 `@dicebear/collection` gradient
- ADR 005: Color scales 用 OKLCH，业务代码不接触色阶 utility
- ADR 006: `@arc/ui` 五层结构（primitives / primitives-pro / wrappers / navigation / finance / charts / avatar / tokens）+ 非 HeroUI 组件归位决策树
- ADR 007: Dev auth 持久化（不绕 auth，靠 AsyncStorage + 拉长 refresh token）+ 种子数据走 SQL 注入
- monorepo 结构: CLAUDE.md §五（apps/mobile + packages/{ui,core,db,i18n,data-sources}）
- 设计稿 / 截图归档默认 opt-in: CLAUDE.md §十一（design-snapshot skill 用户触发）

---

## Process Constraints (P1)

- **每周一次 demo**（哪怕一个按钮）— Stage 1+
- **每两周写一篇 ADR** 总结当周重大决策 — Stage 2+
- **每月看一次成本** — Stage 2+ 必做（API 调用、Vercel 流量、Supabase 用量）
- **每个非 trivial feature 写 spec**: `.specify/feature-specs/<stage-dir>/<name>.md`（索引见 `feature-specs/README.md`），**先写 spec 再写代码**

---

## When in doubt

1. Ask the user (using `AskUserQuestion` if in Claude Code)
2. Default to safer / more conservative interpretation
3. If proposing a deviation, document it in `docs/adr/`

---

## Maintenance

- This file changes rarely. Major edits require an ADR.
- If a constraint here becomes obsolete, mark with `~~strikethrough~~` and add deprecation note. Don't silently delete.
- AI agents should re-read this file at session start (handled by `.claude/hooks/SessionStart`).

---

## See also

- `data-model-invariants.md` — the 5 data laws
- `stage-acceptance-criteria.md` — per-Stage DoD in BDD format
- `CLAUDE.md` — project orientation + dev practices
- `docs/legal-risk-map.md` — full forbidden UX phrase index
- `docs/adr/` — all architectural decision records
