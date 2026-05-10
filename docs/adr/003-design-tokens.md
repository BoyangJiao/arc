# ADR 003 — Design Tokens 四层架构（修订版 v2）

- **状态**: 已接受
- **日期**: 2026-05-10（v2 修订）
- **修订记录**: v1（2026-05-07）→ v2（2026-05-10）
  - v2 把单层 Semantic 拆为 Semantic（UI 角色）+ Business 平行二维
  - v2 Semantic 改为「按需映射」原则，不全镜像 Foundation
  - v2 加完整 mapping 表（含 hover / pressed / disabled 状态）
  - v2 加 `info` / `skeleton` / `*-pressed` 5 套 Foundation 扩展
- **作者**: BoyangJiao + Claude
- **相关 ADR**: 002（UI 库选型），CLAUDE.md §六（涨跌色铁律）

---

## 背景

CLAUDE.md §六立了铁律「所有涨跌色必须引用 `packages/ui/tokens/semantic.ts`，禁止硬编码颜色值」，但当时 token 体系并未定义。`packages/ui/src/tokens/index.ts` 当前只是占位。

v1 ADR 003 把 finance 子层塞在 Semantic 里，review 时识别两个问题：
1. **Semantic 层职责混乱**：UI 角色（背景/前景/边框）与业务语义（涨跌/偏离）混杂
2. **通用 Semantic → Foundation 映射缺失**，只给了 finance 部分示例

v2 修订解决这两个问题。

---

## 决策

### 决策一：四层架构 — Semantic 与 Business 平行

```
Primitive  ──→  Foundation (Intent)  ──→  Semantic (UI 角色)  ──→  Component
                       │                  │
                       │                  └─ Business（业务意图，与 Semantic 平行）
                       │
                       └─ Business 直接映射到 Foundation（不经过 Semantic）
```

| 层 | 职责 | 谁定义 | 谁能引用 |
|:---|:---|:---|:---|
| **Primitive** | 色阶 / 不变常量（白、黑、snow、eclipse）| HeroUI 提供，Arc 必要时加 | Foundation 引用；Semantic 只在「中性灰阶 / 透明度」例外场景下跳级直引 |
| **Foundation** | 主题意图（accent / success / danger / muted...）| HeroUI Native 提供大部分，Arc 仅扩 5 个（`info` + `skeleton` + 5 套 `*-pressed`）| Semantic、Business 都引用 |
| **Semantic（UI 角色）** | 背景 / 前景 / 边框 三大类，UI 角色名（`bg-card`、`fg-primary`、`divider`）| Arc，**按需映射** | Component 引用 |
| **Business（业务意图）** | gain / loss / pnl-neutral / deviation-* — 涨跌等业务语义 | Arc | Component 引用 |
| **Component** | 单组件内部状态（`button-primary-bg`、`badge-radius`、`badge-padding-y`）| HeroUI 内部 + Arc 业务组件按需 | 业务代码 className/props 间接消费 |

**Component 同时消费 Semantic 和 Business**：
```tsx
<View className="bg-gain-soft rounded-[--badge-radius] py-[--badge-padding-y]">
  <Text className="text-gain font-semibold">+2.3%</Text>
</View>
```
- `bg-gain-soft` / `text-gain` 是 **Business**
- `--badge-radius` / `--badge-padding-y` 是 **Component**

### 决策二：Semantic「按需映射」原则（不全镜像 Foundation）

**问题**：如果 Semantic 全是 1:1 别名（`bg-page → background`、`fg-on-accent → accent-foreground` ...），就是噪音 token，徒增维护成本。

**规则**：只在以下任一条件时定义 Semantic token，否则业务直接引用 Foundation：

| 定义 Semantic 的条件 | 例子 |
|:---|:---|
| Arc 有专属 intent name，比 Foundation 更易理解 | `bg-card`（Arc 叫"卡片"，HeroUI 叫 `surface`）、`divider`（HeroUI 叫 `separator`）|
| 需要按场景分级，Foundation 没分级或粒度不同 | `bg-card-secondary` / `bg-card-tertiary` — Arc 层叠卡片场景比 HeroUI 默认深 |
| 预期未来有 override 需求 | `bg-skeleton`（无障碍模式需要不同对比度）、`fg-primary`（密集模式可加深字色）|

