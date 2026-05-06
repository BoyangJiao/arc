# ADR 002 — UI 组件库选型与样式栈决策

- **状态**: 已接受（分支 A）
- **日期**: 2026-05-06
- **作者**: BoyangJiao
- **相关 ADR**: 001-tech-stack（本 ADR 修订其中"样式"行）
- **Spike 提交**: `tools/spike-heroui-native/`（feat/adr-002-ui-library 分支）

---

## 背景

ADR 001 写明 UI 选型为「NativeWind v4 + Tailwind CSS + HeroUI Pro」，但实际落地时发现这三者**互不兼容**：

| 事实 | 来源 |
|:---|:---|
| HeroUI Native（OSS 与 Pro）的样式系统强依赖 **Tailwind CSS v4 + Uniwind** | https://heroui.pro/docs/native/getting-started/installation |
| HeroUI Native 不支持 NativeWind v4 + Tailwind v3 环境 | 同上 |
| `heroui-native` OSS 当前稳定版 **v1.0.2**（已 GA） | npm registry |
| `heroui-native-pro` 当前为 **v1.0.0-beta.2**（仍 beta） | npm registry |
| HeroUI Native 官方文档**未声明** Expo Web / react-native-web 兼容性 | https://heroui.pro/docs/native/getting-started |
| HeroUI Native 体系中**无 Table、无 Chart 组件** | 同上 |

前序 session（commit `2d99bf1`，2026-05-06）已将 `heroui-native-pro@1.0.0-beta.2` 与 `@heroui-pro/react@1.0.0-beta.2` 写入 `apps/mobile/package.json`，并在 `global.css` 留 TODO 注释，但**未完成 Tailwind v4 + Uniwind 的实际迁移**，处于"半集成"状态。

ADR 001 的核心承诺是「一套代码同时出 Native App + Web」，因此**Web 兼容性是本 ADR 不可回避的前置条件**。

---

## 决策

### 决策一：现在就承担 Tailwind v4 + Uniwind 的迁移

理由：
1. `packages/ui/src/` 与 `apps/mobile/app/` 目前**几乎为空**，UI 业务代码尚未开始 — 迁移成本接近零，是切换样式栈的最佳时间窗
2. Tailwind v4 是行业方向，NativeWind v5 的路线图也指向 v4 — 早切早受益
3. 任何 HeroUI Native 路径（OSS 或 Pro）都强制依赖 Uniwind，无替代选项
4. `apps/mobile/package.json` 已声明 `heroui-native-pro` 依赖，但配置层尚未配套 — 当前状态本身就是不一致的

### 决策二：MVP 阶段使用 `heroui-native` OSS，**不**使用 `heroui-native-pro`

| 维度 | OSS (v1.0.2) | Pro (v1.0.0-beta.2) |
|:---|:---:|:---:|
| 稳定性 | GA | Beta |
| 与 CLAUDE.md §3.1「金融严谨性」精神 | ✅ | ⚠️ |
| Pro 独占组件（NumberField / DateRangePicker / Stepper / Calendar） | ❌ | ✅ |
| 升级路径 | 后期 `heroui-pro install` 一键加装 | — |

**Pro 组件如何过渡**：MVP 阶段对 Pro 独占组件的需求采取以下处理：
- **NumberField / NumberStepper**：自建简化版（基于 OSS Input + decimal.js），UI 层薄封装，将来 Pro GA 后替换实现，业务代码无感
- **DateRangePicker**：MVP 用两个独立 `Date` 输入或 OSS 已有的简化方案；TWR/MWR 区间分析功能可推迟到 Pro GA 后再做精修
- **Stepper / Calendar**：MVP 不需要

### 决策三：Pro 许可证保留，不退款

理由：
- Web 端 `@heroui-pro/react` 当前已稳定可用（与 RN Pro 是不同包）；即使 RN 端最终走自建路线，Web 端 Pro 价值不变
- 1 年更新窗口大概率覆盖 `heroui-native-pro` 的 GA 时间
- Pro 是 OSS 的扩展包，未来加装无需重构

### 决策四：在主分支合并前，必须完成 Web 兼容性 Spike

**Spike 验收标准**（详见本仓库 `tools/spike-heroui-native/`）：

| 验收项 | 通过标准 | 否决标准 |
|:---|:---|:---|
| 依赖解析 | `pnpm install` 无 peer dep 冲突 | 出现无法解决的依赖冲突 |
| Metro 构建 | `withUniwindConfig` 加载成功，应用启动无 bundler 报错 | Metro 报错且无社区已知 workaround |
| Web 构建 | `npx expo export --platform web` 成功，产物可在浏览器加载 | Web 构建失败或产物白屏 |
| Web 渲染 | 至少 5 个 HeroUI Native 组件（Button / Card / Input / Switch / Modal）在 Web 视觉一致、可交互 | Web 端组件错位、不可点击或样式完全丢失 |
| iOS 渲染 | 同上 5 个组件在 iOS 模拟器视觉与交互正常 | 模拟器崩溃或组件不渲染 |

#### 分支 A — Spike 全部通过：全面切 Uniwind

执行步骤：
1. `apps/mobile/package.json`：移除 `nativewind` `tailwindcss@^3`，加 `uniwind` `tailwindcss@^4`
2. `apps/mobile/metro.config.js`：`withNativeWind` → `withUniwindConfig`
3. `apps/mobile/tailwind.config.js`：删除（v4 改用 `@theme` 指令）
4. `apps/mobile/global.css`：按官方文档改 v4 + Uniwind 语法
5. `packages/ui/primitives/`：建立 `re-export heroui-native` 的薄封装，业务代码只 import `@arc/ui`
6. `packages/ui/tokens/semantic.ts`：用 CSS 变量声明，Web/RN 单一真相源
7. **移除** `heroui-native-pro` 依赖（直至 GA）；保留 Pro license
8. 同步更新 CLAUDE.md §四的「样式」与「UI 组件」行
9. 修订 ADR 001 §样式 章节，注明被本 ADR 取代

