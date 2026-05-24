# Feature Spec — @arc/ui 组件四方 Audit + Phase 2 重建计划

- **目标**: 在 [ADR 008](../../docs/adr/008-token-discipline-and-polish.md) token 纪律基础上，全面 audit @arc/ui 组件覆盖 vs HeroUI OSS / Pro / crypto-wallet 参考实现，识别"重复造轮子"与"未利用 HeroUI 能力"，定 Phase 2 重建计划
- **触发**: 2026-05-19 真机走查反馈 3 个组件级 bug（dark mode 主 CTA / 二级页 header / light tab bar）+ 用户指示"全面检查项目能复用 HeroUI 的就复用，不要完全自建"
- **架构决策**（本次确认）:
  - **Header**：混合方案——Tab 顶层页保留 React Navigation stack header；modal screens 改 in-screen header（crypto-wallet/Robinhood/Wise 主流方案）
  - **TabBar**：保留浮动 pill，active 改用 `bg-surface-secondary + 1.5px border-accent` 轮廓 + bolder icon + 加 haptic（保持当前结构 + 提升识别度）
- **范围**: `packages/ui/src/`、`apps/mobile/app/`（modal screens 重构）
- **不在范围**: 业务逻辑变更；@arc/core 算法层；feature 层 UI 微调
- **预估工作量**: 12-20h（兼职 3-4 周）

---

## 一、四方组件清单（已核实）

### 1.1 HeroUI Native OSS（39 个）

**已在 [primitives/index.ts](../../packages/ui/src/primitives/index.ts) re-export 的 14 个**：
`Button`、`Card`、`Switch`、`Surface`、`PressableFeedback`、`TextField`、`Label`、`Input`、`Description`、`FieldError`、`cn`、`HeroUINativeProvider`、`Text`(自建)、`Screen`(自建)

**P0 待 re-export（业务即将用 / 已自建可替换）**：

- `avatar` — Arc 自建 `UserAvatar`（DiceBear wrapper），可结合 HeroUI Avatar 用 fallback 模式
- `close-button` — Arc 自建 `HeaderCloseButton`（raw Pressable），可替换
- `link-button` — Arc 自建 `HeaderTextButton`（raw Pressable + Text），可替换
- `dialog` — 当前用 react-native `Alert`，应替换
- `toast` — 当前无 toast 机制
- `bottom-sheet` — 当前 modal 全走 Stack.Screen modal presentation
- `separator` — 列表分隔无统一组件
- `list-group` — Settings 行可直接复用
- `skeleton` + `skeleton-group` — 当前无 loading state
- `chip` — tags / 状态徽章
- `tabs` — 详情页 in-screen tabs
- `search-field` — Watchlist 搜索（**关键**：可直接替代 dark mode 那个霓虹绿 CTA 的两段交互）

**P1 待 re-export（按需）**：
`accordion`、`alert`、`checkbox`、`control-field`、`input-group`、`input-otp`、`menu`、`popover`、`radio-group`、`scroll-shadow`、`select`、`slider`、`spinner`、`tag-group`、`text-area`

### 1.2 HeroUI Native Pro（29 个）

**已 re-export 的 1 个**：`EmptyState` (subpath import 模式)

