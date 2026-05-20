# Cursor 启动 prompt — Stage 3 Block B：Multi-portfolio + cross-portfolio cash transfer

> 复制下方代码块到 Cursor Composer / Chat。该 prompt 不指定模型 —— Cursor auto 按 `CLAUDE.md §七 + §十二` 自评估路由（提示：commit #2 `validateTransfer` + property tests = Opus 主场；其余 #1, #3-12 = Sonnet 套路 CRUD/UI；如果 #6 `PortfolioSwitcher` HeroUI Pro dropdown 反复调样式不对 → §十二 升 Opus）。
>
> **前置依赖**：
>
> - Block A 已 merged 到 `dev/stage-3` (commits eee7997 → 2756fd9)
> - ADR 011 Accepted；AKShare wrapper Vercel prod 已部署
> - P1 fixes 已 Opus 修完 (`historical.py` 日期窗口 / 503-500 拆分 / fail-closed token)
> - Block B spec Accepted (10 决策；详见 `.specify/feature-specs/multi-portfolio-stage-3.md`)

---

````
接力 Arc Stage 3 Block B —— 多组合管理 + 跨组合现金转账 commit 链。

## 必读（按此顺序，不要跳）

1. `CLAUDE.md` — 项目铁律（§三 工程铁律 + §五 monorepo 结构 + §七 模型分工 + §十二 自我路由）
2. `.specify/constitution.md` — P0 约束（Decimal everywhere / Immutability of transactions / Adapter 抽象边界）
3. `.specify/session-state.md` — Stage 3 Block B 进度 + Active blockers
4. `.specify/feature-specs/multi-portfolio-stage-3.md` — **本任务的契约**（Status = Accepted，10 决策，12 commits）
5. `.specify/data-model-invariants.md` (如存在) — 5 大不变性法则（资产 ID / 单一来源真相 / Adapter / 币种 / 历史≠当下）

## 关键 Block B 决策摘要（spec §Resolved decisions）

| #  | 决策                                                                                          |
| :- | :-------------------------------------------------------------------------------------------- |
| 1  | 转账 = 两笔 transaction (SELL on source + BUY on dest)；数据模型零改动                         |
| 2  | 币种不自动换汇                                                                                 |
| 3  | 不允许做空现金（form validation 转出 ≤ 余额）                                                  |
| 4  | `notes` 字段标记：`transfer-out-to-{dest-id}` / `transfer-in-from-{source-id}`                |
| 5  | UI 落点 `/me/cash-balances` 加"转账到其他组合"按钮（不开新路由）                                |
| 6  | 软归档 + 已归档区**额外**支持永久删除（两步保护：先归档 → 输入 portfolio name 确认 → CASCADE） |
| 7  | **Insights Tab = 卡片仪表盘**（per-portfolio rebalance card × N + 跨组合占位卡 Stage 4 PRO）；PortfolioSwitcher 仅在 Portfolio Tab |
| 8  | `activePortfolioId` 持久化 = Zustand + MMKV；fallback chain on stale id                       |
| 9  | 转账余额校验 = modal open snapshot + submit-time server-side double-check                       |
| 10 | 跨币种目标 portfolio 缺 CASH:* 资产 = 自动 ensureAsset（idempotent upsert，migration 0009 RLS 已允许） |

## 模板（必读 + 必照搬模式）

- `packages/core/src/rebalance/index.ts` + `__tests__/rebalance.spec.ts` —— J9 rebalance pure-function + property test 范式（commit #2 `validateTransfer` 同模式）
- `packages/db/drizzle/migrations/0010_*.sql` —— migration SQL 格式（commit #1 写 0011）
- `apps/mobile/src/lib/queries/use-target-allocations.ts` —— TanStack hook + Supabase 写入 + invalidate 范式
- `apps/mobile/app/insights/rebalance/setup.tsx` —— modal route 范式（commit #5 `/me/portfolios/new` 同模式）
- `apps/mobile/app/me/cash-balances.tsx` —— form 范式 + 当前 `portfolios?.[0]?.id` 硬编码点（commit #9 必须改）

