# CLAUDE.md — Arc 项目规范与指令

> **阅读顺序**：本文件是所有模型切换时的最小必读上下文。
>
> **🔴 P0 — 每次新会话必读（按此顺序）**：
>
> 1. **`.specify/session-state.md`** — 当前进度、待办、最近决策、活跃 blocker（live snapshot）
> 2. 本文件 — 项目铁律 + 工程约束
> 3. **`.specify/constitution.md`** — 项目宪法（P0 约束 + 禁忌文案）
>
> **按需阅读**：
>
> - `docs/project-background.md` — 产品定位、市场、风险登记册
> - `docs/development-plan.md` — 阶段拆解、模型分工、Skill 应用时机
> - `docs/preflight-checklist.md` — Stage 0 准备清单
> - `docs/legal-risk-map.md` — 法律风险与文案合规
> - `docs/adr/` — 关键架构决策记录
> - `.specify/feature-specs/<name>.md` — 当前 feature 的契约（如手头工作涉及）
>
> **会话结束 / 上下文将满时**：调用 `/checkpoint` skill 更新 `session-state.md`，下一会话才能无缝接续。

---

## 一、项目概览

- **名称**: Arc（中文副标题：循迹）
- **定位**: 全球资产配置追踪器 & 再平衡助手
- **目标用户**: 在 A股 / 港股 / 美股 / 公募基金 / 加密货币 中持有 ≥3 类资产、跨 ≥2 个平台的中国投资者
- **当前阶段**: Stage 0 → Stage 1（Pre-flight → MVP-0 骨架）
- **开发节奏**: 兼职，6-12h/周；详细里程碑见 `docs/development-plan.md §七`

---

## 二、文案铁律（任何 UI 文案必须遵守）

### 永不出现的词（立即触发整改）

- 建议买入 / 建议卖出 / 推荐购买 / 应该买 / 应该卖
- 将获得 X% 收益 / 预期回报 / 保本
- 专业建议 / 投资顾问 / 理财规划

### 必须使用的替代表达

- ✅ 「达到目标配置需要的份额变化为 X」（不是「你应该买 X 股」）
- ✅ 「偏离目标配置 Y%」（不是「建议调整」）
- ✅ 「仅供参考，可能延迟」（任何价格/净值旁边必须配此标识）
- ✅ 「本工具不构成投资建议」（免责声明，全局可见）

---

## 三、工程铁律

### 3.1 金融计算

- **严禁使用 `number` 处理任何财务数值**（价格、份额、成本、汇率、净值）
- 必须使用 `decimal.js`（`Decimal` 类型）
- `0.1 + 0.2 !== 0.3` 是 P0 bug，不是 edge case

### 3.2 数据模型不变性（5 条核心原则）

1. **资产 ID 不变** — `market:symbol`（如 `CN:600519`）一经写入永不修改；修正走新增「调整交易」
2. **单一来源真相** — 持仓 = Σ(交易) + Σ(快照修正)；不允许直接编辑持仓数字
3. **Adapter 层抽象** — 所有外部 API（行情/汇率/基金净值）必须经 `packages/data-sources/` adapter；业务代码看不到任何具体厂商
4. **币种永不丢失** — 资产录入保留原始币种；显示时按报告货币换算；存储中绝不预先换算
5. **历史 ≠ 当下** — 历史净值用历史汇率/价格；当前净值用最新价；混用是 P0 bug

### 3.3 i18n

- **所有 UI 文案严禁硬编码在组件内**
- 使用 `@arc/i18n` 包，通过 `useTranslation()` hook 获取文案
- 中英双语 Day 1，新增文案必须同时在 `en.ts` 和 `zh.ts` 添加

### 3.4 数据源

- 业务代码只能通过 `packages/data-sources/` 的 adapter 接口访问外部 API
- 不准在 `apps/` 或 `packages/core/` 中直接 `fetch` 厂商 API

