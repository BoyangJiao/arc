# ADR 006 — `@arc/ui` 分层架构与非 HeroUI 组件归位规范

- **状态**: 已接受
- **日期**: 2026-05-15
- **作者**: BoyangJiao + Claude (Opus 4.7)
- **相关 ADR**: 002（UI 库选型），003 v3.1（Design Tokens），004（Avatar Generation）
- **触发**: Stage 1 step 4 审计发现 5 个页面里非 HeroUI 元素（导航返回按钮、tab bar、modal、SafeAreaView、icons、空态、avatar）实现方式发散——有自建、有裸用第三方包、有直接绕过 token 体系，缺乏统一规范。

---

## 背景

ADR 002 决定用 HeroUI Native（OSS）+ HeroUI Native Pro 作为 UI 底层；CLAUDE.md §五立铁律「业务代码永远 `import from '@arc/ui'`，绝不直接 import HeroUI」。但实际开发中遇到一类边界问题：

**HeroUI Native + Pro 没有覆盖的 UI 元素怎么办？** 包括：

| 类别           | 例子                                                                                 | 当前 step 4 处理方式                                                     |
| :------------- | :----------------------------------------------------------------------------------- | :----------------------------------------------------------------------- |
| 导航容器       | Stack header 返回按钮、底部 tab bar                                                  | 自建（FloatingTabBar）、React Navigation 默认                            |
| 系统适配       | SafeAreaView、status bar、keyboard avoiding                                          | 业务代码直接 `import` 自 `react-native-safe-area-context`                |
| 图标           | tab 图标、行尾箭头、空态插画                                                         | 自建 emoji 字符（`📈` `💡` `→`）、直接 `import` 自 `lucide-react-native` |
| 头像           | Me 入口、组合卡片                                                                    | 手写圆 + 首字母（ADR 004 未落地）                                        |
| 跨平台 sheet   | FAB 添加方式、确认弹层                                                               | 用 expo-router 全屏 modal 充当                                           |
| Pro 已有但未用 | EmptyState / DatePicker / NumberField / Segment / InputOTP / CloseButton / TrendChip | 全部裸写                                                                 |

这一现象的根因是：**`@arc/ui` 内部没有清晰的分层，导致每次遇到"HeroUI 没有的东西"决策都需要 ad-hoc**。在 Step 4 表现为：FloatingTabBar 自建到 `apps/mobile/src/components/`（跨出了 ui 包）、SafeAreaView 直接被业务代码引用、lucide-react-native 在业务代码里裸 import、Pro 有 EmptyState 但 Markets/Insights 用 emoji。

同时，BoyangJiao 提出一个长期战略问题：**未来某个 Stage 是否要把 `@arc/ui` 演化成独立的「Arc Component」组件库**（差异化越来越大后，作为公司级原生资产分发）？这要求今天的架构能支持「实现可替换」而非「框上 HeroUI」。

---

## 决策

### 决策一：`@arc/ui` 是接口层而非实现层

业务代码看到的是 `import { X } from '@arc/ui'`，**永远不需要知道也不应该知道 `X` 的内部实现是 re-export、wrap、copy-in 还是 rewrite**。这意味着：

| 时点                     | `Button` 的内部实现                                                                                  | 业务代码改动 |
| :----------------------- | :--------------------------------------------------------------------------------------------------- | :----------- |
| Stage 1（今天）          | `export { Button } from 'heroui-native'`                                                             | —            |
| Stage 3（差异化触发）    | HeroUI OSS（MIT）源码 copy 到 `packages/ui/src/primitives/Button/`，自由修改                         | **零**       |
| Stage 5+（决定独立分发） | 包名重命名 `@arc/ui` → `@arc/component`，删除 heroui peer dep，业务侧通过 tsconfig path alias 重定向 | **零**       |

**铁律**：任何业务代码（`apps/**`）禁止直接 `import` 自 `heroui-native` / `heroui-native-pro` / `react-native-safe-area-context` / `lucide-react-native` / `@gorhom/*` / `@dicebear/*`。一律走 `@arc/ui` 入口。由 ESLint `no-restricted-imports` 机械化守护。

### 决策二：`@arc/ui` 内部按"所有权来源"五层组织

