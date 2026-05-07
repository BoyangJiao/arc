# ADR 003 — Design Tokens 四层架构

- **状态**: 已接受
- **日期**: 2026-05-07
- **作者**: BoyangJiao + Claude
- **相关 ADR**: 002（UI 库选型 - 限定 HeroUI Native + Uniwind + Tailwind v4），CLAUDE.md §六（涨跌色铁律）

---

## 背景

CLAUDE.md §六 立了铁律「所有涨跌色必须引用 `packages/ui/tokens/semantic.ts`，禁止硬编码颜色值」，但当时 token 体系并未真正定义。`packages/ui/src/tokens/index.ts` 当前只是占位（仅有类型 + 常量声明）。

需要正式确立 Arc 的 design token 架构，给后续所有 UI 工作（5 个 Stage 1 页面、Stage 2 复杂金融可视化、未来 Figma → 代码同步）提供统一语言基础。

---

## 决策

### 决策一：采用四层 token 架构

```
Primitive  ──→  Foundation (Intent)  ──→  Semantic  ──→  Component
   ↓                  ↓                       ↓              ↓
原材料            主题意图              角色 / 业务语义     具体应用
blue-500          accent / success      gain / loss        button-bg
```

| 层 | 职责 | 谁定义 | 谁能引用 |
|:---|:---|:---|:---|
| **Primitive** | 色阶 / 不变常量 | HeroUI（`white`, `black`, `snow`, `eclipse`）+ 必要时 Arc 加 | Foundation 引用，**Semantic 只有"中性灰阶/透明度"场景下能跳级直接引用** |
| **Foundation** | 主题意图（accent / success / danger / muted ...）| **HeroUI Native 已提供大部分**，Arc 只补必要的（见决策三） | Semantic 引用 |
| **Semantic** | 角色（bg-page / text-primary）+ 业务语义（gain / loss / deviation-warning）| Arc 自定义 | Component 引用 |
| **Component** | 组件具体状态（button-primary-bg / input-focus-border）| HeroUI 内部已实现，Arc 业务组件按需补 | 业务代码用 className/props 间接消费 |

### 决策二：尊重 HeroUI Native 已有的 Foundation 命名，不另起一套

**真实 HeroUI Native v1.0.2 的 Foundation token 树**（基于 `node_modules/.../heroui-native/lib/module/styles/theme.css` 实测）：

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
  accent, accent-foreground       ← 这是 HeroUI Native 的"品牌主色"，对应 Web 版的 primary
  default, default-foreground     ← 中性可交互
  segment, segment-foreground     ← Segmented Control

Status
  success, success-foreground
  warning, warning-foreground
  danger, danger-foreground

Form fields
  field-background, field-foreground, field-placeholder, field-border

Misc
  muted          ← 次要文本
  border, separator, focus, link
```

**HeroUI Native Pro 额外补 5 个**：`chart-1` ~ `chart-5`（基于 `accent` 派生的图表色阶）

**HeroUI 自动派生的（不算 token 数量，业务可直接用）**：
- 所有 `*-hover` / `*-soft` / `*-soft-foreground` / `*-soft-hover`
- `background-secondary/tertiary/inverse`
- `separator-secondary/tertiary`
- `border-secondary/tertiary`

**关键认知**：
- HeroUI Native 没有 `primary`，**`accent` 才是品牌主色**
- HeroUI Native 有专门的 surface 三级，便于做层叠卡片
- 图表色直接用 `chart-1~5`，**不要自建**

### 决策三：Arc 在 Foundation 层只新增 2 个 token（满足 4 层框架的规则 A）

| Token | 何时用 | 为什么需要新增（满足规则 A 三条件） |
|:---|:---|:---|
| `info`, `info-foreground` | 中性提示色（"价格仅供参考"角标、"汇率延迟"说明、操作引导横幅）| ① 主题功能意图 ✓<br>② 在 ≥2 个 Semantic 角色中使用（提示、Info Banner、Tooltip）✓<br>③ light/dark 需要独立值 ✓ |
| `skeleton` | 加载占位骨架屏 | ① 全局通用功能意图 ✓<br>② 多组件复用（List / Card / Detail）✓<br>③ light/dark 需要独立值 ✓ |

**`brand-secondary`、`accent-2` 等暂不加** —— Arc 当前没有"品牌次级色"需求，等 Figma design system 输出后如确有需求再补。

### 决策四：Semantic 层加"finance 业务子层"（核心 Arc 特化）

通用 Semantic（`bg-page` / `text-primary` / `text-secondary` 等，沿用 HeroUI 默认）之外，Arc 必须有 finance semantic：

```ts
// packages/ui/src/tokens/finance.ts（伪代码示意，真实代码 Stage 1 实施时落地）
export type FinanceColorMode = 'redUpGreenDown' | 'greenUpRedDown';