## 任务 — Block B spec § Implementation plan 12 commits

按顺序执行，每个 commit 独立 PR-able。每个 commit 末尾跑 `pnpm typecheck && pnpm lint && pnpm test`（全 6/6 + 绿）。

### commit #1 — `feat(db): portfolios.archived_at + migration 0011`

- 新建 `packages/db/drizzle/migrations/0011_portfolios_archived_at.sql`：
  ```sql
  ALTER TABLE "portfolios" ADD COLUMN "archived_at" timestamptz NULL;
  CREATE INDEX "portfolios_archived_at_idx" ON "portfolios" ("archived_at") WHERE "archived_at" IS NULL;
````

- 修改 `packages/db/src/schema/portfolios.ts` 加 `archivedAt`
- 修改 `packages/core/src/domain/types.ts` `Portfolio` interface 加 `archivedAt: string | null`
- 修改 `apps/mobile/src/lib/queries/use-portfolios.ts` `DBPortfolioRow` + `fromDB` 加 `archived_at` 映射
- **用户操作**：在 Supabase SQL Editor 执行 `0011_portfolios_archived_at.sql`（提交 commit 时在 message 标 "User must apply migration 0011 in dev Supabase"）

### commit #2 — `feat(core): TransferIntent + validateTransfer + buildTransferTransactions + property tests` 【**Opus 推荐 review**】

- 新建 `packages/core/src/portfolio/transfer.ts`：

  ```ts
  export interface TransferIntent {
    readonly sourcePortfolioId: string;
    readonly destPortfolioId: string;
    readonly assetId: `CASH:${Currency}`;
    readonly amount: Decimal;
  }

  export type TransferError =
    | { code: "amount_not_positive" }
    | { code: "amount_exceeds_balance"; balance: Decimal }
    | { code: "same_portfolio" }
    | { code: "non_cash_asset" };

  export const validateTransfer = (intent: TransferIntent, sourceBalance: Decimal): ReadonlyArray<TransferError> => { ... };

  export const buildTransferTransactions = (
    intent: TransferIntent,
    createdAtIso: string
  ): { source: NewTransaction; dest: NewTransaction } => { ... };
  ```

- `__tests__/transfer.spec.ts` + `__tests__/transfer.property.spec.ts` — **至少 5 个 property test** (fast-check)：
  - `validateTransfer` 空数组 ↔ amount > 0 ∧ amount ≤ balance ∧ source ≠ dest ∧ assetId.startsWith("CASH:")
  - `amount ≤ 0` → contains "amount_not_positive"
  - `amount > balance` → contains "amount_exceeds_balance"
  - source = dest → contains "same_portfolio"
  - assetId not CASH:\* → contains "non_cash_asset"
  - `buildTransferTransactions` invariants：source.shares.eq(dest.shares) / currencies match / createdAt 严格相同 / notes 互相引用对方 portfolioId

### commit #3 — `feat(mobile): active-portfolio Zustand store + MMKV persist`

- 新建 `apps/mobile/src/lib/store/active-portfolio.ts`（spec §Architecture sketch 已写）
- 新建 `apps/mobile/src/lib/queries/use-active-portfolio.ts` derived hook：
  - 命中且未归档 → 返回 portfolio
  - 指向归档/删除 → fallback `portfolios[0]` 且 `setActivePortfolioId(...)` + 清 MMKV key
  - portfolios 空 → null
- 加 `__tests__` 覆盖三 fallback 路径（mock useQuery + zustand store）

### commit #4 — `feat(mobile): portfolios CRUD hooks`

- 扩展 `use-portfolios.ts`：`useCreatePortfolio` / `useArchivePortfolio` / `useUnarchivePortfolio` / `useRenamePortfolio` / **`useHardDeletePortfolio`**（决策 6）
- 每个 mutation `onSuccess` invalidate `["portfolios"]`
- `useHardDeletePortfolio` 仅接受 `{ id, confirmName }`，server-side query 拿 portfolio.name 对比 confirmName，不匹配抛 Error（防止误删；client-side dialog 之外的二道闸门）

### commit #5 — `feat(mobile): /me/portfolios list + new portfolio modal + 已归档区 + HardDeleteConfirmDialog`

- 新建 `apps/mobile/app/me/portfolios/index.tsx`：active 列表 + 已归档折叠区 + 长按 actions
- 新建 `apps/mobile/app/me/portfolios/new.tsx`：modal route，name input + currency picker
- 新建 `packages/ui/src/finance/HardDeleteConfirmDialog.tsx`：text-input 确认（Github / Linear 同款）—— props `{ portfolioName, transactionCount, onConfirm }`，要求用户输入 portfolioName 完全匹配才解锁红色 destructive button
- 视觉：active = ● 实心；其他 = ○ 空心（spec UI contract 已绘）
- 已归档区默认折叠，展开后每行显示「恢复」+「永久删除」action

### commit #6 — `feat(ui+mobile): PortfolioSwitcher (Portfolio Tab only)`【决策 7】

- 新建 `apps/mobile/src/components/PortfolioSwitcher.tsx`（不在 `@arc/ui` —— 含业务 hooks）
- 单 portfolio 用户：显示 name 但不带 ▼（不可下拉）
- 多 portfolio：显示 ▼ + 当前 portfolio name；tap 弹下拉
- **只在 Portfolio Tab 头部 mount**（`apps/mobile/app/(tabs)/portfolio.tsx` 或对应 layout）
- Insights / Markets / Me Tab **不要** mount 这个组件
- 下拉末尾 "管理 portfolios →" links to `/me/portfolios`

### commit #7 — `feat(mobile): transfer sheet + useTransferBetweenPortfolios`【决策 1+10】

- 新建 `apps/mobile/src/lib/queries/use-transfer.ts`：
  1. submit 时 server-side query 拉最新 source CASH:\* 余额
  2. 调 `validateTransfer(intent, latestBalance)` —— 错误 throw
  3. 调 `buildTransferTransactions(intent, isoNow)`
  4. 如果 dest portfolio 没有该 CASH 资产 → 调 `ensureAsset({id: "CASH:{currency}", market: "CASH", ...})` （决策 10）
  5. `supabase.from("transactions").insert([source, dest])` 单批原子
  6. onSuccess invalidate `["cash-balances", sourceId]` + `["cash-balances", destId]` + portfolio holdings
- 新建 `packages/ui/src/finance/CashBalanceTransferSheet.tsx`（@gorhom/sheet wrapper 已在 Stage 2 提供）：dest portfolio picker + currency picker（限当前组合有余额的 CASH:\*）+ amount input + 不换汇提示
- 输入金额超过 modal-open snapshot 余额 → 灰按钮 + inline error（决策 9）

### commit #8 — `feat(mobile): /me/cash-balances "转账到其他组合" button`

- 修改 `apps/mobile/app/me/cash-balances.tsx`：底部 "保存" 按钮下方加 "转账到其他组合" 按钮 → tap 打开 `CashBalanceTransferSheet`（source = 当前 active portfolio）
- 注意：现 cash-balances.tsx 第 41 行 `const portfolioId = portfolios?.[0]?.id;` —— **本 commit 不要改这个**（commit #9 才改），先用现有 portfolioId 作为 source

### commit #9 — `feat(mobile): downstream hooks consume active portfolio`【关键 rewire】

- **grep `portfolios?.[0]?.id` 全删** —— 替换为 `useActivePortfolio()`：
  - `apps/mobile/app/me/cash-balances.tsx` 第 41 行（commit #8 引入的入口）
  - 任何 `useCashBalances(portfolios?.[0]?.id)` `usePortfolioHoldings(...)` 等调用点
- `/insights/rebalance/setup` 和 `/insights/rebalance/actions` 路由：accept `?portfolioId=` query 参数（与 active 解耦；为 commit #10 的 Insights 卡片 tap 跳转准备）
- **Opus review 推荐** —— 这是跨多个文件的 rewire；Opus 把关避免漏点

### commit #10 — `feat(ui+mobile): PortfolioInsightCard + InsightsTabContent dashboard`【决策 7】

- 新建 `apps/mobile/src/lib/queries/use-portfolio-insights.ts`：per-portfolio summary，返回 `{ portfolio, totalValue, todayChangePercent, allocationDonut, deviationPercent, rebalanceCount }`
- 新建 `packages/ui/src/finance/PortfolioInsightCard.tsx`：spec UI contract 已绘
  - 复用 `@arc/ui/finance/AllocationDonut`（如 Block C 还没建好，先用 J9 `DeviationDonut` 平替，后续 Block C 替）
  - "查看" CTA → router.push(`/insights/rebalance/setup?portfolioId=${portfolio.id}`)
  - "未设目标配置"分支：CTA → 同路由但跳到 setup 步骤
- 重写 `apps/mobile/app/(tabs)/insights.tsx`：
  - 移除原 active portfolio context（移到 portfolio detail card 内）
  - 渲染 `<ScrollView>` + `usePortfolios()` × `<PortfolioInsightCard>` × N
  - 末尾 "跨组合再平衡 [Stage 4+ PRO]" 占位卡（chip 样式参考 ADR 003 Business token）

### commit #11 — `feat(seed): 3 portfolio scenarios + DEV panel`

- `tools/seed-dev-data.ts` + `supabase/functions/_shared/seed-core.ts` 增加：
  - `portfolios:single` — 单 portfolio（清理多余）
  - `portfolios:multi-3` — 3 个 portfolio (My Portfolio CNY / 加密钱包 USD / 401k USD)；每个有 ≥2 笔 transactions + CASH:\* 余额
  - `portfolios:transfer-history` — multi-3 基础上 + 1 笔历史转账 pair（用 notes pattern 验证 UI 显示）
- DEV 面板二级菜单 "功能 → 场景" 挂载 portfolios feature group

### commit #12 — `docs(spec+session-state): mark Block B Accepted + bump`

- Block B spec status：已经 Accepted，不需要再改
- `session-state.md` Block B progress 表全部 ✅；next = Block C `holdings-table-stage-3.md`（Opus 起草）

## 路线图边界（不要超出本 Block B 范围）

- **不要**改 `transactions` schema —— spec §决策 1 数据模型零改动
- **不要**实施跨币种自动换汇 —— spec §决策 2
- **不要**实施跨组合再平衡 —— Stage 4 PRO，本 Block 仅放占位卡
- **不要**改 `transfer_group_id` 外键 —— spec out of scope，notes pattern 够用
- **不要**做 portfolio 排序 drag —— out of scope
- **不要**碰 Block A adapters / withFallback / akshare wrapper
- **不要**实施 holdings table / asset detail / charts —— Block C

## 路由自评估（每个 commit 边界做一次，按 §十二）

- commit #1 (migration + schema) → Sonnet 套路 CRUD
- commit #2 (`validateTransfer` + property tests) → **Opus 推荐**，property test invariants + Decimal 边界
- commit #3 (Zustand + MMKV) → Sonnet 套路
- commit #4 (CRUD hooks) → Sonnet 套路
- commit #5 (`/me/portfolios` UI + HardDeleteConfirmDialog) → Sonnet UI；如果 HeroUI Pro dialog 复合调样式反复对不齐 → §十二 升 Opus
- commit #6 (PortfolioSwitcher) → Sonnet UI；如 HeroUI Pro dropdown 在 Portfolio Tab 内 z-index / safe-area 冲突反复改不对 → 升 Opus
- commit #7 (transfer hook + sheet) → Sonnet 但 mutation race + ensureAsset 拼接逻辑容易错；如反复改 → 升 Opus
- commit #8 (cash-balances button) → Sonnet 小修
- commit #9 (downstream rewire) → **Opus review 推荐**，跨文件全 grep；漏点会让多 portfolio 错算
- commit #10 (Insights restructure) → Sonnet；AllocationDonut 替换可暂用 J9 `DeviationDonut` 平替
- commit #11 (seed) → Haiku 套路
- commit #12 (docs) → Haiku 小改

## Hand-off 回 Opus 的触发点

- 每完成 1 个 commit 推到 `dev/stage-3` 后 ping Opus review（用户负责切回 Opus 会话）
- commit #2 完成后 Opus review property tests 是否覆盖所有 invariant
- commit #9 完成后 Opus review `portfolios?.[0]?.id` 是否真的全删完（grep verify）
- 任何遇到 spec 没写到的 edge case（e.g. 永久删除 confirm dialog 输入框 IME 拼音输入兼容、Insights 卡片在单 portfolio 时是否还显示 "跨组合占位卡"）→ 先抛 Cursor chat 给用户 + Opus 决定

## DoD（本 Block B 结束 = 用户可以管理多 portfolio + 跨组合现金转账）

- commit #1-12 全部 merged 进 `dev/stage-3`
- Migration 0011 用户已在 dev Supabase 跑通
- UAT pass：
  - 创建 3 portfolios → 切换 active → 杀进程重启验证持久化 ✅
  - 跨组合 USD 转账（决策 2 不换汇）+ 不允许做空（决策 3）+ ensureAsset 自动（决策 10）✅
  - 归档 + 恢复 + 永久删除（决策 6 两步保护）✅
  - Insights Tab 卡片仪表盘 ✅（per-portfolio rebalance + 占位卡）
- `pnpm typecheck` 6/6 ✅ / `pnpm lint` 6/6 ✅ / `pnpm test` ✅（含 5+ property tests on transfer）
- `session-state.md` Block B 表格全部 ✅
- 下一站 = Block C `holdings-table-stage-3.md` Opus 起草

## 当前已知 Active blockers

- Migration 0011 用户需在 Supabase SQL Editor 执行（commit #1 之后）
- AKShare wrapper Vercel prod 已部署（P1 fixes 已 Opus 修 + 用户 redeploy 完成；不阻塞 Block B）

开始吧。先验证当前 working tree 干净 (`git status`)，再起 commit #1 (migration 0011) 的实施计划让我（用户）拍板再写代码。

````

---

## 用户使用说明

1. **打开 Cursor**，新建 Composer 或 Chat 会话
2. **粘贴上面 ` ``` ` 框内的全部内容**
3. Cursor 第一步会输出 commit #1 实施计划 → 你拍板 → Cursor 写代码 → 你在 Supabase SQL Editor 跑 migration 0011
4. 每个 commit 推完，切回 Claude Code（本会话）让 Opus review
5. commit #2 (property tests) 推完后**强烈建议** Opus review；commit #9 (downstream rewire) 同样

## 三人分工速查（Block B）

| 角色            | 当前任务                                                                                                |
| :-------------- | :------------------------------------------------------------------------------------------------------ |
| **你 (BoyangJiao)** | (1) Supabase SQL Editor 跑 migration 0011（commit #1 后）；(2) 每个 commit UAT smoke；(3) 决定 commit #2 / #9 是否切 Opus review |
| **Cursor (Sonnet)** | commit #1 → #3-8 → #10-12 顺序实施                                                                       |
| **Claude (Opus, 本会话)** | (1) commit #2 property tests review；(2) commit #9 downstream rewire review；(3) Block C `holdings-table-stage-3.md` 待 Block B 收尾后起草 |
````