**反例**：`fg-on-accent → accent-foreground` 完全 1:1，**不定义** Semantic，业务直接 `import { semantics } from '@arc/ui'` 用 `accent-foreground`。

**自由扩展机制**：用到一个新 Semantic 时再加，不预先穷举。每加一个，必须：
1. 在本 ADR §四的 mapping 表追加一行
2. 在 `packages/ui/src/tokens/ui-roles.ts` 加映射
3. 写一行注释说明为什么不直接用 Foundation

### 决策三：Foundation 层只新增 2 类共 7 个 token

HeroUI Native v1.0.2 实测有 ~26 个 Foundation token（详见 §三）。Arc 在此基础上加：

#### 3.1 加 `info` / `info-foreground`（规则 A）

| Token | Light | Dark | 用途 |
|:---|:---|:---|:---|
| `info` | `oklch(0.6 0.15 210)` | `oklch(0.7 0.12 210)` | 中性提示色（"价格仅供参考"角标、"汇率延迟"说明、Info Banner）|
| `info-foreground` | `oklch(0.98 0 0)` | `oklch(0.15 0 0)` | info 背景上的文字 |

#### 3.2 加 `skeleton`（规则 A）

| Token | Light | Dark | 用途 |
|:---|:---|:---|:---|
| `skeleton` | `oklch(0.92 0 0)` | `oklch(0.22 0 0)` | 加载占位骨架屏背景 |

#### 3.3 加 5 套 `*-pressed`（Web 端按下态）

Mobile 端 pressed 复用 HeroUI 已有的 `*-hover`；Web 端独立加深一档：

| Token | 派生公式 | 用途 |
|:---|:---|:---|
| `accent-pressed` | `color-mix(in oklab, var(--accent) 80%, var(--accent-foreground) 20%)` | accent 按钮 :active 态 |
| `success-pressed` | 同公式（success 替换） | success 按钮 |
| `warning-pressed` | 同公式 | warning 按钮 |
| `danger-pressed` | 同公式 | danger 按钮 |
| `default-pressed` | `color-mix(in oklab, var(--default) 90%, var(--default-foreground) 10%)` | 中性按钮 |

`*-pressed` token 的 foreground 复用对应的 `*-foreground`，**不为此再多加 5 个 foreground**。

**Disabled 不加新 token**：HeroUI 已有 `--opacity-disabled: 0.5`，作为组件层的 opacity 处理（不是颜色 token）。组件实现需配套 `pointer-events: none` (Web) / 关闭 touch (Mobile) / `aria-disabled="true"`。

### 决策四：Semantic 层初始 12 个 token（按需扩展）

**初始集**（满足 Stage 1-2 业务页面的最小可用集）：

#### 背景（5）

| Semantic token | Foundation 映射 | 用途 |
|:---|:---|:---|
| `bg-page` | `background` | 页面根底色（ScrollView 整页、Tab 外层）|
| `bg-card` | `surface` | 卡片、Accordion、列表项的浮起容器 |
| `bg-card-secondary` | `surface-secondary` | 层叠卡片第二层（如卡片内部分组）|
| `bg-card-tertiary` | `surface-tertiary` | 层叠卡片第三层（少用）|
| `bg-skeleton` | `skeleton`（Arc 新加）| 加载占位 |

#### 前景（4）

| Semantic token | Foundation 映射 | 用途 |
|:---|:---|:---|
| `fg-primary` | `foreground` | 主文字 / 主图标（标题、主数据）|
| `fg-secondary` | `muted` | 次文字 / 次图标（副标题、说明、disclaimer）|
| `fg-accent` | `accent` | 文字 / 图标本身是 accent 色（链接、激活 Tab label、AI sparkle 图标）|
| `fg-accent-soft` | `accent-soft` | accent 弱化态（hover 前的链接微提示）|

