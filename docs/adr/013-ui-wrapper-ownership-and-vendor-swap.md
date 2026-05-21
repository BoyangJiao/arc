# ADR 013 — UI Wrapper 所有权与 Vendor 可替换策略

- **状态**: 已接受
- **日期**: 2026-05-21
- **作者**: BoyangJiao + Cursor
- **相关 ADR**: 006（`@arc/ui` 分层）、008（Token 纪律）、011（多源 fallback 模式）
- **关联文档**: `docs/ui-dependency-risk-register.md`
- **触发**: Block C UAT — Portfolio Tab 需在 HeroUI Pro `area-chart` 之上做渐变 / scrubber / 涨跌色等定制；需明确「哪些是 Arc 资产、换 vendor 后什么保留」，并推广到未来更多组件。

---

## 背景

ADR 006 已规定 `@arc/ui` 是**接口层**、业务代码不得直接 import vendor。Stage 3 起 chart、finance 组件出现大量「在第三方 primitive 上叠产品逻辑」的需求：

- Chart：渐变 fill、scrubber、period 涨跌色、数据预处理
- Finance：`PortfolioHeroSection`、mover chips、PnL 着色
- 未来：表单 autofill、复杂 sheet、自定义 animation

若把视觉与交互逻辑写进 `apps/mobile` 或绑死在 HeroUI Pro API 上，换库 / 升级时成本会落在业务层。需要一套**可重复**的纪律，与 ADR 011「adapter 层抽象外部 API」同构，但面向 UI。

---

## 决策

### 决策一：三层所有权模型（Arc Interface → Arc Polish → Vendor Primitive）

每个对外暴露的 `@arc/ui` 组件按职责拆三层：

```
┌─────────────────────────────────────────────────────────┐
│  L3 — Arc Public API（稳定契约）                          │
│  props 类型、行为语义、a11y、i18n 边界                     │
│  例：AreaChartProps, PortfolioHeroSectionProps            │
├─────────────────────────────────────────────────────────┤
│  L2 — Arc Polish（自有资产，vendor 无关）                  │
│  渐变、scrubber、涨跌色、数据 transform、布局组合           │
│  例：ChartAreaGradient, ChartPressOverlay, chart-series   │
├─────────────────────────────────────────────────────────┤
│  L1 — Vendor Primitive（可整块替换）                      │
│  最薄挂载：CartesianChart / Area / Line / Segment         │
│  例：heroui-native-pro/area-chart（~60–100 行 wrapper）    │
└─────────────────────────────────────────────────────────┘
```

**铁律**：

1. **L2 不得 import `apps/**`\*\*；不得依赖业务 domain 类型（用 duck-type 或 props 注入）。
2. **L1 不得泄漏到 `apps/**`** — ESLint `no-restricted-imports` 已有守护。
3. **换 L1 vendor 时，L3 API + L2 逻辑原样保留**；仅重写 L1 挂载文件。

### 决策二：新定制默认落在 `@arc/ui` 对应层，而非业务页

| 定制类型                 | 归位                                         | 禁止                    |
| :----------------------- | :------------------------------------------- | :---------------------- |
| 颜色 / 间距 / typography | `tokens/` + Tailwind className               | 业务页硬编码 hex        |
| 单组件视觉增强           | 该组件所在层 `charts/` / `finance/`          | `apps/mobile` 内联 Skia |
| 跨组件布局组合           | `finance/` 或 `navigation/` 组合组件         | 页面 200 行 JSX 拼装    |
| 第三方包薄封装           | `wrappers/`                                  | 业务直接 import         |
| Vendor compound 挂载     | `charts/` 或 `primitives-pro/` 内 **单文件** | 多处散落 Pro import     |

**Portfolio Tab 范例（本 ADR 首批落地）**：

| 文件                                      | 层      |
| :---------------------------------------- | :------ |
| `charts/AreaChart.tsx`                    | L3 API  |
| `charts/ChartAreaGradient.tsx`            | L2      |
| `charts/ChartPressOverlay.tsx`            | L2      |
| `charts/use-chart-period-stroke-color.ts` | L2      |
| `finance/PortfolioHeroSection.tsx`        | L3 组合 |
| `finance/DailyMoverChips.tsx`             | L2/L3   |

### 决策三：Vendor 替换触发条件与流程

与 `docs/ui-dependency-risk-register.md` §5 对齐：

