# Feature Spec — Token Polish Sprint（UX/UI Polish I）

- **目标**: 落实 [ADR 008](../../docs/adr/008-token-discipline-and-polish.md) 决策一至六；不引入新 token，纯纪律 + 迁移 + bug fix
- **范围**: `apps/mobile/`、`packages/ui/`、`apps/mobile/global.css`、新增 ESLint plugin
- **不在范围**: 任何 feature 层 UI 微调（推迟到 Stage 3 后的 Polish II）；新增组件 API；redesign
- **预估工作量**: 8-15h（兼职 3 周，每周 3-5h）
- **接受条件**: §验收 全部 ✅

---

## Week 1 — 基建复位 + Light accent 候选准备

| #   | 任务                                                           | 文件                                                                                                 | 完成标志                                                        |
| :-- | :------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------- |
| 1   | **审阅并接受 ADR 008**                                         | [docs/adr/008-token-discipline-and-polish.md](../../docs/adr/008-token-discipline-and-polish.md)     | 状态从"提议"→"已接受"                                           |
| 2   | **DESIGN-TOKENS.md 已就位**（本次已完成 git mv）               | [packages/ui/DESIGN-TOKENS.md](../../packages/ui/DESIGN-TOKENS.md)                                   | 路径正确 + 内容完整（242 行 + 表格）                            |
| 3   | **archive 标 SUPERSEDED**                                      | [docs/archive/design-tokens-review-feedback.md](../../docs/archive/design-tokens-review-feedback.md) | 文档顶部插入 SUPERSEDED 标识 + 链接到 ADR 008                   |
| 4   | **CLAUDE.md §六 + constitution.md §"UI styling" 加入纪律条款** | [CLAUDE.md](../../CLAUDE.md)、[.specify/constitution.md](../../.specify/constitution.md)             | 增"accent 仅用于主行动 + focus + brand 标识"红线 + 链接 ADR 008 |
| 5   | **生成 Light accent 三档候选 hex 工具**（可选）                | `tools/preview-accent-candidates.html` 或 Storybook story                                            | 在浏览器/Figma 看到三档候选并列对比                             |

**Week 1 DoD**：ADR 接受、文档落位、约束写进宪法。零业务代码改动。

---

## Week 2 — Light accent 真机敲定 + `text-accent` 清扫