export const financeSemantic = (mode: FinanceColorMode) => ({
  // 涨跌色 — 关键业务语义
  gain: mode === 'redUpGreenDown' ? 'danger' : 'success',
  loss: mode === 'redUpGreenDown' ? 'success' : 'danger',
  pnlNeutral: 'muted',

  // 偏离度（再平衡场景）
  deviationWarning: 'warning-soft',     // 偏离 5-10%
  deviationCritical: 'danger-soft',     // 偏离 >10%

  // 信息层级（金融数据展示）
  textPrice: 'foreground',              // 主价格
  textPriceSecondary: 'muted',          // 折算价、原始币种价等
  textTimestamp: 'muted',               // "5 分钟前"
  textDisclaimer: 'muted',              // "仅供参考，可能延迟"

  // 数据源标识（Stage 2 多市场场景）
  bgMarketBadge: 'surface-secondary',
});
```

**所有值都映射到现有 Foundation，不新建底层颜色。** 这正是规则 D 的精髓——Foundation 少而精，Semantic 复用。

### 决策五：红涨绿跌切换在 **Semantic 层**完成

这是 CLAUDE.md §六的铁律，本 ADR 给出实现机制：

```
                Foundation 层
                ────────────
                success（永远绿）
                danger（永远红）

User preference: 红涨绿跌
                ↓
                Semantic 层
                ────────────
                gain → danger（红）
                loss → success（绿）
```

**为什么不在 Foundation 切换**：
- Foundation 的 `success` / `danger` 是色彩心理学常识（红 = 危险、绿 = 健康），跨语境通用
- Semantic 是 Arc 特化的金融语义，"涨"在中文圈是红、英文圈是绿——切换是业务概念
- Foundation 一动，所有引用它的组件全动（包括非金融部分如 Toast、Validation 等会变错）

实现细节：用 React Context / Zustand 暴露 `useFinanceColors()` hook，hook 内部根据用户偏好返回当前 mode 的 mapping 表。组件用 `colors.gain` 而不是直接 `'success'`。

### 决策六：数字脱敏不在 token 层

「一键脱敏」（`¥1,234` → `••••`）是**组件 + 内容**层逻辑：
```tsx
<RedactedNumber value={x} hidden={prefs.redacted} />
// 渲染：'¥1,234' 或 '••••'
// 颜色不变（仍 foreground / muted）
```

**ADR 003 不为此新增 token。** 任何涉及金额展示的组件统一走 `<RedactedNumber>` 封装。

### 决策七：Component 层永远不跳级直接引用 Primitive

```
Component  →  Semantic  →  Foundation  →  Primitive
   ✗          ✗  跳级
   ✗ ──────────────────  跳级
   ✗ ─────────────────────────────────  跳级
```

**唯一例外**：Semantic 层的"中性灰阶 / 透明度"场景（规则 B），如 `border-divider` 直接 = `neutral-200`、`backdrop` 直接 = `rgba(0,0,0,0.4)`。这是有意设计，不算违规。

业务代码看不到颜色值，只看到 className（如 `bg-card`、`text-gain`），由 Tailwind 编译时解析到 CSS 变量。

---

## token 总数核算（满足"15-25 Foundation"约束）

| 来源 | Foundation token 数 |
|:---|:---:|
| HeroUI Native 自带 | ~22 |
| HeroUI Native Pro 自带（chart）| 5 |
| Arc 新增（info, skeleton）| 4（含 foreground 配对）|
| **合计** | **~31** |

略超 25 上限，但其中 22 是 HeroUI 已设计的（不可减），实际 Arc 决策面只是"加 4"。可接受。

---

## 实施清单

| # | 任务 | 时机 |
|:--|:---|:---|
| 1 | 在 `apps/mobile/global.css` 用 `@theme inline` 追加 `--info`, `--info-foreground`, `--skeleton`（light + dark 双套）| Stage 1 第一个真实页面前 |
| 2 | 在 `packages/ui/src/tokens/finance.ts` 实现 `financeSemantic()` 函数 | Stage 1 第一个金融组件前 |
| 3 | 在 `packages/ui/src/tokens/RedactedNumber.tsx` 提供组件 | Stage 2 J12 实施时（不阻塞 Stage 1） |
| 4 | 把 `packages/ui/src/tokens/index.ts` 的占位换成正式实现，导出 `financeSemantic`, `useFinanceColors`（hook）| Stage 1 token 落地时 |
| 5 | 在 `apps/mobile/app/(tabs)/settings.tsx` 加涨跌色切换 UI | Stage 1 J5 实施时 |
| 6 | ESLint 规则：禁止业务代码出现 `#xxx` / `rgb(` / `oklch(` / Tailwind 内置色（`red-500` 等）| Stage 1 末或 Stage 2 初 |

---

## 后果

- ✅ Arc 真正有了一致的视觉语言基础，业务代码零硬编码颜色
- ✅ 红涨绿跌切换的实现路径清晰（Semantic 层映射，不污染 Foundation）
- ✅ HeroUI 升级 / 主题包切换时，Arc 业务代码零修改（仅 Foundation 值变化，传播到 Semantic 自动生效）
- ✅ 与 Figma design system（用户后续输出）有清晰的对接面：Figma collection 按 Primitive / Foundation / Semantic / Component 分层
- ⚠️ 业务开发者必须了解四层映射关系，新人 onboard 需读本 ADR
- ⚠️ Stage 1 末必须落实 ESLint 规则，否则规范会被违反

---

## 参考

- HeroUI Native 颜色文档：https://heroui.com/docs/native/getting-started/colors
- Uniwind theming 文档：https://docs.uniwind.dev/theming/custom-themes
- 实际 token 源码：`node_modules/.pnpm/heroui-native@1.0.2_*/node_modules/heroui-native/lib/module/styles/theme.css`
- 用户提供的"四层框架决策树"（保存在本会话历史，BoyangJiao 输入）