### 3.5 真实链路不可绕过（ADR 007）

- Dev / test / preview 期间允许**减少操作步骤**（autofill、缓存、缩短确认），但**禁止跳过**任何业务链路环节：Auth / Hooks / Adapter / Compute
- 禁止 `if (DEV_*) return mock` 类短路。dev 种子数据走 `tools/seed-dev-data.ts` SQL 注入到真实 Supabase dev project
- 单元测试 / property-based test 内的 per-test mock 是允许的例外

---

## 四、技术栈

| 层        | 选型                                                          |
| :-------- | :------------------------------------------------------------ |
| 跨端框架  | Expo SDK 54 + Expo Router（file-based）                       |
| 语言      | TypeScript strict                                             |
| 样式      | Uniwind + Tailwind CSS v4                                     |
| UI 组件   | HeroUI Native (OSS) + HeroUI Native Pro + 自建 finance/charts |
| 状态管理  | Zustand + TanStack Query                                      |
| 表单      | React Hook Form + Zod                                         |
| 后端      | Supabase（PostgreSQL + Auth + RLS + Storage）                 |
| ORM       | Drizzle ORM                                                   |
| 图表      | Web: Recharts；RN: Victory Native                             |
| i18n      | i18next + react-i18next                                       |
| 日期/时区 | date-fns + date-fns-tz                                        |
| 金额计算  | **decimal.js（绝不用 number）**                               |
| 本地存储  | MMKV (RN) / IndexedDB (Web)                                   |
| 错误监控  | Sentry                                                        |
| 分析      | PostHog                                                       |

---

## 五、Monorepo 结构

```
arc/
├── apps/
│   └── mobile/              ← Expo 应用（含 Web 输出）
│       ├── app/             ← Expo Router 文件路由（页面）
│       └── src/             ← 业务侧 lib / 页面级组件（不可复用到其他 app）
├── packages/
│   ├── ui/                  ← UI 基建层（接口层，对外 flat namespace；ADR 006）
│   │   ├── tokens/          ← 设计 tokens（自有 — 颜色/字号/间距/语义色，含红涨绿跌切换）
│   │   ├── primitives/      ← T0  — HeroUI Native OSS 归位（薄 re-export → 未来按需 copy-in）
│   │   ├── primitives-pro/  ← T0p — HeroUI Native Pro 归位（独立目录便于法务隔离）
│   │   ├── wrappers/        ← T1  — 第三方包薄封装（safe-area / lucide / gorhom-sheet / dicebear）
│   │   ├── navigation/      ← T2  — 自建导航容器（FloatingTabBar / CustomStackHeader）
│   │   ├── finance/         ← T2  — 自建金融领域组件（PriceCell / PnLBadge / AllocationDonut / MaskedNumber）
│   │   ├── charts/          ← T2  — 图表（Web/RN 双实现）
│   │   └── avatar/          ← T2  — 渐变头像（ADR 004 落地）
│   ├── core/                ← 领域逻辑（无 UI/IO 依赖）
│   │   ├── domain/          ← 类型定义（Asset / Holding / Transaction / Portfolio）
│   │   ├── returns/         ← TWR / MWR / 累计收益率
│   │   ├── rebalance/       ← 再平衡引擎
│   │   └── fx/              ← 多币种换算
│   ├── data-sources/        ← 外部 API adapter 层
│   │   ├── adapters/        ← alphavantage / tushare / coingecko / exchangeratehost
│   │   ├── interfaces.ts    ← 统一接口（PriceAdapter / FxAdapter / FundNavAdapter）
│   │   └── cache/           ← 行情缓存策略
│   ├── db/                  ← Drizzle schema + migrations
│   └── i18n/                ← 中英文案（en.ts / zh.ts）
├── docs/
│   ├── adr/                 ← Architecture Decision Records
│   └── *.md                 ← 项目文档
└── tools/                   ← 一次性脚本（含 seed-dev-data.ts，ADR 007）
```