#### 边框（3）

| Semantic token | Foundation 映射 | 用途 |
|:---|:---|:---|
| `border-default` | `border` | 通用边框（卡片描边、输入框）|
| `divider` | `separator` | 列表项之间的分隔线 |
| `border-focus` | `focus` | 聚焦态边框（输入框 focus、按钮 :focus-visible）|

**初始 = 12 个**。其余场景（如 `fg-on-accent` / `bg-overlay` / `bg-interactive`）业务**直接用 Foundation 的对应 token**，不通过 Semantic 中转。等真用到第 13 个、第 14 个再追加。

### 决策五：Business 层 5 个 token，全映射 Foundation

| Business token | Light/Dark Foundation 映射（默认绿涨红跌）| 红涨绿跌偏好下的映射 |
|:---|:---|:---|
| `gain` | `success` | `danger` |
| `loss` | `danger` | `success` |
| `pnl-neutral` | `muted` | `muted` |
| `deviation-warning` | `warning-soft` | `warning-soft` |
| `deviation-critical` | `danger-soft` | `danger-soft` |

每个 Business token 同时定义对应 `*-foreground`（用法 = 在该业务色背景上的文字）、`*-soft`（透明度 15% 的版本，用于背景）：
- `gain-foreground` → 对应 Foundation 的 `*-foreground`
- `gain-soft` → 对应 Foundation 的 `*-soft`
- `gain-soft-foreground` → 对应 Foundation 的 `*-soft-foreground`

**未来扩展业务域**（promotion / ai 等）走同一模式 — 5 个 token 一组，全映射 Foundation。

### 决策六：红涨绿跌切换发生在 **Business 层**

```
Foundation 层
────────────
success（永远绿）
danger （永远红）

User preference: 红涨绿跌
        ↓
Business 层
────────────
gain → danger（红）
loss → success（绿）

Semantic 层永远不参与切换（永远是中性 UI 角色）
```

实现细节：用 React Context / Zustand 暴露 `useBusinessTokens()` hook，hook 内部根据 `useUserPreferences().financeColorMode` 返回当前 mode 的 mapping 表。组件用 `colors.gain` 而不是直接 `'success'`。

### 决策七：数字脱敏不在 token 层

「一键脱敏」（`¥1,234` → `••••`）是**组件 + 内容**层逻辑：
```tsx
<RedactedNumber value={x} hidden={prefs.redacted} />
// 渲染：'¥1,234' 或 '••••'
// 颜色不变（仍 fg-primary / fg-secondary）
```
**ADR 003 不为此新增 token。** 涉及金额展示的组件统一走 `<RedactedNumber>` 封装。

### 决策八：跳级规则

```
Component → Semantic | Business → Foundation → Primitive
   ✗ 跳到 Foundation  ✗ 跳到 Primitive
```

**唯一例外**（规则 B）：Semantic 的「中性灰阶 / 透明度」场景直接 Primitive，如：
- `divider-thin` 直接 `oklch(...)` 灰阶值
- `backdrop` 直接 `rgb(0, 0, 0, 0.4)`
- `shadow-color` 直接 `rgb(0, 0, 0, 0.08)`

**Business 直引 Primitive 严禁**（除非未来有"高对比度无障碍模式"的纯色需求，规则 B 延伸场景）。

业务代码看不到颜色值，只看到 className（`bg-card`、`text-gain`、`border-default`），由 Tailwind 编译时解析到 CSS 变量。

---

## 三、HeroUI Native Foundation 真实 token 树（实测，v1.0.2）

来源：`node_modules/.pnpm/heroui-native@1.0.2_*/node_modules/heroui-native/lib/module/styles/theme.css`

### Primitive
`white`, `black`, `snow`, `eclipse` + sizing：`--radius`, `--field-radius`, `--border-width`, `--field-border-width`, `--opacity-disabled`

### Foundation（HeroUI 原生提供）