| #   | 任务                                                                                                                                                                              | 文件                                                                                                                     | 完成标志                                                 |
| :-- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------- |
| 6   | **真机三档比对**：在 iPhone 17 + Android 设备各打开候选 hex，看 5 分钟，挑一档                                                                                                    | `apps/mobile/global.css` 临时修改三次                                                                                    | 选定档位（A/B/C 之一），记入 ADR 008 §决策四             |
| 7   | **应用 Light accent**：替换 `apps/mobile/global.css` `@variant light` 的 `--accent` 值；同步 `--accent-soft` / `--accent-soft-hover` 改为基于 `--accent` 派生（决策四副作用修复） | [apps/mobile/global.css:113-118](../../apps/mobile/global.css#L113)                                                      | 真机 light/dark 切换观感顺畅；Dev 工具 → screenshot 留档 |
| 8   | **`text-accent` / `bg-accent` 越权清扫**（核心）—— grep 全部使用点逐一处理：                                                                                                      |                                                                                                                          |                                                          |
| 8a  | settings 4 处值文本 → `text-foreground` + 选择性 `font-medium`                                                                                                                    | [apps/mobile/app/me/settings.tsx](../../apps/mobile/app/me/settings.tsx)                                                 | 真机 light 看：值文本不再霓虹                            |
| 8b  | Header icons (back / X / action) → `text-foreground`                                                                                                                              | [packages/ui/src/navigation/header/HeaderAtoms.tsx](../../packages/ui/src/navigation/header/HeaderAtoms.tsx)             | 导航 icon 中性灰黑                                       |
| 8c  | DEV 悬浮钮 → `bg-surface-tertiary` + `text-muted`                                                                                                                                 | `apps/mobile/src/components/dev-tools/DevToolsFloatingOverlay.tsx`                                                       | DEV 钮不再喧宾夺主                                       |
| 8d  | Tab bar active pill → `bg-accent-soft` + `text-accent-soft-foreground`（替代实色 pill）                                                                                           | [packages/ui/src/tokens/navigation-colors.ts](../../packages/ui/src/tokens/navigation-colors.ts) + `FloatingTabBar` 组件 | 当前 tab 是软底，不刺眼但仍可识别                        |
| 8e  | Watchlist 主 CTA「搜索添加自选」→ 保留 `bg-accent`（主行动 ✅），但加 `accent-foreground` 文字 + 略缩短按钮高度（48 → 44），观感不再"满屏绿"                                      | [apps/mobile/app/(tabs)/markets.tsx](<../../apps/mobile/app/(tabs)/markets.tsx>) 或 `WatchlistEmptyState`                | CTA 仍醒目但不再撑满视觉中心                             |

**Week 2 DoD**：截图 1、2、3 的"霓虹问题"消失；真机 light/dark 切换观感平滑。

---

## Week 3 — 3 层 surface 应用 + 软底 + 真 bug 修复 + ESLint 上锁

| #   | 任务                                                                                                            | 文件                                                                                                                                                                                                             | 完成标志                                                                        |
| :-- | :-------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------ |
| 9   | **3 层 surface 落地**——识别 3 个最高频嵌套场景:                                                                 |                                                                                                                                                                                                                  |                                                                                 |
| 9a  | Settings 内分组（同 card 内的二级 cell 包裹） → `bg-surface-secondary`                                          | [apps/mobile/app/me/settings.tsx](../../apps/mobile/app/me/settings.tsx)                                                                                                                                         | 真机看 dark：分组背景比卡片略深                                                 |
| 9b  | Rebalance 行动单内每条 action card → 父 card `surface`，每行子 row 用 `surface-secondary`                       | [apps/mobile/app/insights/rebalance/actions.tsx](../../apps/mobile/app/insights/rebalance/actions.tsx)、[packages/ui/src/finance/RebalanceActionList.tsx](../../packages/ui/src/finance/RebalanceActionList.tsx) | 行级视觉层级清晰                                                                |
| 9c  | Watchlist 列表行（dark mode 当前是 `#2a2a2a` 单层）→ background 走 `background-secondary`，row 走 `surface`     | [apps/mobile/app/(tabs)/markets.tsx](<../../apps/mobile/app/(tabs)/markets.tsx>)                                                                                                                                 | row 与背景有微差                                                                |
| 10  | **软底 token 应用**——Gain/loss 数字徽章（如 `+1.05%` / `-0.42%`）添加 `bg-success-soft` / `bg-danger-soft` 包裹 | [packages/ui/src/finance/PnLBadge.tsx](../../packages/ui/src/finance/PnLBadge.tsx)（或对应位置）、Watchlist row 中的趋势 chip                                                                                    | 真机 dark：涨跌色不再"裸数字"，有软色包裹                                       |
| 11  | **修 header 安全区白条 bug**（截图 4、5）                                                                       | [apps/mobile/app/\_layout.tsx](../../apps/mobile/app/_layout.tsx)、[apps/mobile/app/insights/\_layout.tsx](../../apps/mobile/app/insights/_layout.tsx)、modal screen 根容器                                      | dark mode 下 modal 顶部状态栏与 body 同色                                       |
| 12  | **修 `rebalance.units.share` i18n 漏译**（截图 4 的 "+2 rebalance.units.share"）                                | i18n 调用链 + [packages/i18n/src/locales/zh.ts](../../packages/i18n/src/locales/zh.ts) 与 en.ts 验证                                                                                                             | 真机显示 "+2 股" / "+2 shares"                                                  |
| 13  | **ESLint plugin 落地**：实现并启用 3 条规则（见 ADR 008 决策六）                                                | `packages/eslint-plugin-token-discipline/`（新建）、各 `.eslintrc` / `eslint.config.mjs`                                                                                                                         | `pnpm lint` 在干净代码上零 error；故意写 `text-accent` 在非白名单文件触发 error |
| 14  | **husky pre-commit + CI 集成 token-discipline 规则**                                                            | `.husky/pre-commit`、CI workflow                                                                                                                                                                                 | `git commit` 在违规改动上被阻止；CI 同步红                                      |

**Week 3 DoD**：截图 1-5 的所有问题消失；`pnpm lint` 全绿；ESLint 阻止新代码引入违规。

---

## 验收（DoD）

迁移完整通过需满足全部以下：

- [ ] **视觉验收**（真机 iOS + Android 各一）
  - [ ] Settings 值文本不再霓虹（截图 2 修复）
  - [ ] Tab bar active 是软底，不刺眼（截图 1 修复）
  - [ ] DEV 钮不抢戏（截图 1 修复）
  - [ ] Watchlist 主 CTA 醒目但不撑满（截图 3 修复）
  - [ ] Rebalance / Setup modal 顶部状态栏与 body 同色（截图 4、5 修复）
  - [ ] "+2 rebalance.units.share" 正确显示为 "+2 股"（截图 4 修复）
  - [ ] Light/dark 切换流畅，accent 观感连续但不刺眼
- [ ] **工程验收**
  - [ ] `pnpm typecheck` 全绿
  - [ ] `pnpm lint` 全绿，token-discipline 规则启用
  - [ ] `pnpm test` 全绿（property tests 不受影响）
  - [ ] ADR 008 状态 → 已接受
  - [ ] DESIGN-TOKENS.md Light accent 值已 freeze 为选定 hex
- [ ] **回归**
  - [ ] 财务计算无变更（金额、TWR、再平衡引擎结果一致）
  - [ ] 涨跌色切换（红涨绿跌）仍正常
  - [ ] i18n 中英切换无新增漏译

---

## 风险登记

| 风险                                          | 概率 | 影响 | 应对                                                                             |
| :-------------------------------------------- | :--- | :--- | :------------------------------------------------------------------------------- |
| Light accent 三档都不够耐看                   | 低   | 中   | 进入 Wise `#9FE870` 区间或完全分离色                                             |
| ESLint 规则与 HeroUI Native 内部组件冲突      | 中   | 低   | 白名单 `packages/ui/` 内部文件；wrapper override                                 |
| Modal header 修复涉及 React Navigation 配置坑 | 中   | 中   | 使用 `<StatusBar>` 组件 + Stack screen-level `statusBarBackgroundColor` 双管齐下 |
| 迁移过程中误改 finance 计算逻辑               | 低   | 高   | 严格只改 className 与 token；不动 `useFinanceColors` 或 business layer           |
| 时间溢出超 3 周                               | 中   | 低   | 分批合并；Week 2 末已有 P0 截图问题修复 PR 可独立合并                            |

---

## 不做的事

- ❌ 引入新 token（架构已完整）
- ❌ 改组件 API（保持 `@arc/ui` 对外 flat namespace 稳定）
- ❌ Feature 层 UI 重设计（推迟到 Stage 3 后 Polish II）
- ❌ 字体 / spacing / radius 体系核对（推迟到 Polish II）
- ❌ a11y 全量审计（focus order / screen reader / dynamic type）（推迟到 Polish II）
- ❌ Animation / motion 体系（推迟到 Polish II）