```
packages/ui/src/
├── tokens/             ← 一直自有：Design Tokens（已就位，ADR 003 v3.1）
│
├── primitives/         ← T0 — HeroUI Native OSS 归位
│                          当前: 薄 re-export
│                          未来: 单组件按需 copy-in（MIT 合法）→ 改造 → 最终重写
│
├── primitives-pro/     ← T0p — HeroUI Native Pro 归位
│                          当前: 薄 re-export
│                          License 受限: copy-in / 分发需先和 HeroUI 商务确认
│                          独立目录便于将来法务隔离
│
├── wrappers/           ← T1 — 非 HeroUI 的第三方包薄封装
│                          safe-area / lucide / gorhom-bottom-sheet / dicebear
│                          接口由 Arc 定，实现可换
│
├── navigation/         ← T2-nav — 纯自建的导航容器
│                          FloatingTabBar / CustomStackHeader 等
│
├── finance/            ← T2-domain — 纯自建的金融领域组件（ADR 002 §决策三已规划）
│                          PriceCell / PnLBadge / AllocationDonut / MaskedNumber / TrendChip 等
│
├── charts/             ← T2-charts — 图表（Web/RN 双实现）
│
└── avatar/             ← T2-avatar — 渐变头像（ADR 004 落地处）
```

**对外只暴露一个 flat namespace**：`@arc/ui` 的 `index.ts` 把全部子目录扁平 re-export。业务代码看不到内部分层。

### 决策三：决策树 — 遇到一个 UI 元素该归到哪一层？

按顺序检查，第一个命中的就是归位：

1. **HeroUI Native OSS 有同名同义组件吗？** → `primitives/`（re-export 即可，或按需 wrap）
2. **HeroUI Native Pro 有吗？** → `primitives-pro/`（re-export）
3. **是 RN 生态事实标准的非 HeroUI 包吗？**（safe-area-context, lucide-react-native, @gorhom/bottom-sheet, @dicebear/core 等）→ `wrappers/`（写一层接口稳定的薄封装，业务代码不见原包名）
4. **是导航容器类**（tab bar / header / drawer / sheet 等本质上是"页面骨架"）**且没有合适生态库**？ → `navigation/`（纯自建，颜色全走 tokens）
5. **是 Arc 金融领域专属组件**（带涨跌色、脱敏、报告币种、仅供参考徽章等）？ → `finance/`
6. **是图表？** → `charts/`
7. **是头像？** → `avatar/`
8. 都不是 → 提一次性讨论再归位，**不允许 ad-hoc 跨出 `@arc/ui`**

### 决策四：FloatingTabBar 选型 — 继续自建，不走 native bottom tabs

考量过的方案：

| 方案                                             | 优                               | 劣                                                                                            | 结论    |
| :----------------------------------------------- | :------------------------------- | :-------------------------------------------------------------------------------------------- | :------ |
| **A. 自建（当前）**                              | 跨端一致 / 完全可控 / 改造成本低 | 拿不到 iOS 26 Liquid Glass                                                                    | ✅ 采用 |
| B. `react-native-bottom-tabs`（native UITabBar） | iOS 26 原生效果 / 系统级 a11y    | 只解决 iOS，Web/Android 仍需自建 / 跨端不一致 / 定制空间小 / 未来精细化治理需放弃原生回到自建 | 拒绝    |
| C. expo-router 默认 tab bar                      | 零工作量                         | 完全无法定制 / 视觉不符合 Arc 设计语言                                                        | 拒绝    |

理由：(a) Stage 1-3 路线图里除 tab bar 外没有第二个"必须 iOS 原生体验"的诉求；(b) Arc 三端输出（iOS/Android/Web），native 路线只解决 1/3；(c) Stage 5+ 计划做"统一精细化 UI 治理"，自建沉没成本最低；(d) 真到了某天必须 Liquid Glass 体验（如 AI 抽屉过场），单独那一个组件接 native 即可。

**实施**：把当前 `apps/mobile/src/components/FloatingTabBar.tsx` 迁到 `packages/ui/src/navigation/FloatingTabBar.tsx`，所有颜色（包括目前硬编码的 `rgba(30,30,30,0.85)` / `rgba(255,255,255,0.88)`）挪进 `packages/ui/src/tokens/navigation-colors.ts` 的 `TAB_BAR_COLORS.{light,dark}.pillBackground`。

### 决策五：不建 TopBar 组件，只建一组 "Header Atoms"，通过 React Navigation 的 slot 注入

**为什么不建 TopBar 组件**：React Navigation 的 Stack header 容器**本身就是 TopBar**——它已经接管了 safe area inset / iOS blur translucent / 大标题折叠 / hairline / 转场期间的 cross-fade / 手势返回时的 transform。**任何"封装一个 `<TopBar>` 组件"的尝试只能二选一**：

