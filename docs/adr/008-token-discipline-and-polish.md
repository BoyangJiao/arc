# ADR 008 — Token 使用纪律与 UI Polish Sprint

- **状态**: 已接受
- **日期**: 2026-05-19
- **作者**: BoyangJiao + Claude (Opus 4.7)
- **相关 ADR**: 003 v3.1（Token 架构），005（色阶系统），006（@arc/ui 分层），CLAUDE.md §六，constitution.md §"UI styling"
- **触发**: Stage 2 收尾真机走查（iOS 26.4 / iPhone 17）发现 token 体系**架构正确但实施纪律失效**——见 §背景。

---

## 修订记录

| 版本 | 日期       | 变更                                                                                                                                                                                                                                                                                                |
| :--- | :--------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1   | 2026-05-19 | 初稿：6 条决策，无新增 token，纯规则与迁移                                                                                                                                                                                                                                                          |
| v1.1 | 2026-05-19 | §决策一/三 修订：Tab bar active pill 从 `bg-accent-soft` **改回** `bg-accent` 实色 + icon 用 `accent-foreground` 反差色（crypto-wallet/Wise/Robinhood 同流派——品牌色面积小所以 solid 不溢出，深色 icon 压住亮色）。理由：真机验证 `bg-accent-soft` light 模式对比度过低，"安静整洁"反而需要 solid。 |

---

## 背景