#### 分支 B — Spike Web 端不通过：分平台实现

执行步骤：
1. `packages/ui/primitives/` 改为 `Platform.OS` 分发：
   - Web 走 `@heroui-pro/react`（Tailwind v4 标准）
   - RN 走 NativeWind v4 + 自建组件
2. `packages/ui/tokens/` 设计为单一真相源（CSS 变量 + 双端 Tailwind theme `import` 同一份）
3. ADR 001 §样式 改为「跨端 UI 实现分平台，业务逻辑层统一」
4. 在本 ADR 追加「退出条件」：当 `heroui-native-pro` GA 且经实测 Web 兼容时，重新评估合并

---

## 后果

### 共同后果（无论分支 A 或 B）
- ✅ 解决 ADR 001 中"NativeWind + HeroUI"不兼容的内在矛盾
- ✅ 保留 Pro 许可证价值，未来可升级
- ⚠️ NumberField / DateRangePicker 在 MVP 阶段需自建简化版（约 1-2 周工时）

### 分支 A 特有后果
- ✅ 真正的"一套代码三端跑"，符合 ADR 001 第 3 条核心约束
- ✅ Tailwind v4 提前到位，未来跟随主流生态
- ⚠️ 绑定 HeroUI 生态（Uniwind 维护方单一），需在 ADR 011（待写）中记录退出策略
- ⚠️ Tailwind v4 在 RN 生态尚新，可能遇到 Uniwind 自身 bug

### 分支 B 特有后果
- ⚠️ ADR 001「一套代码出 Web」在 UI 层降级为「分平台实现」
- ⚠️ Tokens 一致性靠工程纪律，视觉一致性需人工对齐
- ⚠️ `packages/ui/primitives/` 维护成本翻倍

---

## Spike 执行记录

执行环境：macOS arm64，Node v22.22.1，pnpm 10.33.0。仓库分支 `feat/adr-002-ui-library`，spike 目录 `tools/spike-heroui-native/`（独立于 pnpm workspace，不影响主 lockfile）。

| 验收项 | 实测结果 | 结论 |
|:---|:---|:---:|
| 依赖解析 | `pnpm install --ignore-workspace` 成功，642 包安装完成。**1 处 peer dep 警告**：`react-native-reanimated@4.3.0` 期望 `react-native-worklets@0.8.x`，HeroUI 文档锁定 `0.5.1` → 安装到了 `0.5.2`。运行时未触发问题，但需在主仓库中显式 pin reanimated 至 4.1.x | ✅ 通过（带前置） |
| Metro 构建 | `withUniwindConfig` 加载成功，无 bundler 错误。`expo-router` 静态渲染模式与本 spike 不兼容（spike 不用 router），改 `app.json` 的 `web.output: "single"` 后通过 | ✅ 通过 |
| Web 构建 | `expo export --platform web` 成功。产物：CSS 45.5 kB（含 tailwindcss v4.2.1 + HeroUI 颜色 token），JS 2.49 MB（含 HeroUINativeProvider / Uniwind 运行时 / react-native-web / reanimated / gesture-handler / worklets 全部 shim） | ✅ 通过 |
| Web 渲染 | Headless Chrome（puppeteer 24.42）加载 `dist/index.html`：**0 个运行时错误**、**0 个失败请求**。React 树挂载（root 1985 字符 HTML）。Button / Card / Switch / Ghost Button 全部渲染并应用样式（蓝色按钮 + 深色 Card + Switch 关态白把手）。截图：`tools/spike-heroui-native/spike-render.png` | ✅ 通过 |
| iOS 渲染 | **未在本次 spike 中测试**（需要 Xcode 模拟器，本次为 headless 验证）。Bundle 包含 reanimated/gesture-handler/SVG 全部原生依赖；后续在主仓库迁移完成后用 `pnpm --filter @arc/mobile ios` 二次确认 | ⚠️ 待主仓库迁移后再验 |

### 已识别的非阻塞问题（迁移时需处理）
1. **颜色解析警告** `[colorKit.RGB] An error occurred ... default color "black" will be used` —— Switch 内部颜色计算边界情况；不影响功能但日志噪声，需在 issue tracker 记录
2. **404 资源请求** —— 推测是某字体或图片资源未 export；后续在主仓库实测可定位
3. **裸 RN `<Text>` 在深色 Card 上对比度不足** —— 需在 `packages/ui/primitives/` 提供受 HeroUI 主题感知的 `Text` 封装，禁止业务直接 import `react-native` 的 Text
4. **reanimated peer 版本** —— 在主仓库 `apps/mobile/package.json` 显式 pin `react-native-reanimated@~4.1.1` 与 `react-native-worklets@~0.5.1` 以匹配 HeroUI 锁定值，加 ESLint 拦或 `pnpm overrides`

### 与 ADR 决策对应
所有 5 项验收中 4 项明确通过，第 5 项（iOS 渲染）延迟到主仓库迁移后验证。**满足分支 A 的执行前提，本 ADR 状态切为「已接受（分支 A）」**。

iOS 验收在主仓库迁移完成后立即执行，若失败则回退至本 ADR 描述的分支 B 方案，并将本 ADR 状态修订为「已接受（分支 B）」。

**最终选择分支**：**A — 全面切 Uniwind + heroui-native OSS**