**铁律**：业务代码永远 `import { Button } from '@arc/ui'`；绝不直接 `import` 自 `heroui-native` / `heroui-native-pro` / `react-native-safe-area-context` / `lucide-react-native` / `@gorhom/*` / `@dicebear/*`。`@arc/ui` 内部分层是接口层细节，业务不感知。

**遇到一个 UI 元素该归到哪一层？决策树（ADR 006）**：

1. HeroUI Native OSS 有同名同义组件？→ `primitives/`
2. HeroUI Native Pro 有？→ `primitives-pro/`
3. 是 RN 生态事实标准的非 HeroUI 包？→ `wrappers/`（接口稳定的薄封装）
4. 是导航容器类（tab bar / header / drawer / sheet）且生态无合适方案？→ `navigation/`
5. 是 Arc 金融领域专属组件？→ `finance/`
6. 是图表？→ `charts/`
7. 是头像？→ `avatar/`
8. 都不是 → 一次性讨论再归位，**禁止 ad-hoc 跨出 `@arc/ui`**

---

## 六、色彩方案

支持红涨绿跌 / 绿涨红跌切换，所有涨跌色必须引用 `packages/ui/tokens/semantic.ts` 中的语义色，禁止硬编码颜色值。

```ts
// 正确示例
import { semanticTokens } from "@arc/ui/tokens";
const gainColor = semanticTokens[theme].gain[colorScheme]; // 'red' | 'green'

// 错误示例 ❌
const gainColor = "#00A86B";
```

---

## 七、模型分工指南

| 任务类型                         |  首选模型  |  备选  |
| :------------------------------- | :--------: | :----: |
| 架构决策 / ADR 起草 / 数据模型   |  **Opus**  | Sonnet |
| 算法实现（TWR / 再平衡 / FX 链） |  **Opus**  | Sonnet |
| React Native 页面 / 表单 / CRUD  | **Sonnet** |   —    |
| Bug 修复（已诊断） / CSV 解析    | **Sonnet** | Haiku  |
| Bug 诊断（复杂 / edge case）     |  **Opus**  | Sonnet |
| UI 微调 / 文案 / a11y / typo     | **Haiku**  | Sonnet |
| 依赖升级 / lint 修复             | **Haiku**  | Sonnet |
| Prompt engineering（AI 模块）    |  **Opus**  | Sonnet |
| 安全 review / 合规审查           |  **Opus**  | Sonnet |

**切换信号**：Sonnet 反复改不对一个 bug → 升 Opus；Opus 在做无脑 CRUD → 降 Sonnet；Sonnet 改 typo/升级版本 → 降 Haiku。

---

## 八、Skill 应用时机

### 核心开发 Skills

| Skill                              | 何时用                                                               |
| :--------------------------------- | :------------------------------------------------------------------- |
| `heroui-native`                    | 使用 HeroUI Native OSS 组件（Button / Card / TextField 等）          |
| `heroui-native-pro`                | 使用 HeroUI Pro Native 组件（DatePicker / Stepper / SlideButton 等） |
| `heroui-pro-design-taste`          | 生成 UI / 审查设计质量 / 提升视觉细节                                |
| `vercel-react-native-skills`       | RN 组件开发、列表性能优化、动画、原生模块                            |
| `vercel-composition-patterns`      | 组件 API 设计、复合组件、props 膨胀重构                              |
| `drizzle-orm-expert`               | Schema 设计、关系查询、migration 编写                                |
| `supabase-postgres-best-practices` | SQL 查询优化、RLS 策略、索引设计                                     |
| `tanstack-query-expert`            | 数据获取、缓存策略、optimistic update                                |
| `zustand-store-ts`                 | 新建 / 重构 Zustand Store                                            |
| `zod-validation-expert`            | Schema 验证、表单校验、类型推断                                      |
| `typescript-pro`                   | 复杂类型系统、泛型设计                                               |
| `i18n-localization`                | 检测硬编码文案、管理翻译文件                                         |