ADR 003 v3.1 定义的 token 架构 + ADR 005 的 OKLCH 色阶 + archive `design.md.original`（现已搬至 [packages/ui/DESIGN-TOKENS.md](../../packages/ui/DESIGN-TOKENS.md)）描述的完整 token 表已经全部在 [apps/mobile/global.css](../../apps/mobile/global.css#L109) 实装：

- 3 层 surface（`--surface` / `--surface-secondary` / `--surface-tertiary`）✅
- 3 层 background（`--background` / `--background-secondary` / `--background-tertiary`）✅
- 完整 soft tint 体系（`--accent-soft` / `--success-soft` / `--danger-soft` / `--warning-soft` + `*-hover` + `*-foreground` 自适配）✅
- chart-1..chart-5 从 accent OKLCH 派生 ✅
- ADR 003 v3 §决策三 7 个 Arc 扩展 token（`--info` / `--skeleton` / `*-pressed`）✅

但 Stage 2 真机走查发现：

1. **`text-accent` / `bg-accent` 越权使用**——在 6+ 处非主行动语义出现：
   - [apps/mobile/app/me/settings.tsx:73,81,107,142](../../apps/mobile/app/me/settings.tsx#L73)：设置项 RHS 值文本（"CNY ¥"、"中文"）渲染为霓虹亮绿
   - [packages/ui/src/navigation/header/HeaderAtoms.tsx:51,78,125](../../packages/ui/src/navigation/header/HeaderAtoms.tsx#L51)：返回箭头、X 按钮 icon
   - DEV 悬浮钮（dev-only 工具喧宾夺主）
   - Tab bar active pill 用实色 `bg-accent` 而非软底
2. **3 层 surface / 3 层 background 中只用了 2 层**——`surface-secondary` / `surface-tertiary` / `background-secondary` / `background-tertiary` 在业务代码中**零引用**。
3. **全套 `*-soft` 软底 token 在 UI 中零引用**——已实装但闲置。
4. **Light mode accent 视觉过度饱和**——`--color-brand-300` 的 OKLCH chroma 0.237 已接近"霓虹临界点"，白底上长时间阅读不适。
5. **Modal screen 顶部状态栏渲染白条**（dark mode 下，rebalance/setup 与 rebalance/actions 两屏）——React Navigation modal presentation 的 status-bar 区域未继承 dark background。
6. **i18n 漏译**：rebalance/actions 中 "+2 rebalance.units.share" 渲染原始 key。

横向调研 Wise、Robinhood、crypto-wallet (HeroUI) 三个亮绿系产品后，四方一致收敛在一条原则：

> **Brand 色仅用于 primary actions 与 "purposeful pops"，状态色与 inline 数据用独立 semantic token**

`design.md.original` Do/Don't 章节早已写下相同规则（L383-418，"reserve accent and status colors for real meaning"），但无 enforcement 导致开发期不知不觉漂移。本 ADR 把规则正式上升为工程纪律 + 配套 ESLint。

---

## 决策

### 决策一：Brand accent 应用边界（铁律）

`bg-accent` / `text-accent` / `border-accent` / `text-accent-soft-foreground`（**实色** accent，不含 soft）在业务代码中**仅允许**出现在：

1. **Button variant="primary"** 主行动按钮填充（每屏最多 1 个 dominant 实色）
2. **Focus ring**（键盘/聚焦边框 — 即 `--focus` token 本身 = accent）
3. **Brand 标识**（logo / splash / 品牌图形）
4. **Tab bar active 指示器 pill**（v1.1 修订）— 小面积 pill 容器 + icon 必须用 `accent-foreground` 反差色（不是 `accent-soft-foreground`）

**禁止**应用于：

| 场景                               | 替换方案                                                   |
| :--------------------------------- | :--------------------------------------------------------- |
| 设置项 / 列表项 RHS 值文本         | `text-foreground`（如需强调用 `font-medium`）              |
| Header / nav icon                  | `text-foreground` 或 `text-muted`                          |
| Toast / Banner / Badge / Chip 背景 | `bg-{semantic}-soft`（强制软底，见决策三）                 |
| DEV-only 工具                      | `bg-surface-tertiary` + `text-muted`                       |
| 装饰性"想跳一点"                   | 用层级（surface 抬升）+ 字号字重，不用色                   |
| 大面积按钮 / 容器                  | 仅允许 Button primary（小到中等尺寸）；满屏 CTA 视为反模式 |

**判断公式**：「这是用户必须立即识别并优先操作的行动？或表达当前激活状态？」是 → accent；否 → 中性 token 或 soft tint。

### 决策二：Surface 3 层强制激活，命名不动

回滚 [docs/archive/design-tokens-review-feedback.md](../archive/design-tokens-review-feedback.md) 中 `bg-page` / `bg-card` 的命名提案，恢复 archive `design.md.original` 与已实装的 surface 三层语义（HeroUI 业内事实标准）：

| Token                  | 用途                               | 何时用                                              |
| :--------------------- | :--------------------------------- | :-------------------------------------------------- |
| `bg-background`        | 页面画布最底层                     | Screen 根                                           |
| `bg-surface`           | 主容器（卡片、面板、modal 内容区） | Portfolio card / Settings card / Modal body         |
| `bg-surface-secondary` | surface 上的嵌套容器               | Settings 内分组、可展开行展开区域、详情页二级 panel |
| `bg-surface-tertiary`  | 最深嵌套（保留位）                 | forms-within-forms、复杂详情对话框                  |

**配套**：每层有对应的 `*-foreground` 文字、`border-*` 边框、`separator-*` 分隔线递进版本。

**禁止**：同视图内跳级——若用 `surface-tertiary`，外层必须有 `surface-secondary`（视觉层级不能跳跃）。

`bg-background-secondary` / `background-tertiary` 不在 P0 强制范围内，**保留**但只在确有需要时用（比如 settings 分组背景与主 background 微差时）。

### 决策三：Soft tint 强制使用清单

`*-soft` 软底（15% 透明）+ `*-soft-hover`（20%）+ `*-soft-foreground`（mode 自适配）在以下场景**必须**使用：

| 场景                                                         | Token 组合                                                                                |
| :----------------------------------------------------------- | :---------------------------------------------------------------------------------------- |
| 选中/激活态指示（**非 tab bar**，如 segment 切换、列表多选） | `bg-accent-soft` + `text-accent-soft-foreground`                                          |
| **Tab bar 当前 tab pill** (v1.1)                             | `bg-accent` **实色** + icon `accent-foreground` 反差色 + `shadow-sm`（详见决策一第 4 项） |
| Gain/loss 徽章（数字外的彩色包裹）                           | `bg-success-soft` + `text-success` / `bg-danger-soft` + `text-danger`                     |
| 成功 toast                                                   | `bg-success-soft` + `text-success`                                                        |
| 错误/警告 inline 提示                                        | `bg-danger-soft` / `bg-warning-soft` + 同色 text                                          |

**禁止**：toast / banner / badge / chip 类组件用实色背景（`bg-{semantic}`），除非组件是"全屏 CTA"或"破坏性确认对话框"（如删除确认）。

### 决策四：Light mode accent 微降饱和（保留 dark 霓虹）

打破"两 mode 同值"约定，只在 light variant 替换 `--accent` 底层值。Dark variant 保留 `var(--color-brand-300)`（霓虹在黑底上是优势）。

**实施时**：在 [apps/mobile/global.css](../../apps/mobile/global.css) `@variant light` 块替换 `--accent` 引用：

```css
/* 之前 */
--accent: var(--color-brand-300); /* oklch(88.15% 0.237 145.76) = #50ff6c */

/* 之后 — Week 2 真机比对后选定其一 */
--accent: oklch(86% 0.2 145.76); /* 候选 A: 保守 (-15% chroma, -2% lightness) ≈ #5FE678 */
--accent: oklch(
  84% 0.18 145.76
); /* 候选 B: 中等 (-24% chroma, -4% lightness) ≈ #5BD470 ⭐ 默认推荐 */
--accent: oklch(87% 0.18 138); /* 候选 C: 偏 Wise (-24% chroma, hue 145→138 移向黄绿) ≈ #93E670 */
```

**接受条件**：

- WCAG AA on `--accent` with `--accent-foreground` (`#18181B`)：≥ 7:1（候选三档均符合）
- 真机 light mode 看 5 分钟不感"刺眼"
- 与 dark mode 仍有明显"是同一品牌色"的视觉连续感

**约束**：accent 派生的 `--accent-hover` / `--accent-soft` / `--accent-pressed` / `--focus` / `--chart-3` 全部自动跟随。`accent-foreground` 不变。

**潜在副作用**：`--accent-soft` 在 light 下用 `color-mix(in oklab, var(--color-brand-300) 15%, transparent)` 是直接引用 brand-300 而非 `--accent`。需要在迁移时把 light variant 的 `--accent-soft` 也改成基于 `--accent` 派生，保持一致：

```css
@variant light {
  --accent-soft: color-mix(in oklab, var(--accent) 15%, transparent);
  --accent-soft-hover: color-mix(in oklab, var(--accent) 20%, transparent);
}
```

### 决策五：DESIGN-TOKENS.md 落位 `packages/ui/`

archive `design.md.original` 搬至 [packages/ui/DESIGN-TOKENS.md](../../packages/ui/DESIGN-TOKENS.md)，作为 token **唯一权威**：

- 挨着代码，开发者改组件时顺手翻
- archive `design-tokens-review-feedback.md` **保留**（决策历史不删），但本 ADR 显式标其 SUPERSEDED（命名 `bg-card` 被本 ADR 决策二回滚）
- ADR 003 v3.1 与本 ADR 008 引用 `DESIGN-TOKENS.md` 作为具体值参考
- Week 2 真机比对后，Light mode accent 一栏需在 `DESIGN-TOKENS.md` 更新最终 hex

### 决策六：ESLint enforcement，迁移**完成后**开启

新增 ESLint plugin 或 inline rule 集 `@arc/eslint-plugin-token-discipline`：

| 规则名                                    | 检测                                                                                         | 白名单                                                                                                                                                                         |
| :---------------------------------------- | :------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `arc/no-accent-outside-allowlist`         | className 中 `text-accent` / `bg-accent` / `border-accent`（**不**包含 soft 变体）           | `packages/ui/src/primitives/Button.tsx`（primary variant）、`packages/ui/src/navigation/FloatingTabBar.tsx`（仅 focus state）、`packages/ui/src/finance/FocusRing.tsx`（如有） |
| `arc/no-hard-fill-in-feedback-components` | Toast / Banner / Badge / Chip 组件文件中使用 `bg-{accent\|success\|danger\|warning}`（实色） | 无（强制软底）                                                                                                                                                                 |
| `arc/no-hardcoded-color`                  | 业务代码中 `#xxx` / `rgb()` / `oklch()` / `bg-{tailwind-builtin}`                            | constitution.md §"UI styling" 已规定，本规则正式落地                                                                                                                           |

**开启时机**：迁移**完成后**（Week 3 末）立即开。**不**与迁移同步开（避免 Week 1-2 大量 lint error 干扰工作）。开启时同步加 husky pre-commit。

### 决策七：Button 使用一致性约定

避免同类 CTA 在 header / 空态 / 表单底部出现字号、字重、字色不一致（真机走查：Watchlist CTA 与 Save 按钮视觉漂移）。

#### Size 场景

| 场景                                          | size         | 举例                                  |
| :-------------------------------------------- | :----------- | :------------------------------------ |
| In-screen header right slot（Save / Done）    | `size="sm"`  | rebalance/setup `保存`                |
| Body 内主 CTA（卡片、空状态、表单底部）       | 默认（`md`） | WatchlistEmptyState、welcome、sign-in |
| Hero / 全屏 CTA（landing、onboarding 大按钮） | `size="lg"`  | 暂无场景                              |

#### Variant 场景

| 用途                     | variant         | 备注                |
| :----------------------- | :-------------- | :------------------ |
| 主行动 / 唯一 CTA        | `"primary"`     | 每屏最多 1 个       |
| 次要行动（与主行动平级） | `"secondary"`   | bg-default 中性灰   |
| 第三优先级（链接式）     | `"tertiary"`    | 弱化文字            |
| 仅文字（链接）           | `LinkButton`    | ghost variant 强制  |
| 危险操作                 | `"danger"`      | bg-danger 红        |
| 危险操作（不立即触发）   | `"danger-soft"` | bg-danger-soft 软底 |
| 表单 Cancel / 关闭       | `"ghost"`       | 透明背景            |

#### 内容写法（铁律）

`<Button>` 子内容**仅允许**以下三种之一：

1. **string children** — `<Button>Save</Button>`（推荐）
2. **`<Button.Label>` compound** — 需要额外 className 时
3. **icon + `<Button.Label>`** — 带图标的主行动

**禁止**：`<Button><Text>...</Text></Button>` — `Text` 自带 `text-foreground` 会压过 Button 的 variant-aware color（primary 上表现为白字而非 `accent-foreground`）。

---

## 后果

**优势**：

1. UI 焦点回到"必须看"的行动与状态，整体观感从"满屏霓虹"回到"克制可读"
2. 三层 surface 给 Stage 3 复杂表单 / 详情 / 多步骤 modal 留足视觉层级
3. Light mode 长时阅读眼疲劳显著降低（chroma 降 24% 是非线性感知改善）
4. ESLint 防止 Stage 3 新功能重蹈覆辙
5. Token 体系**零新增**——架构验证完毕，只需消费方更新

**代价**：

1. archive `design.md.original` Light accent 值需 Week 2 更新（一次性 chore）
2. ESLint 白名单本身是反模式信号——白名单膨胀触发重新评估（视为 health metric）
3. 一次性迁移工作约 8-15h（settings 4 处 + header 3 处 + tab bar + DEV 钮 + watchlist + 3 层 surface 应用 + soft tint 应用 + bug fix）

**风险与缓解**：

- **风险 R1**：Week 2 真机三档比对仍找不到舒服值 → 缓解：候选范围预留下探空间，必要时进入 Wise `#9FE870` 区间；最坏接受 light/dark 完全分离色（放弃 crypto-wallet 同值方案）
- **风险 R2**：HeroUI Native 内部组件 hardcode `bg-accent` 在 toast/badge 上 → 缓解：用 `@arc/ui` wrapper override，不改 HeroUI 源（符合 ADR 006）
- **风险 R3**：ESLint 规则误伤 `@arc/ui` 内部组件 → 缓解：白名单按文件路径精确匹配；新增白名单文件需另开 PR 单独审核

---

## 实施清单

详见 [.specify/feature-specs/token-polish-sprint.md](../../.specify/feature-specs/token-polish-sprint.md) — 3 周节奏，10 个执行项。

本 ADR 接受后即可执行 Week 1（基建复位 + Light accent 候选验证准备）。