⚠️ **subpath import 强制纪律**（[primitives-pro/index.ts:8-13](../../packages/ui/src/primitives-pro/index.ts#L8)）：
chart-indicator 依赖 skia → 顶层 `import` 会让 Metro 贪婪解析所有 transitive imports 导致 bundle 失败。新增任何 Pro 组件**必须**走 `heroui-native-pro/<component>` 形式。

**P0 立即可启用（无 skia 依赖）**：

| Pro 组件                                                                           | 替换 Arc 哪里                                     | 优先级           |
| :--------------------------------------------------------------------------------- | :------------------------------------------------ | :--------------- |
| `number-field`                                                                     | `TargetAllocationForm` 的 % 输入                  | 🔴 高            |
| `number-stepper`                                                                   | 同上（搭配 NumberField）                          | 🔴 高            |
| `trend-chip`                                                                       | `WatchlistRow` 涨跌色文字 + `RebalanceActionList` | 🔴 高            |
| `progress-button`                                                                  | Header Save 按钮（带 loading state）              | 🔴 高            |
| `widget`                                                                           | `DailySnapshotCard` 重构                          | 🟡 中            |
| `number-value`                                                                     | 总市值大数字 ¥115,174.80（动画）                  | 🟡 中            |
| `segment`                                                                          | BUY/SELL/DIVIDEND 切换（Stage 3）                 | 🟡 中            |
| `progress-bar` / `progress-circle`                                                 | 再平衡执行进度                                    | 🟡 中            |
| `stepper`                                                                          | onboarding / 多步表单（Stage 3）                  | 🟡 中            |
| `toggle-button-group`                                                              | 设置项的开关组                                    | 🟢 低            |
| `slide-button`                                                                     | 危险操作确认（如删除 portfolio）                  | 🟢 低            |
| `rating`                                                                           | 暂无场景                                          | —                |
| `social-auth-button`                                                               | OAuth 登录（Stage 4+）                            | —                |
| `date-picker` / `date-field` / `calendar` / `range-calendar` / `date-range-picker` | 交易日期、报表区间（**Stage 2 J11+ 必需**）       | 🔴 高（Stage 2） |
| `split-view`                                                                       | iPad 分屏（V2+）                                  | —                |

**P1 需先装 `@shopify/react-native-skia` 才能用**：
`area-chart`、`bar-chart`、`line-chart`、`chart-crosshair`、`chart-indicator` — Stage 2 接图表时再装

### 1.3 crypto-wallet 自建（30 个，关键样本）

| 文件                            | 价值                                                           | 行动                                       |
| :------------------------------ | :------------------------------------------------------------- | :----------------------------------------- |
| `wallet-header.tsx`             | **In-screen header 模板**（avatar + name + theme select 横排） | 参考做 Arc `InScreenHeader`                |
| `floating-tab-bar.tsx`          | Arc 已基本复制                                                 | 加 haptic + 调整 active 样式               |
| `shared/screen.tsx`             | 比 Arc Screen 更简洁                                           | 保留 Arc 现有（已含 tab bar spacing 逻辑） |
| `shared/app-trend-chip.tsx`     | 包装 Pro `trend-chip`                                          | 直接 import Pro `TrendChip`                |
| `shared/trend-sparkline.tsx`    | 用 Skia 画 sparkline                                           | 推迟到接 skia                              |
| `shared/empty-list.tsx`         | 简单列表空态                                                   | Arc 已有 EmptyState                        |
| `shared/token-picker-sheet.tsx` | 用 `BottomSheet` 做 picker                                     | Arc 接 BottomSheet 后参考                  |
| `shared/theme-select.tsx`       | 颜色主题切换 segment                                           | 参考做 Arc settings                        |
| `swap/slide-to-swap-button.tsx` | 用 Pro `slide-button`                                          | 危险操作场景参考                           |
| `wallet/copy-address-toast.tsx` | 用 OSS `toast`                                                 | Arc 接 toast 后参考                        |
| `assets/asset-list-item.tsx`    | watchlist 行排版参考                                           | 参考改 `WatchlistRow`                      |
| `home/quick-action-card.tsx`    | Dashboard 操作卡                                               | Stage 3 用                                 |
| `icons/single-color/*` (28 个)  | 自建 lucide-style icon library                                 | Arc 用 lucide-react-native wrapper 已等价  |

### 1.4 Arc @arc/ui 自建（13 个）

| 组件                             | 评估                        | Phase 2 行动                                                            |
| :------------------------------- | :-------------------------- | :---------------------------------------------------------------------- |
| `primitives/Screen`              | 含 tab bar spacing 逻辑，OK | 保留                                                                    |
| `primitives/Text`                | 主题感知 wrapper            | 保留                                                                    |
| `navigation/FloatingTabBar`      | 与 crypto-wallet 基本一致   | **改造**：加 haptic + border-accent active 样式                         |
| `navigation/SwipeableActionsRow` | 自建滑动操作行              | 保留（HeroUI 无对应）                                                   |
| `navigation/header/HeaderAtoms`  | 用 raw Pressable 自建       | **重写**：用 OSS `close-button` / `link-button` + Pro `progress-button` |
| `finance/WatchlistRow`           | 自建涨跌色                  | **改造**：用 Pro `trend-chip` 替代裸文字                                |
| `finance/DailySnapshotCard`      | 自建卡片                    | 考虑用 Pro `widget` 重写（P1）                                          |
| `finance/DeviationDonut`         | 自建图（Svg）               | 保留（finance domain）                                                  |
| `finance/DeviationBar`           | 自建条                      | 保留                                                                    |
| `finance/RebalanceActionList`    | 自建列表                    | **改造**：行级用 Pro `trend-chip`                                       |
| `finance/TargetAllocationForm`   | 自建 % 输入                 | **重写**：用 Pro `number-field`                                         |
| `finance/WatchlistEmptyState`    | 已用 Pro EmptyState ✅      | 保留                                                                    |
| `avatar/UserAvatar`              | DiceBear wrapper            | 改用 OSS Avatar + DiceBear fallback 模式                                |

---

## 二、3 个验收 feedback 真因分析

### Feedback #1 — Dark mode "搜索添加自选" 主 CTA 太亮

**真因**：`<Button variant="primary">` 默认填充 `bg-accent` (=`#50FF6C` 神经霓虹) + 按钮高度大（h-12？）+ 占满 column 宽度。

**两个修法**：

- **方案 A**（保留主 CTA）：缩小尺寸 + 减少视觉重量。HeroUI Button 支持 `size="sm"`。
- **方案 B**（替换交互）⭐ 推荐：直接用 OSS **`search-field`** 替换"先点 CTA 再去搜索"二段交互——展示一个真实搜索框即可。crypto-wallet 的 `(tabs)/search.tsx` 就是这种模式。Watchlist 空态用 EmptyState（已有），有数据时顶部放一个 search-field。这样彻底消除大绿按钮。

### Feedback #2 — 二级页 Header "保存" 难读 + 想换掉

**真因**：[HeaderAtoms.tsx:124-137](packages/ui/src/navigation/header/HeaderAtoms.tsx#L124) `HeaderTextButton` 用 raw Pressable + Text + `text-accent` color。Dark mode 下 `text-accent: #50FF6C` 在 dark header 上理论上应该清晰，但截图 2 显示是暗灰——可能 setup.tsx 没用 HeaderTextButton 而是另一种实现。

**架构决策（已选混合）**：

- **Tab 顶层页**（index / markets / insights）保留 React Navigation stack header，HeaderAtoms 重写：用 OSS `close-button` / `link-button` + Pro `progress-button`（Save 带 loading）
- **Modal screens**（rebalance/setup、rebalance/actions、未来的交易表单）改用自建 **`InScreenHeader`**：直接在 screen 顶部放 Surface row（参考 [wallet-header.tsx](.tempref/crypto-wallet/components/wallet/wallet-header.tsx)），完全掌控样式，顺带修掉 modal status bar 白条 bug（决策原因之一）

### Feedback #3 — Light mode tab bar 看不清

**真因**：ADR-008 把 active pill 从 `bg-accent` 实色改成 `bg-accent-soft`（15% 绿 tint），在白底太弱。

**修法**（已选）：保留浮动结构，active 改用：

```
bg-surface-secondary  ← 微深灰，与白底有对比
+ border-1.5 border-accent  ← 品牌色细描边
+ icon: text-accent + stroke-width 加粗  ← 醒目但不溢出
+ Reanimated 切换动画（scale 1.0 → 1.05 短暂回弹）
+ Haptic.selectionAsync()  ← 物理反馈
```

---

## 三、Phase 2 执行计划

### Track A — Expand HeroUI Pro re-exports（1-2h）

新增 [primitives-pro/index.ts](../../packages/ui/src/primitives-pro/index.ts) subpath exports：

```ts
export { EmptyState } from "heroui-native-pro/empty-state"; // 已有
export { NumberField } from "heroui-native-pro/number-field";
export { NumberStepper } from "heroui-native-pro/number-stepper";
export { TrendChip } from "heroui-native-pro/trend-chip";
export { ProgressButton } from "heroui-native-pro/progress-button";
export { NumberValue } from "heroui-native-pro/number-value";
export { Widget } from "heroui-native-pro/widget";
export { Segment } from "heroui-native-pro/segment";
```

**DoD**：`pnpm typecheck` 全绿；bundle 仍能跑（无 skia 报错）。

### Track B — Expand HeroUI OSS re-exports（1h）

新增 [primitives/index.ts](../../packages/ui/src/primitives/index.ts) exports：

```ts
export {
  Avatar,
  CloseButton,
  LinkButton,
  Dialog,
  Toast,
  BottomSheet,
  Separator,
  ListGroup,
  Skeleton,
  SkeletonGroup,
  Chip,
  Tabs,
  SearchField,
} from "heroui-native";
```

**DoD**：`pnpm typecheck` 全绿。

### Track C — Rebuild 3 verification items + 重构件（8-12h）

#### C1: HeaderAtoms 重写

替换 [HeaderAtoms.tsx](../../packages/ui/src/navigation/header/HeaderAtoms.tsx)：

- `HeaderBackButton` → 用 OSS `LinkButton variant="ghost"` + lucide ChevronLeft
- `HeaderCloseButton` → 用 OSS `CloseButton`
- `HeaderActionButton` → 用 OSS `LinkButton variant="ghost"` + icon prop
- `HeaderTextButton` → 用 OSS `LinkButton variant="default"`（颜色由 token 决定，不强制 accent）
- **新增** `HeaderSaveButton` → 用 Pro `ProgressButton`（带 loading state）

#### C2: 新增 `InScreenHeader`

新文件 `packages/ui/src/navigation/header/InScreenHeader.tsx`：

```tsx
// 用于 modal screens；自带 status bar 安全区背景填充
// 结构: <Surface>
//          <flex-row>
//            <Slot name="left" />  ← Close / Back
//            <Title />
//            <Slot name="right" /> ← Save / Action
//          </flex-row>
//        </Surface>
```

Modal screens（setup.tsx、actions.tsx）改 `headerShown: false` + 在 screen 顶部放 InScreenHeader。**顺带修掉 status bar 白条 bug**。

#### C3: FloatingTabBar 改造

[FloatingTabBar.tsx:140-143](../../packages/ui/src/navigation/FloatingTabBar.tsx#L140) active className 替换：

```tsx
isFocused
  ? "bg-surface-secondary border-[1.5px] border-accent"
  : "bg-transparent border-[1.5px] border-transparent";
```

加 haptic：

```ts
import * as Haptics from "expo-haptics";
// in handleTabPress:
Haptics.selectionAsync();
```

加 Reanimated 切换动画（icon scale 1.05 → 1.0 spring bounce）。

#### C4: Watchlist CTA → SearchField 替换

[apps/mobile/app/(tabs)/markets.tsx](<../../apps/mobile/app/(tabs)/markets.tsx>) 重构：

- 顶部固定一个 OSS `SearchField` placeholder = "搜索股票、ETF、基金…"
- 空态保留 EmptyState（无 CTA 按钮，引导文案改为"上方搜索框输入代码或名称"）
- 有数据时也保留顶部 search field（用户可继续添加）

### Track D — Token cleanup（与 C 同步做）

C 重写过程中顺手处理 ADR-008 §决策一/二/三 残留：

| 文件                                                               | 改动                                                      |
| :----------------------------------------------------------------- | :-------------------------------------------------------- |
| `apps/mobile/app/me/settings.tsx`                                  | 4 处 `text-accent` 值文本 → `text-foreground`             |
| `apps/mobile/src/components/dev-tools/DevToolsFloatingOverlay.tsx` | DEV 钮 `bg-accent` → `bg-surface-tertiary` + `text-muted` |
| 3 层 surface 应用：settings 分组、rebalance 行级、watchlist row    | 加 `surface-secondary`                                    |
| Gain/loss 徽章                                                     | 用 Pro `TrendChip` 替代裸文字                             |
| Light accent 微降饱和（ADR-008 §决策四 候选 B）                    | `apps/mobile/global.css` `@variant light --accent` 替换   |

### Track E — 其他 P0 bug

- `rebalance.units.share` i18n 漏译（截图 4）
- Modal status bar 白条 → C2 后自动消除

### Track F — a11y skill + ESLint

放 Phase 2 末：

1. 装 `awesome-skills/mobile-app-design` skill
2. 在 [constitution.md](../../.specify/constitution.md) §"UI styling" 加入 a11y 红线：
   - 颜色 contrast 必须 ≥ WCAG AA（normal text 4.5:1, large text 3:1）
   - 触控目标 ≥ 44×44 pt
   - 所有交互元素必须有 accessibilityLabel
3. 启用 ADR-008 §决策六 的 ESLint 规则集

---

## 四、执行顺序与批次划分

**Batch 1**（小、独立、低风险）：Track A + Track B re-exports
**Batch 2**（中等，影响多文件）：Track C1（HeaderAtoms 重写）+ Track D 中 settings/DEV 改动
**Batch 3**（中等，新组件）：Track C2（InScreenHeader）+ modal screens 重构 + status bar bug 修复
**Batch 4**（中等）：Track C3（FloatingTabBar 改造）+ haptic
**Batch 5**（中等）：Track C4（Watchlist → SearchField）+ Light accent 替换 + TrendChip 应用
**Batch 6**（小）：Track E i18n 修复 + Track F a11y skill 安装 + constitution.md 加红线

每个 Batch 都做：typecheck → 真机验证 → commit。

---

## 五、DoD（整体）

- [ ] 所有 P0 Pro 组件 re-exported 且至少 1 处实际用上
- [ ] 所有 P0 OSS 组件 re-exported
- [ ] HeaderAtoms 已用 OSS/Pro 组件重写；HeaderTextButton 不再用 raw Pressable
- [ ] InScreenHeader 已存在；至少 rebalance/setup 和 rebalance/actions 已切换到 InScreenHeader
- [ ] Modal status bar 白条 bug 消失（真机验证）
- [ ] FloatingTabBar：light mode active tab 清晰可见；切换时有 haptic
- [ ] Watchlist 顶部为 SearchField（无满屏霓虹绿大 CTA）
- [ ] ADR-008 §决策一/二/三/四 全部落地（text-accent 清扫、surface 三层、soft tint、light accent 降饱和）
- [ ] `rebalance.units.share` 漏译修复
- [ ] mobile-app-design skill 已安装
- [ ] constitution.md §"UI styling" 已加 a11y 红线
- [ ] `pnpm typecheck` + `pnpm lint` 全绿
- [ ] 真机 iPhone 17 + Android（如有）light/dark 切换观感合格

---

## 六、风险

| 风险                                                                             | 应对                                          |
| :------------------------------------------------------------------------------- | :-------------------------------------------- |
| ProgressButton 在 stack header headerRight slot 渲染异常                         | Fallback 用 LinkButton + 自建 spinner overlay |
| InScreenHeader 与 React Navigation 转场动画冲突（modal slide-up 时 header 闪烁） | 用 `animated: false` 或自定义 transition      |
| Haptic 在 iOS 模拟器不工作                                                       | 真机验证；fallback no-op                      |
| 启用更多 Pro 组件后 bundle size 超预算                                           | 严格 subpath import；监控 bundle analyzer     |
| SearchField + 搜索结果交互超出原 J8 spec 范围                                    | 标记为 J8.1 后续                              |

---

## 七、Cursor 深度复审补充（2026-05-19 — 用户走查截图）

> Claude 原 audit 的 **清单方向正确**，但对「主题切换后 a11y 失效」这一**系统性根因**覆盖不足。以下为用户红框截图对应项 + 漏网之鱼 + 优先修复队列。

### 7.1 系统性根因（P0 — 一次修、全局受益）

| #      | 根因                                               | 表现（你的截图）                                                          | 正确做法（crypto-wallet / HeroUI 文档）                                        |
| :----- | :------------------------------------------------- | :------------------------------------------------------------------------ | :----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **S1** | **Lucide + `className="text-*"` 不参与运行时主题** | Dark：返回 `<`、空态折线图标几乎看不见；Light 切换后仍可能残留错误 stroke | 与 `TabBarIcon` 一致：用 `useThemeColor('foreground'                           | 'muted')`传`color`prop；或`withUniwind(Ionicons)`。已加 `@arc/ui` **`ThemedLucideIcon`\*\* |
| **S2** | **全 app 未挂 `expo-status-bar`**                  | Light 模式：状态栏时间/信号/电量仍是白字（截图 1）                        | `AppShell` 内 `<StatusBar style={dark\|light} />` 绑定 `useColorMode()`        |
| **S3** | **`CloseButton` 默认 icon 色为 muted**             | formSheet「添加交易」左上角 X 对比度不足（截图 6）                        | `iconProps={{ color: useThemeColor('foreground') }}`（HeaderCloseButton 已改） |

**工程纪律（写入后续 PR）**：

- 禁止 Lucide 裸 `className="text-foreground"`；统一 `ThemedLucideIcon` 或 HeroUI 自带 icon 组件。
- ESLint 待增：`arc/no-lucide-classname-color`（与 token-discipline 并列）。

### 7.2 截图 → 文件映射（Claude audit 未单独列出）

| 截图 | 页面               | 当前实现                                       | Audit 漏项                                          | 建议                                                   |
| :--- | :----------------- | :--------------------------------------------- | :-------------------------------------------------- | :----------------------------------------------------- |
| 1    | 我 / light         | `InScreenHeader` + `HeaderBackButton`          | 未提 StatusBar                                      | S2 已修                                                |
| 2    | 我 / dark          | 同上                                           | 未提 Lucide S1                                      | S1 已修                                                |
| 3    | 再平衡行动单       | `InScreenHeader` + back                        | C2 标为 done 但未写 a11y                            | S1 已修                                                |
| 4    | 自选空态           | `WatchlistEmptyState` + `text-muted` icon      | C4 只提 CTA，未提 **EmptyState.Media 图标**         | S1 已修                                                |
| 5    | 组合详情           | **`useStackScreenOptions` + Stack header**     | **未列入 InScreenHeader 迁移清单**                  | 迁 `InScreenHeader`；与 me/\* 一致                     |
| 6    | 添加交易 formSheet | **仍用 RN Stack header** + `HeaderCloseButton` | C2 说 modal 改 in-screen，**transactions/new 未做** | `headerShown: false` + `InScreenHeader leftType=close` |

### 7.3 仍用 Stack header、应迁 InScreenHeader 的屏幕

| 文件                                  | 现状                                                     | 优先级 |
| :------------------------------------ | :------------------------------------------------------- | :----- |
| `portfolio/[id]/index.tsx`            | `useStackScreenOptions` 覆盖 layout `headerShown: false` | 🔴     |
| `portfolio/[id]/transactions/new.tsx` | root `headerShown: true` + stack close                   | 🔴     |

### 7.4 HeroUI 可复用但尚未落地的项（相对 Claude §1.1–1.2 的补充）

| HeroUI 组件                         | Arc 现状                                        | 应替换的自建/裸 RN                                               | 备注                               |
| :---------------------------------- | :---------------------------------------------- | :--------------------------------------------------------------- | :--------------------------------- |
| **`ListGroup` + `ListGroup.Item`**  | settings/me 手写 `Pressable` + `bg-surface` 行  | 设置、现金余额入口、DEV 入口                                     | crypto-wallet 列表行标准模式       |
| **`LinkButton` ghost**              | `HeaderBackButton` 仍 raw `Pressable` 包 Lucide | 应用 **OSS LinkButton isIconOnly** 或官方 `CloseButton` 尺寸体系 | C1 写了但未完成 back 槽            |
| **`ProgressButton`**                | setup Save 用普通 `Button`                      | header Save + 表单提交 loading                                   | C1 P0                              |
| **`NumberField` / `NumberStepper`** | `TargetAllocationForm` 裸 `Input`               | 目标配置 %                                                       | C1 P0                              |
| **`Avatar` + DiceBear**             | 仅 `UserAvatar`                                 | Me Tab 头像                                                      | audit 有，未排期                   |
| **`Toast`**                         | 全无                                            | DEV seed 成功、复制地址类反馈                                    | crypto-wallet `copy-address-toast` |
| **`Spinner`**                       | `ActivityIndicator` 散落                        | search / dev-tools                                               | 统一 loading 语义                  |

### 7.5 Batch 1–6 文档状态 vs 真机（需更正 DoD 勾选）

| Batch            | 文档声称        | 实际（2026-05-19 用户走查）                                                   |
| :--------------- | :-------------- | :---------------------------------------------------------------------------- |
| 1–2 re-exports   | ✅              | ✅ 已 export，但 **C1 HeaderAtoms 仅 close 用 OSS，back 仍 Pressable+Lucide** |
| 3 InScreenHeader | ✅ 6 屏         | ✅ me/insights/markets；❌ **portfolio 详情、添加交易仍 Stack**               |
| 4 haptic         | ✅              | 需真机再验                                                                    |
| 5 SearchField    | ✅              | ✅；空态 icon a11y 曾失败 → S1                                                |
| 6 ESLint a11y    | ✅ constitution | ESLint 未覆盖 Lucide/className；**缺主题切换回归清单**                        |

### 7.6 建议下一批执行顺序（Batch 7）

1. **S1/S2/S3 合并 PR**（`ThemedIcon` + `StatusBar` + `CloseButton` iconProps）— ✅
2. **Batch 7a**：`portfolio/[id]/index` + `transactions/new` → `InScreenHeader` — ✅
3. **Batch 7b — Lucide → Phosphor（Stage 2）** — ✅ 2026-05-19
   - `phosphor-react-native` 经 `@arc/ui/wrappers/icons.ts` 统一出口
   - `ThemedIcon` 替代 `ThemedLucideIcon`；ESLint 禁止 apps 直引 `phosphor-react-native` / `lucide-react-native`
   - TabBar 仍用 Ionicons（与 crypto-wallet 一致）
4. **Batch 7c** — ✅ 2026-05-19
   - `settings.tsx` / `me/index.tsx` → `ListGroup` + `PressableFeedback`
   - `TargetAllocationForm` → Pro `NumberField`（Input-only，0–100，step 0.1）
   - `HeaderSaveButton`（header 点按保存 + pending spinner）；`setup.tsx` 仅保留 header 保存（底部 `ProgressButton` 已移除——与 header 重复且 light 对比度差）
   - `HeaderBackButton` / `HeaderActionButton` → OSS `LinkButton isIconOnly`
5. **主题切换回归脚本**（手动 5 min）：设置开/关 dark → 检查 6 张截图路径 + TabBar + StatusBar。

### 7.7 crypto-wallet 应对照而 Claude 未展开的样本

> 仓库内无 `.tempref/crypto-wallet` 时，以 HeroUI 官方 example + MCP 文档为准；下列为 audit §1.3 应 **展开为「逐文件 diff」** 的条目：

| crypto-wallet 模式                                | Arc 应对齐点                                                                        |
| :------------------------------------------------ | :---------------------------------------------------------------------------------- |
| `wallet-header.tsx` 行内 header + `useThemeColor` | `InScreenHeader` 左槽统一 HeroUI 按钮，勿裸 Lucide                                  |
| `(tabs)/search.tsx` 顶栏 SearchField              | ✅ markets Tab 已对齐                                                               |
| `theme-select.tsx`                                | settings 深色模式 Switch ✅；可加 Segment 预览                                      |
| `asset-list-item.tsx`                             | `WatchlistRow` 排版 + `TrendChip` ✅                                                |
| `floating-tab-bar.tsx` + haptic                   | ✅ haptic；active 样式仍用 solid accent（ADR 008 v1.1，非 audit C3 的 border 方案） |