| 路线                                                 | 后果                                                       |
| :--------------------------------------------------- | :--------------------------------------------------------- |
| 替换 RN header 容器（`headerShown: false` 后整页画） | 丢失上面所有原生行为，跨页一致性靠手动维护，转场动画断裂   |
| 包裹 RN header 容器                                  | 在 slot 已经做的事外再套一层壳，纯增加心智成本，零功能收益 |

正确做法：把 TopBar 拆成一组**可组合的原子**（Header Atoms），通过 `headerLeft` / `headerRight` / `headerTitle` slot 注入。容器留给 React Navigation。

**`packages/ui/src/navigation/header/` 提供的 atoms**（首批）：

| Atom                                          | 用途                                        | 实现                                                                                                                 |
| :-------------------------------------------- | :------------------------------------------ | :------------------------------------------------------------------------------------------------------------------- |
| `<HeaderBackButton>`                          | Stack 返回按钮                              | Pressable + Lucide `ChevronLeft` + 可选 Text + 自动 `router.back()`                                                  |
| `<HeaderCloseButton>`                         | Modal 关闭按钮                              | HeroUI Native `close-button` 或 Pressable + `X` icon                                                                 |
| `<HeaderActionButton iconName="..." onPress>` | 右上操作按钮（AI 入口、过滤、刷新等）       | Pressable + Lucide icon + a11y label                                                                                 |
| `<HeaderAvatarButton>`                        | 顶栏左上头像入口（Portfolio Tab）           | `<UserAvatar>` + Pressable，自动跳 `/me`                                                                             |
| `<HeaderTitle>`                               | 标题文本                                    | Text，自动截断 + 主题感知                                                                                            |
| `useStackScreenOptions({...})` hook           | 一次性产出 `Stack.Screen` 的 `options` 对象 | 内部把 atoms 组装好，业务页面只写 `<Stack.Screen options={useStackScreenOptions({title, backType, rightAction})} />` |

**业务页面用法**：

```tsx
// app/portfolio/[id]/index.tsx
import { useStackScreenOptions, HeaderAvatarButton } from "@arc/ui";

<Stack.Screen
  options={useStackScreenOptions({
    title: portfolio?.name,
    backType: "chevron", // or "close" for modal
  })}
/>;
```

```tsx
// app/(tabs)/index.tsx (Portfolio Tab — Stack header 也可以由 tabs layout 配置)
<Stack.Screen
  options={useStackScreenOptions({
    headerLeft: <HeaderAvatarButton />,
    headerRight: null, // Stage 1-2 留空，Stage 3+ AI icon
  })}
/>
```

**收益**：

- React Navigation 的原生行为零损失
- Atoms 跨页一致，颜色/字号/触达区由 tokens 统一控
- 不绑死"必须有 TopBar"的心智——某些首屏可以 `headerShown:false` 自己画（如 sign-in），不影响其他页面的容器收益
- 未来想加大标题、加 searchBar、加 iOS 26 Liquid Glass header 效果——改 React Navigation 配置即可，atoms 不变

**禁止**：在业务页面里写 `headerShown:false` 后整页手画顶栏。例外只有：sign-in / auth/callback / 首屏 onboarding 等本质上不属于 Stack 体系的页面。

### 决策六：Sheet 容器分两类，各自归位

| 场景                                               | 实现                                                     | 归位                               | iOS 视觉                                                             |
| :------------------------------------------------- | :------------------------------------------------------- | :--------------------------------- | :------------------------------------------------------------------- |
| **全屏覆盖式表单**（transactions/new、CSV import） | `<Stack.Screen options={{ presentation: "formSheet" }}>` | 路由层 + Stack header atoms        | **iOS 原生 form sheet card 堆叠效果**（父页边缘外露 + 圆角卡片上滑） |
| **临时浮层**（FAB 添加方式 Sheet、操作确认）       | HeroUI Native `bottom-sheet`（已确认 OSS 提供）          | `primitives/` re-export            | iOS 原生 sheet 手势                                                  |
| **复杂 snap-points / pan gesture**                 | `@gorhom/bottom-sheet`（生态标准）                       | `wrappers/`，HeroUI 不够用时才引入 | 自定义                                                               |

**Stage 1 step 4 当前 `transactions/new` 用的 `presentation: "modal"` 是错的视觉路线** —— `"modal"` 在 iOS 上呈现为全屏覆盖、无 card 堆叠、没有"父页外露"的层级感。改为 `presentation: "formSheet"` 即可拿到你期望的"iOS 原生带 stack 效果的全屏 sheet"。formSheet 的 RN/Expo 实现底层是 `react-native-screens` 的 `UIModalPresentationFormSheet`，是真正的 iOS 原生 presentation。

