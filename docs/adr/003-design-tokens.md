# ADR 003 — Design Tokens 架构（v3.1）

- **状态**: 已接受
- **日期**: 2026-05-13（v3.1）
- **作者**: BoyangJiao + Claude
- **相关 ADR**: 002（UI 库选型），**005（色阶系统）**，CLAUDE.md §六（涨跌色铁律）

---

## 修订记录

| 版本 | 日期 | 变更 |
|:---|:---|:---|
| v1 | 2026-05-07 | 4 层架构：Primitive → Foundation → Semantic（含 finance）→ Component |
| v2 | 2026-05-10 | Semantic 层拆为「UI 角色 Semantic」+「Business」两条平行分支；Semantic「按需映射」 |
| v3 | 2026-05-11 | 删除 Semantic 层；业务直接消费 HeroUI Foundation；Business 层保留；加 HeroUI token 速查表与"重新评估触发条件" |
| **v3.1** | **2026-05-13** | **Primitive 层扩展为完整 7 个 Tailwind v4 OKLCH 色阶**（brand / green / red / orange / blue / neutral + 单值常量）；Foundation token 改为引用色阶 `var(--color-XXX-NNN)`；新增 ADR 005 单独记录色阶系统 |

**v3.1 触发原因**：v3 中 Primitive 层仅包含 4 个常量（white / black / snow / eclipse）+ sizing，HeroUI Foundation 的实际颜色值是硬编码 hex。这违反"色彩科学方法"原则——任何 token 调整需手改 hex，无法系统性派生。v3.1 通过引入 Tailwind v4 `@theme` 块定义完整 11-stop 色阶，让 Foundation 通过 `var()` 引用色阶，实现:
- 调整 anchor → 整套派生色自动更新
- Light / Dark mode 都从同一色阶取不同 stop
- chart-1 ~ chart-5 继续用 `oklch(from ...)` 派生公式
- 业务代码仍只消费 Foundation 名（不接触色阶 token，遵守 §决策八跳级规则）

---

## 背景

CLAUDE.md §六立铁律「所有涨跌色必须引用 `packages/ui/tokens/`，禁止硬编码颜色值」，但 token 体系长期占位。需要正式确立 Arc 在 HeroUI Native 之上的 token 架构。

讨论过程中（user 与 Claude 多轮深度对话）识别 3 个核心问题：
1. **Semantic 与 Foundation 混用迷惑**（v2 的"按需映射"规则没解决）
2. **业务语义 vs UI 角色不能塞在同一层**（v1 错误地把 finance 塞 Semantic）
3. **多品牌切换成本** vs 维护成本的 EV 平衡

v3 给出最终架构。

---

## 决策

### 决策一：3 层架构 — Foundation 直接给业务消费 + Business 平行子层

```
Layer 1  Primitive       (7 OKLCH 色阶: brand / green / red / orange / blue / neutral
                          + 4 常量: white / black / snow / eclipse + sizing)
                          【v3.1 扩展，详见 ADR 005】
                ↓
Layer 2  Foundation      (HeroUI 26 + Pro 5 + Arc 扩 7 = 38)
                          【实际值通过 var(--color-XXX-NNN) 引用 Primitive 色阶】
            ↓                                  ↓
Layer 3  Component       (业务代码消费层)     ← Business（Arc 业务 token: 5 + 派生 ≈ 20）
                                                ↓
                                              Component
```

| 层 | 职责 | 谁定义 | 谁能引用 |
|:---|:---|:---|:---|
| **Primitive** | OKLCH 色阶（7 个 palette × 11 stops）+ 不变常量（白、黑、snow、eclipse）+ sizing | HeroUI 提供基础 4 常量，**Arc 扩展完整色阶（v3.1）** | Foundation 引用；Business 严禁直引（除规则 B 例外）；**业务代码也禁用 `bg-brand-300` 等色阶 utility** |
| **Foundation** | 主题意图 + UI 角色（accent / surface / muted ...）| HeroUI Native 提供 26、Pro 提供 5、Arc 扩 7；**实际值通过 `var(--color-XXX-NNN)` 引用色阶** | Component 直接引用，Business 也引用 |
| **Business** | 业务领域 token（gain / loss / pnl-neutral / deviation-* ...）| Arc 自定，全部映射到 Foundation | Component 引用 |
| **Component** | 业务代码消费层；通过 className 间接消费 Foundation 与 Business | 业务页面 + 自建组件 | — |