```
Base
  background, foreground

Surface（用于 Card / Accordion 等非浮层）
  surface, surface-foreground
  surface-secondary, surface-secondary-foreground
  surface-tertiary, surface-tertiary-foreground

Overlay（用于 Modal / Popover 等浮层）
  overlay, overlay-foreground
  backdrop

Interactive
  accent, accent-foreground       ← HeroUI Native 的「品牌主色」（不叫 primary！）
  default, default-foreground     ← 中性可交互
  segment, segment-foreground     ← Segmented Control

Status
  success, success-foreground
  warning, warning-foreground
  danger, danger-foreground

Form fields
  field-background, field-foreground, field-placeholder, field-border

Misc
  muted          ← 次要文本 / 占位符默认色
  border, separator, focus, link
```

### Foundation（HeroUI 自动派生，不算 token 数量）

- 所有 `*-hover` / `*-soft` / `*-soft-foreground` / `*-soft-hover`
- `background-secondary` / `background-tertiary` / `background-inverse`
- `separator-secondary` / `separator-tertiary`
- `border-secondary` / `border-tertiary`

### Foundation（HeroUI Pro 额外提供）

`chart-1` ~ `chart-5`（基于 accent 派生的图表色阶）— **不要自建**，直接用

### Foundation（Arc 新增）

`info` + `info-foreground`、`skeleton`、`accent-pressed` / `success-pressed` / `warning-pressed` / `danger-pressed` / `default-pressed`

---

## 四、Semantic / Business / Foundation 映射总表

### Semantic UI 角色（初始 12 个）

| Semantic | Foundation 映射 | Light 实测 | Dark 实测 | 何时用 |
|:---|:---|:---|:---|:---|
| `bg-page` | `background` | `#F5F5F5` | `#060607` | ScrollView 根、Tab 外层 |
| `bg-card` | `surface` | `#FFFFFF` | `#181818` | Card / Accordion / 列表项 |
| `bg-card-secondary` | `surface-secondary` | `#EFEFF0` | `#232325` | 卡片内部分组 |
| `bg-card-tertiary` | `surface-tertiary` | `#EAEAEB` | `#262728` | 第三级层叠 |
| `bg-skeleton` | `skeleton`（Arc）| `oklch(0.92 0 0)` | `oklch(0.22 0 0)` | 加载占位 |
| `fg-primary` | `foreground` | `eclipse` | `snow` | 标题、主数据 |
| `fg-secondary` | `muted` | `zinc/500` | `zinc/400` | 副标题、disclaimer |
| `fg-accent` | `accent` | `#0485F7` | `#0485F7` | 链接、激活 Tab label |
| `fg-accent-soft` | `accent-soft` | accent 15% | accent 15% | 弱化前景 |
| `border-default` | `border` | `#DEDEE0` | `#282828` | 输入框 / 卡片描边 |
| `divider` | `separator` | `#AAAAAD` | `#47474B` | 列表项分隔 |
| `border-focus` | `focus`（= `accent`）| `#0485F7` | `#0485F7` | 聚焦边框 |

### Business 业务意图（5 个 + 各自 foreground / soft / soft-foreground）

| Business | 默认（绿涨红跌）→ Foundation | 红涨绿跌偏好 → Foundation | 何时用 |
|:---|:---|:---|:---|
| `gain` | `success` | `danger` | 涨幅、正向 PnL |
| `loss` | `danger` | `success` | 跌幅、负向 PnL |
| `pnl-neutral` | `muted` | `muted` | 0 变化、未结算 |
| `deviation-warning` | `warning-soft` | `warning-soft` | 偏离目标 5-10% |
| `deviation-critical` | `danger-soft` | `danger-soft` | 偏离目标 >10% |

**派生 token 自动跟随主色**：`gain-foreground` / `gain-soft` / `gain-soft-foreground` 由 hook 在切换 mode 时同步切换。

---

## 五、token 总数核算