Web 与 Android fallback：formSheet 在 Web 上 fallback 为全屏覆盖（react-native-web 限制），在 Android 上 fallback 为系统 modal。Arc 三端体验自然分级——iOS 拿到最佳原生体验，其他端拿到功能等价的覆盖式表单。这与"跨端一致优先于追原生"的策略并不冲突，因为 formSheet 本质是 presentation 风格而非组件功能——视觉一致性靠 Stack header atoms + token 化色彩 + 同样的表单 layout 保证；presentation 本身只是"以何种几何方式进入"。

formSheet 内的头部：用 Stack header（决策五的 atoms）一致处理 —— `<HeaderCloseButton>` 左、`<HeaderTitle>` 中、提交按钮放表单底部而非 header（HIG 推荐）。

### 决策七：SafeAreaView 由 `<Screen>` 收口，业务代码禁止直接使用

`react-native-safe-area-context` 的 `SafeAreaView` 不被 Uniwind 拦截（已在 [packages/ui/src/primitives/Screen.tsx](../../packages/ui/src/primitives/Screen.tsx) 注释里写明根因）。规范：

- 业务页面**统一用 `<Screen>`** 包裹，由 Screen 处理 inset + 背景色解耦
- ESLint 加 `no-restricted-imports` 禁止 `apps/**` 直接 import `react-native-safe-area-context`
- 如确需自定义 inset 行为，新增 `wrappers/` 下的薄封装（如 `<SafeAreaInsets>` hook），不让业务代码见 `SafeAreaView` 字面

### 决策八：未来「Arc Design System」演化路线 — 渐进 copy-in 而非整库 fork

**长期目标**：随着 Arc 在每个组件上累积差异化，最终可能脱离 HeroUI 形成自主组件库 **Arc Design System**（暂用工作名 `arcds` / `@arc/ds`，最终命名 Stage 4 末确定），**用于公司内部其他项目复用，无对外二次商业分发计划**。

**消费者视角的承诺**：内部其他项目使用 arcds 时**完全不感知 HeroUI 的存在**——这是"`@arc/ui` 是接口层"（决策一）的最直接受益方。包名、文档、import 路径、type definitions 都是 Arc 自己的。

**为什么不现在 fork 整库**：

- 整库 fork = 承担所有 HeroUI 组件未来对 RN/Expo 版本升级的兼容性维护。兼职 6-12h/周的项目不可承受
- "渐进 copy-in" 拿到的差异化收益相同：需要改的组件 copy 进来自由改，未改的继续 re-export 享受上游 bug fix
- 整库 fork 后会丢失对 Pro 部分的合规身份

**渐进 copy-in 触发条件**（OR）：

1. 该组件 Arc 需要的能力超出 HeroUI 现有 props 边界（如 PriceCell 需要红涨绿跌 + 脱敏 + 仅供参考徽章一体化）
2. 该组件 HeroUI 实现存在影响 Arc 体验的 bug 且上游修复 ETA 不可控
3. 累计 ≥ 50% 的 primitives 已 copy-in，剩余的为统一起见可批量 copy-in

**Pro 部分（关键澄清）**：

- HeroUI Native OSS 是 MIT — copy-in / 修改 / 内部复用**完全合法**
- HeroUI Native Pro 是商业 license — 仅限同公司主体内使用，**不二次分发给外部公司**
- 由于 BoyangJiao 明确无二次商业分发计划，Pro 组件可在同公司主体内自由用于 arcds 消费方
- `primitives-pro/` 仍然独立成目录的理由：(a) 便于未来如真要走商业路线时法务隔离；(b) 让 import 路径就能识别"这个组件被 Pro license 约束"
- **若未来某日突然有商业分发诉求**（Stage 5+ 极远期）：必须先和 HeroUI 商务确认 OEM 授权或替换为 OSS 版本/自研——这条作为未来 ADR 的触发条件，**当前 ADR 范围内默认无该需求**

---

## 后果

### 正面

- 业务代码对 UI 实现细节零感知 — 未来任何替换/升级/fork 决策对 `apps/` 无影响
- 「HeroUI 没有的东西怎么办」永远有唯一答案，杜绝 step 4 类型的实现发散
- ESLint 机械化守护边界，新模型/新贡献者接手时不会写脏
- 真到 Arc Component 商业化分发那一天，迁移成本是「改包名 + tsconfig path alias」，业务代码零改动
- 给 Pro 部分留了法务隔离的边界，避免长期 license 风险