**为什么没有 Semantic 层**：
- HeroUI Foundation 已经是 semantic（`surface` / `accent` / `muted` 都是意图名，不是色值名）
- Tailwind v4 的 `@theme` 自动生成 `bg-X` / `text-X` / `border-X` utility，UI 角色由消费时决定，不需要 token 名重复
- 加 Semantic 层等于把 utility class 工作做进 token 名，纯成本无收益（EV 见 §决策七）

### 决策二：消费规则（黑白分明，零混用）

| 你要表达 | 用什么 | 例子 |
|:---|:---|:---|
| **UI 角色**（背景 / 前景 / 边框 / 状态 / 表单 / 阴影）| **HeroUI Foundation 名** | `bg-surface` / `text-foreground` / `text-muted` / `border-border` / `bg-accent` / `text-accent-foreground` |
| **业务语义**（涨跌 / 偏离 / 业务情绪）| **Business 名** | `text-gain` / `bg-loss-soft` / `text-pnl-neutral` / `bg-deviation-warning` |

**心智模型**：
> 「**这是 UI 元素**」（按钮、卡片、文字、边框、阴影、状态色）→ HeroUI Foundation 名
> 「**这是业务数据**」（涨幅、跌幅、偏离）→ Business 名

二选一，没有"什么时候选哪个"的纠结。

### 决策三：Foundation 层 — 沿用 HeroUI 26 + Arc 扩 7

#### HeroUI Native v1.0.2 自带（26 个）— 不动

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
  accent, accent-foreground       (品牌主色)
  default, default-foreground     (中性可交互)
  segment, segment-foreground     (Segmented Control)

Status
  success, success-foreground
  warning, warning-foreground
  danger, danger-foreground

Form fields
  field-background, field-foreground, field-placeholder, field-border

Text / 修饰
  muted, border, separator, focus, link
```

#### HeroUI Native Pro 自带（5 个）— 不动

```
chart-1, chart-2, chart-3, chart-4, chart-5  (基于 accent 派生的图表色阶)
```

#### Arc 扩展（7 个）— 严格遵守规则 A：跨多组件复用的功能意图

| Token | Light | Dark | 用途 |
|:---|:---|:---|:---|
| `info` | `oklch(0.6 0.15 210)` | `oklch(0.7 0.12 210)` | 中性提示色（"价格仅供参考"角标、"汇率延迟"说明、Info Banner）|
| `info-foreground` | `oklch(0.98 0 0)` | `oklch(0.15 0 0)` | info 背景上的文字 |
| `skeleton` | `oklch(0.92 0 0)` | `oklch(0.22 0 0)` | 加载占位骨架屏背景 |
| `accent-pressed` | `color-mix(in oklab, var(--accent) 80%, var(--accent-foreground) 20%)` | 同公式 | accent 按钮 :active（Web）|
| `success-pressed` | 同公式（success 替换） | 同上 | success 按钮 :active |
| `warning-pressed` | 同公式 | 同上 | warning 按钮 :active |
| `danger-pressed` | 同公式 | 同上 | danger 按钮 :active |
| `default-pressed` | `color-mix(in oklab, var(--default) 90%, var(--default-foreground) 10%)` | 同公式 | 中性按钮 :active |

`*-pressed` 的 foreground 复用对应的 `*-foreground`，不为此再加 5 个 foreground。

**Disabled 不加新 token**：HeroUI 已有 `--opacity-disabled: 0.5`，由组件层 opacity + `pointer-events: none` (Web) / 关闭 touch (Mobile) / `aria-disabled="true"` 实现。

#### Foundation 自动派生（HeroUI 已用 color-mix 生成，业务可直接消费，**不算新 token**）

- `*-hover`（accent / default / success / warning / danger 各一）
- `*-soft`、`*-soft-foreground`、`*-soft-hover`（accent / success / warning / danger 各 3 个）
- `background-secondary`、`background-tertiary`、`background-inverse`
- `separator-secondary`、`separator-tertiary`
- `border-secondary`、`border-tertiary`

### 决策四：Business 层 5 个 token + 派生

| Business token | 默认（绿涨红跌）| 红涨绿跌偏好 |
|:---|:---|:---|
| `gain` | `success` | `danger` |
| `loss` | `danger` | `success` |
| `pnl-neutral` | `muted` | `muted` |
| `deviation-warning` | `warning-soft` | `warning-soft` |
| `deviation-critical` | `danger-soft` | `danger-soft` |

每个 Business token 同时定义对应的 `*-foreground`、`*-soft`、`*-soft-foreground`（直接复用 Foundation 的对应派生）：
- `gain-foreground` → 对应 Foundation 的 `*-foreground`
- `gain-soft` → 对应 Foundation 的 `*-soft`
- `gain-soft-foreground` → 对应 Foundation 的 `*-soft-foreground`

**未来扩展业务域**（如 `promotion`、`ai-glow`）走同一模式 — 5 个核心 + 派生，全部映射到 Foundation。

### 决策五：红涨绿跌切换发生在 Business 层

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

Foundation 永远不参与切换（永远是中性 UI 角色）
```