| 层 | 数量 |
|:---|:---:|
| Primitive | 4 个颜色 + 5 个 sizing |
| Foundation（HeroUI 原生）| ~26 |
| Foundation（HeroUI Pro chart）| 5 |
| Foundation（Arc 新增）| 7（info×2 + skeleton + pressed×5）|
| Semantic（初始）| 12（按需扩展）|
| Business（5 套，每套 4 个变体）| 20 |
| **合计** | **~80**（其中 Arc 真正决策的只有 39 = 7 Foundation + 12 Semantic + 20 Business）|

满足你 4 层框架文档建议的"15-25 Foundation"约束（Arc 自加部分仅 7 个，远在范围内）。

---

## 六、实施清单

| # | 任务 | 时机 | 文件 |
|:--|:---|:---|:---|
| 1 | 在 `apps/mobile/global.css` 用 `@theme inline` 追加 `--info`, `--info-foreground`, `--skeleton`, `--*-pressed`（light + dark 双套）| Stage 1 第一个真实页面前 | `apps/mobile/global.css` |
| 2 | 实现 `useBusinessTokens()` hook（红涨绿跌切换）| Stage 1 第一个金融组件前 | `packages/ui/src/tokens/useBusinessTokens.ts` |
| 3 | 提供 `<RedactedNumber>` 组件 | Stage 3（J12 实施时）| `packages/ui/src/finance/RedactedNumber.tsx` |
| 4 | 替换 `packages/ui/src/tokens/index.ts` 占位为正式实现 | Stage 1 token 落地时 | 见 §七 文件结构 |
| 5 | Settings 页加涨跌色切换 UI | Stage 1（J5 实施时）| `apps/mobile/app/me/settings.tsx` |
| 6 | ESLint 规则禁止业务代码出现 `#xxx` / `rgb(` / `oklch(` / Tailwind 内置色（`red-500` 等）| Stage 1 末或 Stage 2 初 | `eslint.config.mjs` |
| 7 | Semantic 表新增 token 必须同步本 ADR §四与代码 | 持续 | 通过 PR review 强制 |

---

## 七、文件结构

```
packages/ui/src/tokens/
├── index.ts              # barrel: export * from './ui-roles' / './business' / hook
├── ui-roles.ts           # Semantic: bg-* / fg-* / border-* （初始 12 个，按需扩）
├── business.ts           # Business: gain / loss / pnl-neutral / deviation-* （5 套）
├── useBusinessTokens.ts  # 红涨绿跌偏好 hook（订阅 user preferences）
└── README.md             # 简短说明：何时定义 Semantic、何时直引 Foundation
```

**注意命名**：使用 `useBusinessTokens` 而非 `useFinanceColors`，因为未来加 promotion / ai 业务域时不需要再改名。

---

## 八、后果

### 共同后果
- ✅ Arc 真正有了一致视觉语言基础，业务代码零硬编码颜色
- ✅ 红涨绿跌切换实现路径清晰（Business 层映射，不污染 Foundation）
- ✅ HeroUI 升级 / 主题包切换时，Arc 业务代码零修改
- ✅ Semantic 层与 Figma design system 有清晰对接面（Figma collection 按 Primitive / Foundation / Semantic / Business 分层）
- ✅ Business 与 Semantic 解耦后，未来接入其他业务域（promotion / ai）时 Semantic 层零污染

### 警示
- ⚠️ 业务开发者必须了解四层映射关系，新人 onboard 需读本 ADR
- ⚠️ Stage 1 末必须落实 ESLint 规则，否则规范会被违反
- ⚠️ Semantic 按需扩展规则需在 PR review 把关（避免回退为 1:1 全镜像）

---

## 九、参考

- HeroUI Native 颜色文档：https://heroui.com/docs/native/getting-started/colors
- Uniwind theming 文档：https://docs.uniwind.dev/theming/custom-themes
- 实际 token 源码：`node_modules/.pnpm/heroui-native@1.0.2_*/node_modules/heroui-native/lib/module/styles/theme.css`
- 用户提供的 4 层框架决策树：保存在会话历史（参考自 `/Users/boyang/Downloads/token四层框架.md`）
- Review 反馈过程：`docs/archive/design-tokens-review-feedback.md`