### 负面

- `@arc/ui` 子目录数量增加（5 → 8）；初期空目录较多
- 引入 `wrappers/` 层意味着第三方包升级时多一道适配工作（但本来就该有）
- 渐进 copy-in 决策需要每次单独走 ADR 或 mini-spec，节奏稍慢

### 风险

- "决策三的决策树"在 reality 里可能有边界 case（既像 navigation 又像 finance）— 缓解：标注归到优先级更高的层（navigation > finance），写进本 ADR 末尾的 FAQ
- Pro license 边界长期模糊 — 缓解：Stage 4 末做一次正式商务沟通，结果写进新 ADR

---

## 实施清单（Step 4 修复一同执行）

- [ ] 在 `packages/ui/src/` 新建子目录 `primitives-pro/` `wrappers/` `navigation/` `finance/` `avatar/`（保留 `.gitkeep`）
- [ ] `index.ts` 扁平 re-export 所有子目录
- [ ] 把 `apps/mobile/src/components/FloatingTabBar.tsx` 迁到 `packages/ui/src/navigation/FloatingTabBar.tsx`；硬编码 rgba 挪进 `tokens/navigation-colors.ts` 的 `TAB_BAR_COLORS.*.pillBackground`
- [ ] 在 `packages/ui/src/navigation/header/` 落地 Header Atoms：`HeaderBackButton` / `HeaderCloseButton` / `HeaderActionButton` / `HeaderAvatarButton` / `HeaderTitle` + `useStackScreenOptions()` hook
- [ ] 在 `primitives/index.ts` 增加 re-export：HeroUI OSS `BottomSheet` / `Dialog` / `InputOTP` / `TextField` / `CloseButton` / `Avatar`
- [ ] 在 `primitives-pro/index.ts` 增加 re-export：Pro `EmptyState` / `DatePicker` / `NumberField` / `Segment` / `TrendChip`
- [ ] 在 `wrappers/icons.ts` 封装 lucide 常用图标：`ChevronLeft` `ChevronRight` `X` `BarChart3` `TrendingUp` `Lightbulb`（业务代码只 `import { ChevronRight } from '@arc/ui'`）
- [ ] 在 `avatar/UserAvatar.tsx` 落地 ADR 004 dicebear gradient
- [ ] 业务页面用 atoms 替换手写 header 元素：
  - Portfolio Tab 顶栏头像 → `<HeaderAvatarButton>`
  - Portfolio Detail 返回 → `<HeaderBackButton>`
  - transactions/new 关闭 → `<HeaderCloseButton>`
  - Me / Settings 返回 → `<HeaderBackButton>`
- [ ] `transactions/new` 的 `presentation` 从 `"modal"` 改为 `"formSheet"`（决策六）
- [ ] `eslint.config.mjs` 加 `no-restricted-imports`：禁止 `apps/**` 直接 import `heroui-native` / `heroui-native-pro` / `react-native-safe-area-context` / `lucide-react-native` / `@gorhom/*` / `@dicebear/*`
- [ ] 更新 CLAUDE.md §五（Monorepo 结构）+ §"业务代码 import 铁律"段反映五层

---

## FAQ

**Q1: `wrappers/` 里的薄封装到底要不要改 API？**
原则：能不改就不改（少一层心智成本）。但若上游 API 命名违反 Arc 风格（如 `lucide-react-native` 的 `ChevronRight` 我们保留；如某个包用 boolean prop bloat 但 Arc 想用 enum，则在 wrappers 里改）。

**Q2: 业务代码偶尔需要 RN 核心 `View` / `Text` / `Pressable`，要包吗？**
不需要。RN 核心组件不在禁止范围。`@arc/ui/Text` 是带主题感知的封装（业务用它），原生 `Text` 仍可用于 a11y label 等场景。

**Q3: 渐进 copy-in 哪天动手？**
不为 copy 而 copy。等某次具体需求触发（如 Stage 3 PnLBadge 需要 HeroUI Badge 没有的能力），那一刻才 copy。

**Q4: 真到 Stage 5 想商业分发，今天还能做什么准备？**
保持本 ADR 决策一的纪律：业务代码不见任何第三方包名。其余战术决策延后。

---

## 关联文档更新

- `CLAUDE.md` §五 — 加入 `@arc/ui` 五层结构图与"决策树"摘要
- `.specify/constitution.md` — 工程铁律第 N 条："业务代码禁止直接 import HeroUI 及任何 wrappers/ 内涵盖的第三方包"
- `eslint.config.mjs` — 加 `no-restricted-imports` 规则
