# UI Polish Sprint — Cursor Handoff

- **目的**: Claude Opus 与 user 已完成基建与方案设计，由 Cursor 接手执行剩余实现。Claude 最终 review。
- **必读上下文（按顺序）**:
  1. [docs/adr/008-token-discipline-and-polish.md](../../docs/adr/008-token-discipline-and-polish.md) v1.1 — token 纪律铁律 + 6 条决策
  2. [.specify/feature-specs/component-audit.md](./component-audit.md) — 4 方组件 audit + Phase 2 重建计划
  3. [packages/ui/DESIGN-TOKENS.md](../../packages/ui/DESIGN-TOKENS.md) — 完整 token 表
  4. 本文件 — 当前执行状态 + 剩余 batch 详细指令
- **架构决策**（已与 user 确认，**不要更改**）：
  - Header：**混合**——Tab 顶层页保留 React Navigation stack header；modal / 二级页改 in-screen header
  - TabBar：保留浮动 pill；active = solid `bg-accent` + `accent-foreground` icon（crypto-wallet 同款，**已实施**）
  - Light accent：候选 B `oklch(84% 0.18 145.76)` ≈ `#5BD470`（**Batch 5 真机比对后定**）

---

## 一、已完成（截至 2026-05-19）

| 项                                             | 文件                                                                                                                                                                                     | 状态                                                                                                                                                |
| :--------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADR 008 v1 + v1.1 修订                         | [docs/adr/008-token-discipline-and-polish.md](../../docs/adr/008-token-discipline-and-polish.md)                                                                                         | ✅ 已接受                                                                                                                                           |
| Audit 文档                                     | [.specify/feature-specs/component-audit.md](./component-audit.md)                                                                                                                        | ✅                                                                                                                                                  |
| DESIGN-TOKENS.md 搬位                          | `docs/archive/design.md.original` → [packages/ui/DESIGN-TOKENS.md](../../packages/ui/DESIGN-TOKENS.md)                                                                                   | ✅ git mv                                                                                                                                           |
| HeroUI Pro re-exports 1→8                      | [packages/ui/src/primitives-pro/index.ts](../../packages/ui/src/primitives-pro/index.ts)                                                                                                 | ✅ EmptyState / NumberField / NumberStepper / TrendChip / ProgressButton / NumberValue / Widget / Segment                                           |
| HeroUI OSS re-exports 14→26                    | [packages/ui/src/primitives/index.ts](../../packages/ui/src/primitives/index.ts)                                                                                                         | ✅ +Avatar / CloseButton / LinkButton / Dialog / Toast / BottomSheet / Separator / ListGroup / Skeleton / SkeletonGroup / Chip / Tabs / SearchField |
| FloatingTabBar v1.1                            | [packages/ui/src/navigation/FloatingTabBar.tsx](../../packages/ui/src/navigation/FloatingTabBar.tsx) + [tab-bar-icons.tsx](../../packages/ui/src/wrappers/tab-bar-icons.tsx)             | ✅ solid `bg-accent` + `accent-foreground` icon + `shadow-sm`（**真机验证通过**："舒服多了")                                                        |
| HeaderCloseButton → OSS CloseButton            | [HeaderAtoms.tsx:64-72](../../packages/ui/src/navigation/header/HeaderAtoms.tsx#L64)                                                                                                     | ✅                                                                                                                                                  |
| HeaderTextButton → OSS LinkButton              | [HeaderAtoms.tsx:117-131](../../packages/ui/src/navigation/header/HeaderAtoms.tsx#L117)                                                                                                  | ✅                                                                                                                                                  |
| setup.tsx Save 按钮 ghost → primary            | [setup.tsx:136-144](../../apps/mobile/app/insights/rebalance/setup.tsx#L136)                                                                                                             | ✅                                                                                                                                                  |
| index.tsx 空状态 text-accent → text-foreground | [(tabs)/index.tsx:189](<../../apps/mobile/app/(tabs)/index.tsx#L189>)                                                                                                                    | ✅                                                                                                                                                  |
| **InScreenHeader 组件落地**                    | [packages/ui/src/navigation/header/InScreenHeader.tsx](../../packages/ui/src/navigation/header/InScreenHeader.tsx) + [header/index.ts](../../packages/ui/src/navigation/header/index.ts) | ✅ **新组件已写完，0 业务使用**                                                                                                                     |

`pnpm typecheck` 6/6 全绿，截至这次切换。

---

## 二、真机验证已知问题（Cursor 需修复）

| 截图               | 问题                                                                  | 根因                                                                                                                                                                                 | 修法所在 batch                  |
| :----------------- | :-------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------ |
| 设置目标配置 modal | header 区域与 body 颜色不一致（"叠层"）                               | React Navigation modal header 用 `headerStyle.bg = colors.card`（surface #171917），body 用 `contentStyle.bg = colors.background`（#050605）                                         | **Batch 3** — 改 InScreenHeader |
| 设置目标配置 modal | "保存"按钮文字颜色看起来偏白（应该是 accent-foreground #18181B 近黑） | setup.tsx Save 按钮使用 string children，Button 内部应自动用 accent-foreground。如果真机仍看到白字，可能是 disabled state 渲染。**Cursor 真机再确认一次**                            | **Batch 3 顺手验证**            |
| 自选 (Watchlist)   | "搜索添加自选"按钮**白字**而非黑字                                    | [WatchlistEmptyState.tsx:33-35](../../packages/ui/src/finance/WatchlistEmptyState.tsx#L33) 用 `<Text>{ctaLabel}</Text>` 包裹，应直接传 string children 让 Button 自动套 Button.Label | **Batch 3** — 一处小改动        |
| 我 (Me) page       | 左上角 back chevron 在淡灰**圆形描边**里                              | iOS 26 React Navigation stack header 的 native back glyph 渲染。me/index 应改 in-screen header                                                                                       | **Batch 3** — 改 InScreenHeader |

---

## 三、Batch 3：InScreenHeader 推广（**Cursor 立即执行**）

**目标**：将所有 modal / 二级页改用 InScreenHeader，自动修上述 4 个问题。

### 3.1 InScreenHeader API（**已实现，直接用**）

```tsx
import { InScreenHeader, Screen, Button } from "@arc/ui";

// 场景 A: 二级页（back chevron）
<Screen>
  <InScreenHeader title={t("settings.title")} leftType="back" />
  {/* ...content */}
</Screen>

// 场景 B: Modal（X close + Save）
<Screen>
  <InScreenHeader
    title={t("rebalance.setupTitle")}
    leftType="close"
    rightSlot={
      <Button
        size="sm"
        variant="primary"
        isDisabled={!canSave || upsert.isPending}
        onPress={() => void handleSave()}
      >
        {t("common.save")}
      </Button>
    }
  />
  {/* ...content */}
</Screen>

// 场景 C: 仅 back，无 title
<Screen>
  <InScreenHeader leftType="back" />
  ...
</Screen>
```

**约束**：

- 配合 `<Stack.Screen options={{ headerShown: false }} />`（在 screen 内部声明 OR 在父 \_layout 声明）
- InScreenHeader 必须是 Screen 的**第一个子节点**（这样状态栏区域被 Screen 的 `paddingTop: insets.top` + `bg-background` 自动着色，无白条）
- **不要**再调用 `useStackScreenOptions(...)`，那是 stack header 时代的 API

### 3.2 待改造的 6 个 screen

按 verification feedback 优先级排序：

| #   | 文件                                                                                                   | 当前 header 配置                                                                               | 改造后                                                                                                                                                          |
| :-- | :----------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | [apps/mobile/app/insights/rebalance/setup.tsx](../../apps/mobile/app/insights/rebalance/setup.tsx)     | `useStackScreenOptions({ title, backType: "close", headerRight: <Button ...> })`               | `<InScreenHeader leftType="close" rightSlot={<Button .../>} title={...} />` + `<Stack.Screen options={{ headerShown: false, presentation: "modal" }} />`        |
| 2   | [apps/mobile/app/insights/rebalance/actions.tsx](../../apps/mobile/app/insights/rebalance/actions.tsx) | `useStackScreenOptions({ title, backType: "chevron" })`                                        | `<InScreenHeader leftType="back" title={...} />` + `<Stack.Screen options={{ headerShown: false }} />`                                                          |
| 3   | [apps/mobile/app/me/index.tsx](../../apps/mobile/app/me/index.tsx)                                     | `useStackScreenOptions({ title, backType: "chevron" })`                                        | `<InScreenHeader leftType="back" title={...} />` + 删除 `<Stack.Screen options={...} />`（root layout 已 `headerShown: false`）                                 |
| 4   | [apps/mobile/app/me/settings.tsx](../../apps/mobile/app/me/settings.tsx)                               | 同上                                                                                           | 同上                                                                                                                                                            |
| 5   | [apps/mobile/app/me/cash-balances.tsx](../../apps/mobile/app/me/cash-balances.tsx)                     | 同上                                                                                           | 同上                                                                                                                                                            |
| 6   | [apps/mobile/app/markets/search.tsx](../../apps/mobile/app/markets/search.tsx)                         | `useStackScreenOptions({ title })` (root layout 设 `headerShown: true, presentation: "modal"`) | `<InScreenHeader leftType="close" title={...} />` + 改 root layout 该 screen 的 `headerShown: true` → `headerShown: false`（**注意 root \_layout.tsx 也要改**） |

### 3.3 父 \_layout.tsx 调整

- [apps/mobile/app/\_layout.tsx](../../apps/mobile/app/_layout.tsx) — 把以下两个 screen 从 `headerShown: true` 改 `headerShown: false`：
  - `name="portfolio/[id]/transactions/new"` (line 144) — 同时改造该 screen（详见 3.5 可选 Batch）
  - `name="markets/search"` (line 172)

- [apps/mobile/app/insights/\_layout.tsx](../../apps/mobile/app/insights/_layout.tsx) — 把 `rebalance/setup` 的 `headerShown: true`（line 36）改 `false`

### 3.4 Button 子元素铁律（**新约定，写进 ADR 008 §决策一**）

修 [packages/ui/src/finance/WatchlistEmptyState.tsx:33-35](../../packages/ui/src/finance/WatchlistEmptyState.tsx#L33)：

```tsx
// ❌ Before（导致 text-foreground 白色压过 accent-foreground 黑色）
<Button variant="primary" onPress={onCtaPress}>
  <Text>{ctaLabel}</Text>
</Button>

// ✅ After（string children 让 Button 自动用 Button.Label + variant-aware color）
<Button variant="primary" onPress={onCtaPress}>
  {ctaLabel}
</Button>
```

**铁律**：`<Button>` 的内容必须用以下**之一**：

- **string children** — `<Button>Save</Button>`（推荐，最简）
- **`<Button.Label>` compound** — `<Button><Button.Label>Save</Button.Label></Button>`（需要额外 className 时用）
- **icon + label compound** — `<Button><Icon/><Button.Label>...</Button.Label></Button>`

**禁止**：`<Button><Text>...</Text></Button>` —— `Text` 自带 `text-foreground` 会压过 Button 的 variant-aware color。

请 Cursor 完成 Batch 3 时同步 grep 全工程检查是否有别处犯同样错误：

```bash
grep -rn "<Button[^>]*>[\s]*<Text" apps/mobile packages/ui/src
```

### 3.5 可选（同 batch 一起做）

- [apps/mobile/app/portfolio/[id]/transactions/new.tsx](../../apps/mobile/app/portfolio/[id]/transactions/new.tsx) — formSheet presentation，同样改造。这个改了的话 root layout 也要把 `headerShown: true`（line 144）改 false。
- [apps/mobile/app/me/dev-tools.tsx](../../apps/mobile/app/me/dev-tools.tsx)（如有）— 同 me/\* 系列。

### 3.6 Batch 3 DoD

- [ ] InScreenHeader 已被 6+ screen 实际使用
- [ ] `pnpm typecheck` 6/6 全绿
- [ ] 真机验证：
  - [ ] 设置目标配置 modal 顶部 **无"叠层"**（header 与 body 同色）
  - [ ] 设置目标配置 modal 顶部 **无白色状态栏条**（截图 4、5 bug 消失）
  - [ ] 自选空状态 CTA **黑字**（不再白字）
  - [ ] 我 page **无淡灰圆圈描边**的 back chevron
- [ ] 任何 `<Button><Text>` 反模式被清除（grep 验证）

---

## 四、Button 一致性约定（**Cursor 顺手在 ADR-008 加一个决策七**）

User 真机看到 Watchlist CTA 与 Save 按钮**视觉不一致**（字号 / 字重 / 字色不同），需要文档化的约定避免重复犯错。

### 4.1 Size 用什么场景

| 场景                                          | size         | 举例                                          |
| :-------------------------------------------- | :----------- | :-------------------------------------------- |
| In-screen header right slot（Save / Done）    | `size="sm"`  | rebalance/setup `保存`                        |
| Body 内主 CTA（卡片、空状态、表单底部）       | 默认（`md`） | WatchlistEmptyState、welcome.tsx、sign-in.tsx |
| Hero / 全屏 CTA（landing、onboarding 大按钮） | `size="lg"`  | 暂无场景                                      |

### 4.2 Variant 怎么选

| 用途                     | variant         | 备注                |
| :----------------------- | :-------------- | :------------------ |
| 主行动 / 唯一 CTA        | `"primary"`     | 每屏最多 1 个       |
| 次要行动（与主行动平级） | `"secondary"`   | bg-default 中性灰   |
| 第三优先级（链接式）     | `"tertiary"`    | 弱化文字            |
| 仅文字（链接）           | `LinkButton`    | ghost variant 强制  |
| 危险操作                 | `"danger"`      | bg-danger 红        |
| 危险操作（不立即触发）   | `"danger-soft"` | bg-danger-soft 软底 |
| 表单 Cancel / 关闭       | `"ghost"`       | 透明背景            |

### 4.3 内容写法（重复 §3.4 铁律）

**只用** string children / Button.Label / icon+Label 三种之一。**禁用** `<Button><Text>`。

### 4.4 请 Cursor 把上述写进 ADR-008 §决策七

新增 `### 决策七：Button 使用一致性约定` 章节到 [docs/adr/008-token-discipline-and-polish.md](../../docs/adr/008-token-discipline-and-polish.md)。

---

## 五、剩余 Batches（**Batch 4–6 已由 Cursor 完成，2026-05-19**）

| Batch                            | 状态 | 摘要                                                                                     |
| :------------------------------- | :--- | :--------------------------------------------------------------------------------------- |
| 4 TabBar haptic                  | ✅   | `expo-haptics` + `FloatingTabBar` `selectionAsync`                                       |
| 5 Watchlist + accent + TrendChip | ✅   | `WatchlistSearchField`、空态无 CTA、TrendChip、light accent 候选 B 定稿                  |
| 6 a11y + ESLint                  | ✅   | constitution a11y 红线、`@arc/eslint-plugin-token-discipline`、`mobile-app-design` skill |

---

## 五（归档）、原剩余 Batches 说明

### Batch 4 — TabBar haptic

1. `pnpm --filter @arc/mobile add expo-haptics`
2. [FloatingTabBar.tsx](../../packages/ui/src/navigation/FloatingTabBar.tsx) `handleTabPress` 内加：
   ```ts
   import * as Haptics from "expo-haptics";
   // 在 if (!isFocused && ...) 之后：
   Haptics.selectionAsync();
   ```
3. 真机验证 iOS 实机（模拟器无 haptic）

**DoD**：iPhone 真机切 tab 有轻微触感震动。

### Batch 5 — Watchlist 空态彻底解决 + Light accent + TrendChip

详见 [.specify/feature-specs/component-audit.md §三 Track C4 + D](./component-audit.md)。

关键点：

1. **WatchlistEmptyState → 顶部固定 SearchField**：替代"先按 CTA 再去搜索"二段交互。空态文案改为"上方搜索框输入代码或名称"。
2. **Light accent 微降饱和**：[apps/mobile/global.css](../../apps/mobile/global.css) `@variant light` 块 `--accent: var(--color-brand-300)` → 候选 B `oklch(84% 0.18 145.76)`。同时把 `--accent-soft` / `--accent-soft-hover` 改成基于 `--accent` 派生（ADR-008 §决策四副作用修复）。**真机三档比对后定**（候选 A/B/C 见 ADR-008 §决策四 表格）。
3. **WatchlistRow + RebalanceActionList 涨跌色文字 → Pro `TrendChip`**：用已 re-export 的 TrendChip 替换裸 `text-success` / `text-danger` 文字。

### Batch 6 — a11y + ESLint

1. 安装 `awesome-skills/mobile-app-design` skill（RN 原生 + contrast 脚本 + 触控目标 ≥ 44pt）：
   ```bash
   # 标准 awesome-skills 安装路径
   cd .claude/skills/
   git clone https://github.com/awesome-skills/mobile-app-design.git
   # 或 GitHub: https://github.com/awesome-skills/mobile-app-design
   ```
2. [.specify/constitution.md](../../.specify/constitution.md) §"UI styling" 增加 a11y 红线（P0）：
   ```md
   ### Accessibility (a11y)

   - 颜色 contrast 必须 ≥ WCAG AA（normal text 4.5:1，large text 3:1）
   - 触控目标 ≥ 44×44 pt
   - 所有交互元素必须有 accessibilityLabel
   - Button / Pressable 必须有 accessibilityRole
   ```
3. 启用 ADR 008 §决策六 ESLint 规则集 `@arc/eslint-plugin-token-discipline`（参考 ADR 文档）。

---

## 六、Claude 最终 review 清单

Cursor 完成后，请 user 通知我 review。我会检查：

- [ ] **架构合规**：所有改动遵守 ADR 006（业务代码不直接 import heroui-native）、ADR 008（accent 仅 4 处允许）、CLAUDE.md §五
- [ ] **token 纪律**：grep 全工程 `text-accent / bg-accent / border-accent`，确认只在 ADR-008 §决策一允许的 4 类位置出现
- [ ] **Button 一致性**：grep `<Button><Text>` 应返回 0；同类场景 size/variant 一致
- [ ] **header 一致性**：所有 modal/二级页用 InScreenHeader，无残留 `useStackScreenOptions` 不当使用
- [ ] **typecheck + lint** 全绿（含 ESLint token-discipline 规则集启用后）
- [ ] 真机截图比对：3 个 verification feedback 全部消除 + 6 个 batch 3 screen 视觉一致
- [ ] DESIGN-TOKENS.md Light accent 一栏 hex 已 freeze 为真机选定值
- [ ] ADR-008 §决策七 Button 约定章节已写入

---

## 七、Cursor 执行顺序建议

```
1. Batch 3.1 (setup.tsx)        → 真机看 modal 顶部
2. Batch 3.1 (actions.tsx)      → 顺手验证 status-bar 区域
3. Batch 3.2 (me/index)         → 真机看 chevron 圆圈消失
4. Batch 3.3 (settings + cash)  → 复用同模式
5. Batch 3.4 (markets/search)   → 改 root layout headerShown
6. Batch 3.6 (WatchlistEmptyState button child fix) + grep 检查全工程
7. ADR 008 §决策七 写入
8. typecheck + lint 全绿
9. 真机 5-min 全应用回归
10. → 切回 Claude review
```

**预估**：3-4h 兼职。
