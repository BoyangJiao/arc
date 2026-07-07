# Feature: Block E — 上架前体验 polish（P1：脱敏收口 + Inbox 空态 + 体验闭环）— Stage 3

- **Status**: Code complete (P1 + P2) — Opus 4.8 (2026-05-31). P1: 份额脱敏收口 + /me/inbox 空态 + 三态审计（全合规，无需改码）+ formatShares 单测 6 个. P2: /ai 占位页（Insights header Sparkle 入口）+ /me/subscription 三档占位（Free/Pro/Pro+，无定价、无支付）. typecheck 6/6 · test 58(mobile)+全绿 · lint 0err · lint:copy clean. Awaiting BoyangJiao UAT.
- **Author**: Claude Opus 4.8 (draft)
- **Created**: 2026-05-31
- **Implements**: `stage-3-roadmap.md` §三 Block E（前 3 项 P1）；roadmap §七 tactical decision 4（Inbox 先做空态）
- **Conforms to**: `.specify/constitution.md`（禁忌文案 + Decimal）、[ADR 003 §决策六](../../../docs/adr/003-design-tokens.md)（数字脱敏 = 组件/内容层、不新增 token、颜色不变）、[ADR 008](../../../docs/adr/008-token-discipline-and-polish.md)（accent 纪律）
- **Depends on**: Block C（持仓表 / Hero / Asset 详情 / Insights 卡）✅、Block D（盈亏数字）✅ —— 均已落地
- **Touches**:
  - `apps/mobile/app/me/inbox.tsx`（**新增**，空态）+ `me/index.tsx`（入口）
  - 脱敏覆盖收口：`HoldingRow`（份额/数量）+ 其余金额展示点的 grep 审计
  - `@arc/i18n`（en + zh）— `inbox.*`（+ 视收口需要的少量键）
  - 体验闭环：empty / loading / error 三态审计（复用 `EmptyState`）
  - **不动**：`user-preferences.tsx`（`redacted` 字段已存在）、`formatMoneyMasked`/`AMOUNT_REDACTION_MASK`（已存在）、Hero 眼睛切换（已存在）

---

## ⚠️ 现状盘点（verified 2026-05-31 — 颠覆 roadmap 初始假设）

Block E 在 roadmap 里被描述为"待建"，但实测代码后发现 **3 个 P1 子项里，脱敏已基本完成**。本 spec 据实把 Block E 收敛为「**收口 + 补缺口**」，而非「从零搭建」。

| 子项           | 真实现状                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 缺口                                                                                                                                     |
| :------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| **数据脱敏**   | ✅ **基建+接入均已完成**：`AMOUNT_REDACTION_MASK="••••"` + `formatMoneyMasked(value,hidden,opts)`（`format-money.ts`）+ `useAmountRedacted()`（`use-amount-redacted.ts`，**backed by Supabase `user_preferences.redacted`，跨冷启动持久化**）。**Hero `PortfolioHeroSection` 头部已有 Eye/EyeSlash 一键切换**（`amountsHidden` + `onToggleAmountVisibility`，`(tabs)/index.tsx:236/259`）。**~13 屏已消费**：Hero / asset 详情 / pnl-analysis / markets / daily-snapshot / portfolio index / cash-balances / rebalance actions / PortfolioInsightCardLoader / CashBalanceTransferDialog … | ① **份额/数量未脱敏**（用户决策：份额×已知净值可反推 → 须脱敏）；② 需 grep 全量审计有无漏屏；③ Settings **无**开关（见决策 1：保持不加） |
| **Inbox 空态** | ❌ 无任何代码                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 全新 `/me/inbox` 路由 + 空态 + Me 入口 + i18n（roadmap §七 决策 4：先空态、不建表、不接数据源）                                          |
| **体验闭环**   | ⚠️ `EmptyState` 已多处用，各 journey 各自有载入/错误处理                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 不统一，需审计收口                                                                                                                       |

---

## 决策（待 BoyangJiao confirm）

**决策 1 — 单一控制点：Hero 眼睛图标（不加 Settings 开关）** ✅ 用户已倾向
脱敏状态是**全局** `user_preferences.redacted`（已 Supabase 持久化）。Hero 眼睛已切换该全局 pref。再在 Settings 加一个 Switch = **重复控制同一状态**（两个入口、一份状态），无新增价值。结论：**保持 Hero 眼睛为唯一入口**，不加 Settings 开关。

> 用户原话核对：「有 hero 的眼睛好像就可以了，除非 setting 中的脱敏和 hero 的脱敏控制的内容不太一样」。实测：二者本就是同一份全局 `redacted`，控制内容**完全一致** → 故不需要 Settings 镜像开关。

**决策 2 — 份额/数量纳入脱敏范围** ✅ 用户已确认
脱敏时，金额 + 持仓份额/数量均 → `••••`；**涨跌百分比与颜色保持可见**（ADR 003 §决策六：颜色不变；脱敏只藏绝对数值，不藏收益率，符合"截图给人看仍能讨论收益率"）。复用既有 `formatMoneyMasked` 同款模式（份额用 `amountsHidden ? AMOUNT_REDACTION_MASK : formatShares(...)`），**不新增组件**（`<RedactedNumber>` 在 ADR 003 是示例命名，本仓既有实现走 formatter 而非组件；保持现状一致性，不引入第二套范式）。

**决策 3 — Inbox = `/me/inbox` 子页（非 tab、非 Hero 铃铛）**
roadmap §153「Me / Inbox 子页（Revolut 范式）」。P1 仅空态：图标 + 标题 + 副文案。**不建表、不写 migration、不接数据源**。`me/index.tsx` 加 ListGroup.Item 入口（与 Portfolios / Settings 同组）。空态副文案遵守宪法禁忌词。

