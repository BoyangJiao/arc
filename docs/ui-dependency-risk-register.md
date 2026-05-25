# UI 依赖风险登记册（Stage 4 前）

> **状态**：Living doc — Block C UAT 后起草，Stage 4 上架 checklist 引用。  
> **关联**：ADR 006（`@arc/ui` 接口层）、Stage 3 roadmap §决策 6（HeroUI Pro charts）、`.specify/feature-specs/stage-3/holdings-and-transactions-stage-3.md`

---

## 1. 结论摘要

| 问题                       | 答案                                                                                                                                   |
| :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| HeroUI Native Pro 是什么？ | **主题化复合组件层**，底层叠 `heroui-native` OSS、`victory-native`、`@shopify/react-native-skia`、`react-native-reanimated`、`uniwind` |
| Arc 是否被锁死？           | **否** — 业务只 import `@arc/ui`；实现可渐进替换（ADR 006 决策八）                                                                     |
| 上线前要不要整库复刻？     | **不建议** — 兼职维护成本不可承受；pin 版本 + UAT + 接口隔离足够                                                                       |
| 最大真实风险               | Peer dep 漏装（`victory-native` 已踩坑）、Pro **beta** API 变动、Expo/RN 大版本升级连带回归                                            |

---

## 2. 依赖栈（Chart 为例）

> **所有权分层**：见 [ADR 013](adr/013-ui-wrapper-ownership-and-vendor-swap.md) — L3 API / L2 Arc polish / L1 vendor primitive。

```
apps/mobile
  └── @arc/ui/charts/AreaChart|LineChart     ← L3 Arc 接口
        ├── ChartAreaGradient / ChartPressOverlay / chart-series   ← L2 Arc 自有
        └── heroui-native-pro/area-chart     ← L1 可替换 vendor 挂载
              └── victory-native + skia
```

**Arc 已自建、不依赖 HeroUI 的产品层**：`finance/`（HoldingsTable、AllocationDonut、PriceCell…）、`navigation/`（FloatingTabBar、InScreenHeader）、`tokens/`。

---

## 3. 组件清单与替换成本

### 3.1 HeroUI Native Pro（`primitives-pro/` + `charts/`）

| 组件                                     | 用途                        | 底层                    | Pin 版本       | 替换触发                                   | 替换成本                                            |
| :--------------------------------------- | :-------------------------- | :---------------------- | :------------- | :----------------------------------------- | :-------------------------------------------------- |
| `line-chart` / `area-chart`              | 资产详情 / 组合净值         | victory-native + skia   | `1.0.0-beta.3` | beta breaking / 误导性曲线 / press UX 不够 | **中** — 可直接 wrap victory-native 跳过 Pro 中间层 |
| `chart-crosshair` / `chart-indicator`    | 按压锚点                    | skia                    | 同上           | 同上                                       | **低**（随 chart 一起换）                           |
| `number-field` / `number-stepper`        | tx 录入                     | heroui-native           | 同上           | 表单 bug 不可控                            | **高**                                              |
| `date-picker` 等                         | Stage 2+ CSV / tx back-date | @internationalized/date | 未全面启用     | Stage 4 前按需                             | **高**                                              |
| `trend-chip` / `empty-state` / `segment` | 详情 / 空态                 | heroui-native           | 同上           | 样式不满足                                 | **低–中**                                           |

### 3.2 HeroUI Native OSS（`primitives/`）

| 组件                                | Pin      | 替换策略                              |
| :---------------------------------- | :------- | :------------------------------------ |
| Button / Card / TextField / Dialog… | `^1.0.3` | MIT — 可按 ADR 006 **copy-in** 单组件 |

### 3.3 第三方 wrappers（`wrappers/`）

| 包                     | 用途       | 替换成本      |
| :--------------------- | :--------- | :------------ |
| `lucide-react-native`  | 图标       | 低            |
| `@gorhom/bottom-sheet` | 复杂 sheet | 中            |
| `@dicebear/core`       | 头像       | 低（ADR 004） |

### 3.4 Chart 必需 peer deps（`apps/mobile` 必须安装）

| 包                           | 用途      | 漏装后果                                               |
| :--------------------------- | :-------- | :----------------------------------------------------- |
| `victory-native`             | 图表引擎  | **运行时白屏**（`Element type is invalid: undefined`） |
| `@shopify/react-native-skia` | Skia 画布 | 同上                                                   |

`@arc/ui/charts/ensure-chart-peers.ts` 显式 import 以防 Metro monorepo 漏打包。

---

## 4. Pin 与升级策略（Stage 4 前执行）

1. **Lockfile 纪律**：凡 `apps/mobile/package.json` 声明的 chart peer dep 必须出现在 `pnpm-lock.yaml`；CI 可加 `pnpm why victory-native` smoke。
2. **Pro 版本 pin**：`heroui-native-pro@1.0.0-beta.3` 无安全补丁前 **不主动升 minor**；升级需跑 S3-AC-C.3 / C.9 chart UAT。
3. **Expo SDK 升级**：视为 **全链回归**（Skia + Reanimated + victory-native + HeroUI）；预留 1–2 天 UAT。
4. **Metro subpath 纪律**：禁止 `import from 'heroui-native-pro'` 顶层（会贪婪解析 skia 导致 bundle 失败）— 仅 `@arc/ui` 内 subpath。

---

## 5. 渐进替换路线图（非上线 blocker）

按 ADR 006 决策八 **OR 触发** copy-in / 替换：

| 优先级 | 组件                       | 触发条件                                       | 推荐路径                                    |
| :----- | :------------------------- | :--------------------------------------------- | :------------------------------------------ |
| P1     | Chart wrapper              | Pro beta 两次 breaking / press UX 需求超出 Pro | `@arc/ui/charts` 直接 wrap `victory-native` |
| P2     | OSS Button/Card            | 定制超出 props                                 | MIT copy-in 到 `primitives/`                |
| P3     | Pro DatePicker/NumberField | license 或商务变更                             | 续费 + pin，或 Stage 5 自研                 |
| —      | 整库 fork HeroUI           | **不触发**                                     | 维护成本 > 收益                             |

**不需要**「复刻 HeroUI 引用的每一层」— 即使自建 chart，Skia + Reanimated 仍会是 RN 生态标准选型。

---

## 6. Stage 4 上架 checklist（UI 部分）

- [ ] `pnpm why victory-native @shopify/react-native-skia` 在 mobile 侧均 resolved
- [ ] S3-AC-C.2 / C.3 / C.9 chart UAT 全绿（含 range 切换 skeleton、press crosshair）
- [ ] HeroUI Pro license 确认：同主体内部使用、无二次商业分发（ADR 006 决策八）
- [ ] Expo SDK pin 记录 + 升级 runbook（本 doc §4）
- [ ] 可选：Stage 4 末与 HeroUI 商务确认 Pro OEM（若未来有外部分发计划）

---

## 7. 变更记录

| 日期       | 变更                                                               |
| :--------- | :----------------------------------------------------------------- |
| 2026-05-21 | 初稿 — Block C UAT chart 修复会话；含 victory-native 漏装 incident |