实现：用 React Context / Zustand 暴露 `useBusinessTokens()` hook，hook 内部根据 `useUserPreferences().financeColorMode` 返回当前 mode 的 mapping 表。组件用 `colors.gain`，不直接 `'success'`。

### 决策六：数字脱敏不在 token 层

「一键脱敏」（`¥1,234` → `••••`）是**组件 + 内容**层逻辑：
```tsx
<RedactedNumber value={x} hidden={prefs.redacted} />
// 渲染：'¥1,234' 或 '••••'
// 颜色不变（仍 foreground / muted）
```

**ADR 003 不为此新增 token**。涉及金额展示的组件统一走 `<RedactedNumber>` 封装（在 packages/ui 实现）。

### 决策七：跳级规则

```
Component → Foundation | Business → Primitive
   ✗ 跳到 Primitive          ✗ 严禁
```

**唯一例外（规则 B）**：Component 内部需要"中性灰阶 / 透明度"且 Foundation 没有现成的，可直接写 Primitive 值或自定 OKLCH，例如：
- `divider-thin: oklch(0.92 0 0 / 0.6)` 用于内嵌细分隔线
- `shadow-color: rgb(0, 0, 0, 0.08)` 用于阴影
- `backdrop-extra-dim: rgb(0, 0, 0, 0.7)` 用于全屏沉浸场景

**Business 直引 Primitive 严禁**（除非未来加"高对比度无障碍模式"的纯色需求）。

业务代码看不到颜色值，只看到 className（`bg-surface` / `text-gain` / `border-border`），由 Tailwind 编译时解析到 CSS 变量。

### 决策八：EV 分析说明（v3 删除 Semantic 的依据）

| 维度 | Option A：直接用 Foundation（v3） | Option B：维护独立 Semantic 映射层（v2） |
|:---|:---|:---|
| 每次新 token / 新组件决策成本 | 0（直接用 HeroUI 名）| 5-15 分钟（决定 Semantic 名 + 维护表 + review） |
| Stage 1-5 预估新 token 决策次数 | — | ~80 次 |
| 5 年累计维护成本（B vs A）| 0 | ~13.3 小时 |
| 某天切 DS 的代价 | 重写：~80 小时 | 改映射表：~24 小时 |
| Option B 切 DS 节省 | — | 56 小时 |
| 5 年内切 DS 概率（Arc 自用工具）| ~1% | — |
| Option B 节省的期望值 | — | 56h × 1% = **0.56 小时** |
| **净结果** | **基准** | **B 净亏 12.7 小时** |

→ 对 Arc，Option A 完胜。**v3 采用 Option A**。

### 决策九：重新评估触发条件

满足任一条件，重新评估升级到 v2 的「Semantic 映射层」架构：

1. **Arc 团队规模 ≥ 3 人**（自我文档性收益变高）
2. **出现明确的多产品 / 多品牌需求**（如 Arc Pro 独立品牌、Arc B2B 版本）
3. **HeroUI 出现 EOL / 重大不兼容升级信号**
4. **切换到非 Tailwind 生态的 UI 库**（如 NativeBase / Tamagui）

任一条件触发时，新立 ADR 修订本架构，删除 Foundation 直消费规则、引入 Semantic 翻译层。

---

## 附录 A — HeroUI Native Foundation 使用速查表

> 这是给 Figma 绑定 + 业务代码 className 选择的**单一权威指南**。任何疑问都查这张表。

### A.1 Background vs Surface 决策树（核心）