**决策 4 — 体验闭环 = 审计收口，不重写**
抽查 ≥3 主 journey 的空/载/错三态，缺失处补 `EmptyState` / 错误文案 + 重试；不做大改。

---

## 体验闭环审计结论（2026-05-31，AC.5）

抽查 5 条主 journey，三态**已全部合规**，无白屏 / 无裸 spinner / 无不可读错误 → **本轮无需改码**：

| Screen        | loading                | empty                           | error                                             |
| :------------ | :--------------------- | :------------------------------ | :------------------------------------------------ |
| Portfolio Tab | `common.loading`       | `portfolio.noPortfolios` + CTA  | `valuationError`→`common.error` + 部分报价 banner |
| Markets       | `markets.quoteLoading` | `WatchlistEmptyState`           | `quoteBanner`（限流 / 部分失败文案）              |
| Insights      | `common.loading`       | `EmptyState`                    | query error → `[]` 默认值 → 落空态（不崩溃）      |
| Asset 详情    | `detail.isPending`     | `assetDetail.noHolding`         | chart error 标题/描述 + mutation Alert            |
| 盈亏分析      | `chartLoading`         | `chart.empty` / `ranking.empty` | （依赖 Portfolio 数据，复用上游）                 |

唯一可记的 follow-up（非阻塞，留 Stage 4 observability）：Insights/PnL 的上游 query error 当前以"落空态"兜底而非显式 error+retry。自用阶段可接受；上架前若要更显式错误反馈可加。

---

## User journeys

### J-E1 — 截图模式脱敏（收口）

**Given** 用户在 Portfolio Hero tap 眼睛图标（EyeSlash 状态）
**Then** 全 App 金额 **+ 持仓份额/数量** 显示 `••••`；涨跌百分比与颜色保持可见
**And** 重启 App 后状态保留（已 Supabase 持久化，免验证基建，仅验证份额收口）

### J-E2 — Inbox 空态（新增）

**Given** 用户从 Me 页 tap「消息」
**Then** 进入 `/me/inbox` 空态（图标 + 「暂无消息」+ 副文案），无报错、可返回

### J-E3 — 体验闭环一致性（审计）

**Given** Portfolio / Insights / Asset 详情 等在「无数据 / 加载中 / 出错」三态
**Then** 均有明确 UI（不白屏、不裸转、错误可读 + 重试）

---

## Acceptance criteria（UAT）

| AC            | 测什么                                                                      |
| :------------ | :-------------------------------------------------------------------------- |
| **S3-AC-E.1** | Hero 眼睛切到隐藏 → 金额**与持仓份额/数量**全部 `••••`；百分比 + 颜色仍在   |
| **S3-AC-E.2** | grep 审计无漏屏：所有金额展示点要么走 `formatMoneyMasked`，要么显式标注豁免 |
| **S3-AC-E.3** | 眼睛切回 → 金额 + 份额恢复，无残留 `••••`                                   |
| **S3-AC-E.4** | `/me/inbox` 空态正常，从 Me 入口可达、可返回                                |
| **S3-AC-E.5** | 体验闭环抽查 ≥3 journey 三态无白屏/裸转/不可读错误                          |
| **S3-AC-E.6** | i18n 新键 en + zh 齐全；`pnpm lint:copy` 无禁忌词                           |

---

## Implementation plan（commit chain — 全程 Opus，用户已指定）

1. **`feat(ui,mobile): redact holding shares/quantities + coverage sweep`** — `HoldingRow` 份额/数量接 `amountsHidden`；grep 全量金额展示点核对漏屏（AC.1–E.3）；必要时给 `HoldingRow.test.tsx` 加 hidden 用例。
2. **`feat(mobile): /me/inbox route + empty state + entry`** — `app/me/inbox.tsx`（`EmptyState` + InScreenHeader back）；`me/index.tsx` 入口；i18n `inbox.*`（AC.4 / AC.6）。
3. **`polish(mobile): unify empty/loading/error states`** — 审计 ≥3 journey 三态收口（AC.5）。
4. **`docs(spec+session-state): Block E P1 complete`** — 本 spec → Accepted + session-state bump。

每 commit 末：`pnpm typecheck` 6/6 + `pnpm test` 全绿 + `pnpm lint`。不 push（沿用 Block C/D 节奏，UAT 后并入 PR #10 评估）。

---

## 显式 out of scope（本轮不做 — roadmap Block E 的 P2）

- ~~AI 入口占位页~~ → P2 已完成（commit 8d1b71c）
- ~~订阅档位占位页~~ → P2 已完成占位（commit 8d1b71c；计价策略仍待 Opus 讨论）
- 价格异动检测后台 job → 写 Inbox（需 Edge Function + migration + cron + 阈值算法；Inbox 空态是其前置容器）
- 脱敏高级触发（摇一摇 / 长按）— 现 Hero 眼睛已够

---

## Known risks / open questions

- **份额脱敏的格式化归属**：`HoldingRow` 份额当前如何格式化（组件内 vs presenter）需在 commit 1 落地时确认，就近接 `amountsHidden`，不外溢新 prop 污染。
- **覆盖审计基线**：以 `useAmountRedacted` 现有 ~13 消费点为白名单，grep `formatMoney(`（未走 Masked 版本的）找漏网点。
- 实测 `user-preferences.tsx` 行号显示存在重复编号（疑似展示瑕疵，非代码问题）—— commit 1 动 HoldingRow 时顺带肉眼复核该文件无真实重复定义。