1. **不 proactively 换库** — pin + UAT 优先。
2. **触发替换**（任一）：beta breaking、license 风险、Expo/RN 不兼容、Pro 能力长期缺失。
3. **替换步骤**：
   - 新建或重写 **L1 挂载**（如 `AreaChart.vendor-victory.tsx` 或直接改 wrapper body）
   - L2/L3 **零改动**；跑 chart UAT（S3-AC-C.3 / C.9）
   - 更新 risk register 一行
4. **禁止**：在 `apps/mobile` 加 `if (USE_COINBASE_CHART)` 类短路（同 ADR 007 精神）。

### 决策四：与 ADR 011「Adapter 模式」的对应关系

| 领域       | 接口                   | 实现可换                                    | Arc 自有逻辑               |
| :--------- | :--------------------- | :------------------------------------------ | :------------------------- |
| 行情 / FX  | `PriceAdapter`         | Finnhub / AV / Tushare                      | cache、fallback、normalize |
| UI Chart   | `AreaChart` props      | HeroUI Pro / victory-native 直连 / 未来 CDS | gradient、scrubber、series |
| UI Finance | `PortfolioHeroSection` | 内部 chart 实现                             | 布局、delta 着色、chips    |

同一原则：**业务只见接口，差异在 adapter/wrapper 内消化**。

### 决策五：何时写 mini-ADR vs 直接按本 ADR 执行

| 情况                                      | 动作                            |
| :---------------------------------------- | :------------------------------ |
| 在现有 `@arc/ui` 组件上加 L2 polish       | **本 ADR 足够**，直接 PR        |
| 新引入整包 vendor（如 Coinbase CDS 全栈） | **新 ADR** + risk register      |
| 修改 L3 public props（breaking）          | feature spec + 本 ADR 引用      |
| copy-in HeroUI OSS 单组件                 | ADR 006 FAQ Q3 — 按需 mini-spec |

---

## 后果

### 正面

- Chart / finance 定制沉淀为 Arc 资产，换 HeroUI Pro 不丢 UX
- 新贡献者有 checklist，避免 polish 散落在 `apps/`
- 与 data-sources adapter 模式一致，降低认知负担

### 负面

- `charts/` 文件数增加（gradient、colors、overlay 等）
- L1/L2 边界偶发模糊 — 用「是否能在 mock 环境单测且不 mount Pro」粗判：L2 应可

### 风险

- L2 误用 Pro 专有 hook — 缓解：L2 只用 Skia / Reanimated / tokens / 纯函数
- 组合组件膨胀 — 缓解：页面级组合进 `finance/*Section.tsx`，单文件 >150 行再拆

---

## 实施清单（Block C — 已落地 / 跟进）

- [x] `ChartAreaGradient` + `colorWithOpacity` — Arc L2
- [x] `AreaChart` 渐变 + stroke line + scrubber — L3
- [x] `PortfolioHeroSection` — Portfolio Tab hero，无 Card
- [x] `DailyMoverChips` — 共享 mover chips
- [x] `PortfolioValueOverTimeCard` — `@deprecated`
- [x] `docs/ui-dependency-risk-register.md` — 引用 ADR 013
- [ ] Stage 4：ESLint 可选规则 — 禁止 `apps/**` import `@shopify/react-native-skia`

---

## Checklist（新组件 / 新定制 — PR 自检）

1. 业务是否只 `import from '@arc/ui'`？
2. 视觉 / 交互逻辑是否在 L2，而非 page？
3. Vendor import 是否收敛在 **一个** wrapper 文件？
4. Public props 是否不暴露 vendor 类型（如 `PointsArray`）？
5. 换 vendor 时能否只改 L1 并通过现有 UAT？
6. 金融色是否走 `useBusinessTokens` / `useChartPeriodStrokeColor`？
7. 文案是否走 `@arc/i18n`（组合组件接收已翻译 string）？

---

## FAQ

**Q1: LineChart 是否同样适用？**  
是。`useChartPeriodStrokeColor`、`ChartPressOverlay` 已是共享 L2；Line 与 Area 的 L1 挂载独立但纪律相同。

**Q2: 能否在 L2 直接用 `@shopify/react-native-skia`？**  
可以。Skia 是渲染原语，地位类似 `react-native-svg`，比 HeroUI Pro 更稳定；gradient 放 L2 正确。

**Q3: Coinbase CDS 还要接吗？**  
否（Stage 3）。若 Stage 4+ 评估，走决策五「新 ADR」；L2 逻辑可复用到 CDS L1 若 API 允许。

---

## 关联文档更新

- `docs/ui-dependency-risk-register.md` — §2 栈图注明 ADR 013 L2 层
- `CLAUDE.md` §五 — charts/ 行补充「Arc L2 polish + vendor L1」