```
你要给一个色块绑色 → 问 4 个问题
│
├─ Q1. 是页面级的底色，还是卡片/弹层？
│   ├─ 页面级 → background-* 家族
│   └─ 卡片/浮起 → surface-* 家族
│
├─ Q2. 在所选家族内，需要几层深度？
│   ├─ 默认（绝大多数）→ background / surface（不带后缀）
│   ├─ 内部嵌套区分 → -secondary
│   └─ 三层嵌套（罕见）→ -tertiary
│
├─ Q3. 这是浮在所有内容之上的 modal/sheet 吗？
│   └─ 是 → 用 overlay（不是 surface），背后再加 backdrop dim
│
└─ Q4. 这是按钮/Switch/Tab 等可交互组件吗？
    └─ 是 → 用 accent（主）/ default（次）/ segment（Tab）
       不要用 background/surface（那是静态容器）
```

**核心认知**：`background-*` family = 页面下沉的层级；`surface-*` family = 从页面浮起的卡片层级。两个 family 在颜色上连续，但语义上分两个轴。

### A.2 Foreground 配对规则（消除"用谁"的迷惑）

| 在哪个背景上 | 用什么前景 |
|:---|:---|
| `background-*` 家族（任意层级） | `foreground`（主文字）+ `muted`（次文字） |
| `surface-*` 家族（任意层级） | `surface-foreground`（默认 = `foreground`，预留独立调节口）+ `muted` |
| `overlay` | `overlay-foreground`（默认 = `foreground`）+ `muted` |
| `accent` | `accent-foreground`（高对比白字）|
| `default` | `default-foreground` |
| `segment` | `segment-foreground` |
| `success` / `warning` / `danger` / `info` | 各自的 `*-foreground` |

**`muted` 是与 `foreground` 平级的"次文字"**，不区分背景。disclaimer / 副标题 / 说明文 / placeholder 都用它。

### A.3 完整 Figma 绑定速查表

| 设计意图 | Figma variable | Tailwind class |
|:---|:---|:---|
| **背景类** | | |
| 页面底色 | `background` | `bg-background` |
| 次级页面区（凹陷感）| `background-secondary` | `bg-background-secondary` |
| 三级页面区（zebra 间隔）| `background-tertiary` | `bg-background-tertiary` |
| 卡片背景 | `surface` | `bg-surface` |
| 嵌套卡片 | `surface-secondary` | `bg-surface-secondary` |
| 三层嵌套 | `surface-tertiary` | `bg-surface-tertiary` |
| Modal / Sheet 背景 | `overlay` | `bg-overlay` |
| Modal 遮罩 | `backdrop` | `bg-backdrop` |
| 加载占位 | `skeleton`（Arc 加）| `bg-skeleton` |
| **前景类（文字 / 图标）** | | |
| 页面主文字 | `foreground` | `text-foreground` |
| 卡片主文字 | `surface-foreground` | `text-surface-foreground` |
| 弹层主文字 | `overlay-foreground` | `text-overlay-foreground` |
| 副文字 / 说明 | `muted` | `text-muted` |
| 链接 / 强调字 | `accent` | `text-accent` |
| 主按钮上的字 | `accent-foreground` | `text-accent-foreground` |
| 次按钮上的字 | `default-foreground` | `text-default-foreground` |
| 状态字（inline）| `success` / `warning` / `danger` / `info` | `text-success` 等 |
| **可交互组件** | | |
| 主按钮背景 | `accent` | `bg-accent` |
| 次按钮背景 | `default` | `bg-default` |
| Tab 选中 | `segment` | `bg-segment` |
| 输入框背景 | `field-background` | `bg-field` |
| 输入框边 | `field-border` | `border-field-border` |
| placeholder | `field-placeholder` | `text-field-placeholder` |
| **状态色** | | |
| 成功背景 | `success` | `bg-success` |
| 警告背景 | `warning` | `bg-warning` |
| 错误背景 | `danger` | `bg-danger` |
| 信息背景（Arc 加）| `info` | `bg-info` |
| **Soft 弱化态（透明度 15%）** | | |
| accent soft | `accent-soft` | `bg-accent-soft` |
| success soft | `success-soft` | `bg-success-soft` |
| warning soft | `warning-soft` | `bg-warning-soft` |
| danger soft | `danger-soft` | `bg-danger-soft` |
| **修饰元素** | | |
| 卡片描边 | `border` | `border-border` |
| 列表分隔线 | `separator` | `border-separator` |
| 聚焦环 | `focus` | `ring-focus` |
| 链接色 | `link` | `text-link` |

### A.4 HeroUI vs shadcn 命名对照（如果你更熟 shadcn）