### 质量保障 Skills

| Skill                     | 何时用                             |
| :------------------------ | :--------------------------------- |
| `find-bugs`               | 提交前审查分支变更中的 bug         |
| `security-best-practices` | Stage 2 末、Stage 4 上架前安全审查 |
| `code-review`             | 任何涉及金融计算或支付的 PR        |
| `smart-commit`            | 生成规范 commit message、推送代码  |

### 工具 Skills（按需）

| Skill           | 何时用                  |
| :-------------- | :---------------------- |
| `skill-creator` | 创建 / 改进自定义 Skill |

---

## 九、常用命令

```bash
pnpm install          # 安装依赖（同时自动安装 husky git hooks）
pnpm dev              # 启动开发（Turborepo 并行）
pnpm build            # 构建所有包
pnpm lint             # ESLint 检查
pnpm typecheck        # TypeScript 检查
pnpm test             # 运行 property-based tests（@arc/core）
pnpm format           # Prettier 格式化

# Skills 同步（通常由 git hooks 自动触发）
#   canonical source: .claude/skills/ (纳入 Git)
#   本地镜像: .qoder/skills/, .cursor/skills/ (gitignored)
pnpm sync:skills      # 手动同步 canonical → 本地镜像

# packages/db 就绪后：
pnpm --filter @arc/db generate   # 生成 Drizzle migration
pnpm --filter @arc/db push       # 推送 schema 到 Supabase
```

> **注意**：Git hooks 由 husky 管理，`pnpm install` 时自动安装。`git commit`（skills 有变更时）、`git pull` 和 `git checkout` 均会自动触发 skill 同步，无需手动执行 `sync:skills`。

---

## 十、决策记录规范

关键架构选择存入 `docs/adr/NNN-标题.md`，格式：

- **状态**：提议 / 已接受 / 已废弃
- **背景**：为什么要做这个决策
- **决策**：具体选择了什么
- **后果**：这个决策带来的利弊

切换模型时必须让新模型阅读最近 3 条 ADR。

---

## 十一、项目宪法 + 工程 Harness

**Spec-Driven Development 入口**：

- 任何 AI session 或人类贡献者**必须先读** `.specify/constitution.md`（项目宪法 — P0/P1 约束 + 禁忌文案）
- 改动数据模型前必须读 `.specify/data-model-invariants.md`（5 大不变性法则）
- 实施 Stage 任务前对照 `.specify/stage-acceptance-criteria.md`（BDD 验收标准）
- 实施非 trivial feature 前先在 `.specify/feature-specs/<name>.md` 写 spec

**工程 Harness**（自动化质量基线）：

- husky pre-commit → lint-staged 自动 prettier + skills 有变更时同步到本地镜像
- husky post-checkout/post-merge → 自动 sync skills（canonical source → 本地镜像）
- GitHub Actions pre-push → typecheck + lint + property tests
- Claude SessionStart hook → 自动 typecheck + 提示 constitution 更新
- packages/core 的 property-based tests（vitest + fast-check）守护 Decimal / Asset ID / 数据模型不变性

完整说明：`docs/HARNESS.md`

---

## 十二、设计稿协作（opt-in）

**默认行为**：日常开发不强制出 Pencil 设计稿 / 截图。

**触发**（任一即可，**用户主导**）：

- 用户 prompt 要求"出设计稿 / snapshot / 留痕"
- 用户调用 `/design-snapshot` 命令
- 用户在 PR 前明示 "make a snapshot"

**适用**：完整 journey 闭环、较大交互或布局变化。**不为**字段微调、间距、文案小改服务。

**工作流**：见 `.claude/skills/design-snapshot/SKILL.md`
**设计稿**：`designs/<feature>/*.pen`；截图：`docs/screenshots/<feature>/`