| shadcn | HeroUI Native |
|:---|:---|
| `background` / `foreground` | `background` / `foreground` |
| `card` / `card-foreground` | `surface` / `surface-foreground` |
| `popover` / `popover-foreground` | `overlay` / `overlay-foreground` |
| `primary` / `primary-foreground` | `accent` / `accent-foreground` |
| `secondary` / `secondary-foreground` | `default` / `default-foreground` |
| `muted` / `muted-foreground` | （无 muted-bg）/ `muted` |
| `accent` / `accent-foreground` | `default` / `default-foreground`（注意 shadcn 的 accent ≈ HeroUI 的 default）|
| `destructive` / `destructive-foreground` | `danger` / `danger-foreground` |
| `border` / `input` / `ring` | `border` / `field-border` / `focus` |

---

## 附录 B — Business token 用法示例

```tsx
import { useBusinessTokens } from '@arc/ui';

function PnLCell({ change }: { change: number }) {
  const colors = useBusinessTokens();
  const semantic = change > 0 ? 'gain' : change < 0 ? 'loss' : 'pnl-neutral';

  // ❌ 不要这样写
  // <Text className="text-success">{change}</Text>  ← 直接用 Foundation 表达涨跌
  // <Text className="text-red-500">{change}</Text>  ← 硬编码颜色

  // ✅ 用 Business token
  return (
    <View className={`bg-${semantic}-soft rounded-md px-2 py-1`}>
      <Text className={`text-${semantic}`}>
        {change > 0 ? '+' : ''}{change}%
      </Text>
    </View>
  );
}
```

---

## 实施清单

| # | 任务 | 时机 |
|:--|:---|:---|
| 1 | `apps/mobile/global.css` 用 `@theme inline` 追加 `--info` / `--info-foreground` / `--skeleton`（light + dark）| Stage 1 第一个真实页面前 |
| 2 | `packages/ui/src/tokens/business.ts` 实现 `BUSINESS_TOKEN_MAP` + `useBusinessTokens()` hook | Stage 1 第一个金融组件前 |
| 3 | `apps/mobile/global.css` 追加 5 个 `*-pressed`（Web 端按下态）| Stage 1 中段（首批按钮上线时）|
| 4 | `packages/ui/src/tokens/index.ts` 把占位换成正式实现，导出 `useBusinessTokens` | Stage 1 token 落地时 |
| 5 | `packages/ui/src/redacted-number/` 提供 `<RedactedNumber>` 组件 | Stage 3 J16 实施时（不阻塞 Stage 1-2）|
| 6 | `apps/mobile/app/(tabs)/me/settings.tsx` 加涨跌色切换 UI | Stage 1 J5 实施时 |
| 7 | ESLint 规则：禁止业务代码出现 `#xxx` / `rgb(` / `oklch(` / Tailwind 内置色（`red-500` 等）；禁止业务直接 `text-success` / `text-danger` 表达涨跌（必须经过 `useBusinessTokens()`）| Stage 1 末或 Stage 2 初 |

---

## 后果

- ✅ Arc 业务代码零混淆：UI 角色用 HeroUI 名、业务语义用 Business 名，二选一无歧义
- ✅ 红涨绿跌切换路径清晰（Business 层映射，不污染 Foundation）
- ✅ HeroUI 升级零成本：业务代码只引用 Foundation，HeroUI 自己改派生实现不影响业务
- ✅ Foundation 维护最低（沿用 HeroUI 26 + Pro 5 + Arc 仅扩 7 = 38）
- ✅ Figma design system 直接对齐 HeroUI Foundation 命名（HeroUI 官方 Figma kit 即可作为模板）
- ✅ 切换其他 UI 库的成本可估算且可触发重评估（决策九）
- ⚠️ 业务开发者需了解 HeroUI Foundation 命名（附录 A 速查表是必读）
- ⚠️ Stage 1 末必须落实 ESLint 规则，否则规范容易被违反

---

## 参考

- HeroUI Native 颜色文档：https://heroui.com/docs/native/getting-started/colors
- Uniwind theming 文档：https://docs.uniwind.dev/theming/custom-themes
- shadcn theming 对照：https://ui.shadcn.com/docs/theming
- 实际 token 源码：`node_modules/.pnpm/heroui-native@1.0.2_*/node_modules/heroui-native/lib/module/styles/theme.css`
- Material 3 Token Spec（多品牌 DS 学习参考）：https://m3.material.io/foundations/design-tokens/overview
- 设计系统对话历史：BoyangJiao + Claude（2026-05-07 → 2026-05-11，会话 transcript 保存）
