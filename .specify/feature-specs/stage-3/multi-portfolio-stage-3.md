# Feature: Multi-portfolio management + cross-portfolio cash transfer (Stage 3 — Block B)

- **Status**: Accepted — 5 inherited decisions (roadmap §决策 10–14) + 5 adapter-level locked 2026-05-20 (BoyangJiao approved A + hard-delete refinement / **B + card-per-portfolio Insights** / A / A / A)
- **Author**: Claude Opus 4.7 (draft) + BoyangJiao (review)
- **Created**: 2026-05-20
- **Implements**: `.specify/feature-specs/stage-3/stage-3-roadmap.md` §Block B；`docs/development-plan.md` §Stage 3 多组合管理
- **Conforms to**: `.specify/constitution.md` (Decimal everywhere, immutability of transactions, real-flow integrity), ADR 006 (`@arc/ui` layering), ADR 007 (dev seed SQL injection), Block A 路径（CN/HK/FUND adapters 已 live）
- **Touches**: `packages/db` (1 migration — `portfolios.archived_at`), `packages/core` (extend `Portfolio` type + add transfer compute helper), `apps/mobile` (active portfolio store + CRUD UI + switcher + transfer modal), seed data (3 new scenarios), i18n (~30 new strings)
- **Does NOT touch**: `transactions` schema, `assets` schema, RLS policies (CASCADE 已支持), Block A adapters, business compute（rebalance / daily-snapshot 已多 portfolio-aware）

---

## Why this feature exists

Stage 3 DoD（"自用 ≥ 4 周，所有真实持仓全录入"）依赖用户能把 A 股 / 港股 / 美股 / 加密 / 公募基金 分到不同 portfolio。`portfolios` 表 Stage 1 起就已支持多组合，但 mobile 端所有读路径写死 `portfolios?.[0]?.id`（[cash-balances.tsx:41](apps/mobile/app/me/cash-balances.tsx#L41)、`/portfolio/[id]/...` 路由直接用第一个）—— 不存在切换、CRUD、跨组合转账动作。

Roadmap §决策 10–14（2026-05-19 锁定）规定数据模型零改动 + 跨组合转账 = 两笔 transaction（SELL on source + BUY on dest，[transactions.notes](packages/db/src/schema/transactions.ts) 字段标记 transfer pair）。本 spec 把 5 个决策落地到 UI + state management + 验收链路。

---

## User journey (J10, condensed)

### J10a — 创建第二个 portfolio

**Given** 我已有默认 portfolio "My Portfolio"
**When** 进 `/me/portfolios` → tap "+ 新建组合"
**Then** 弹 modal 输入 name + reporting_currency → 确认
**And** 新 portfolio 出现在列表 + 顶栏 switcher 可选

### J10b — 切换 active portfolio

**Given** 我有 ≥ 2 个 portfolio
**When** tap 顶栏 switcher → 选 "加密钱包"
**Then** Portfolio Tab / Insights Tab / Markets Tab 全部刷新为该 portfolio 数据
**And** 切换状态持久化（杀进程重启后仍是 "加密钱包"）

### J10c — 重命名 / 归档

**When** `/me/portfolios` → 长按或 swipe → "重命名" / "归档"
**Then** 重命名 inline 修改 portfolio.name；归档把 portfolio 移出 switcher 但**保留全部交易历史**（CASCADE 不触发）

### J10d — 跨组合转账 1000 USD

**Given** "美股" portfolio 有 CASH:USD 5000，"加密钱包" portfolio 有 CASH:USD 0
**When** 进 `/me/cash-balances`（"美股" active） → tap "转账到其他组合" → 选 dest = "加密钱包" + 金额 1000 USD
**Then** 系统生成两笔 transaction:

- 源："美股" SELL CASH:USD × 1000, notes = `transfer-out-to-{dest-id}`
- 目标："加密钱包" BUY CASH:USD × 1000, notes = `transfer-in-from-{source-id}`
  **And** 源 CASH:USD 余额 = 4000；目标 = 1000
  **And** 不触发汇率换算（决策 11：USD 转过去仍是 USD）

### J10e — 不允许做空现金

**When** "美股" CASH:USD 余额 4000，我试图转 5000 USD 到 "加密钱包"
**Then** form 转账按钮 disabled + inline error "转出金额超过余额（CASH:USD 4000）"（决策 12）

---

## Resolved decisions (inherited from roadmap §决策 10–14, locked 2026-05-19)

1. **数据模型零改动 — 转账 = 两笔 transaction** — 不新增 `transfers` 表。SELL on source + BUY on dest 是已有 transaction 类型；rebalance / daily-snapshot 算法自然兼容。
2. **币种不自动换汇** — Portfolio A 转 $5000 USD 到 B，B 收到 USD 5000。换汇是用户主动分两步：portfolio A SELL CASH:USD + portfolio A BUY CASH:CNY（用当时市价），再 portfolio A → B 转 CNY。
3. **不允许做空现金** — 表单 inline validation：转出金额 ≤ 源 portfolio 该币种 CASH 余额。无 overdraft / 透支概念。
4. **`notes` 字段标记 transfer** — `transfer-out-to-{portfolioId}` / `transfer-in-from-{portfolioId}`。Stage 3 P2 可选加 `transfer_group_id` 外键串联两笔（不立刻做；现 notes pattern + 时间戳 ±1ms 已够 UAT）。
5. **UI 落点 `/me/cash-balances` 加"转账到其他组合"按钮** — 不开 `/transfer` 独立路由。Sheet / modal 在 cash-balances 页内打开。

---

## Locked 2026-05-20 (BoyangJiao approved)

### 决策 6 — 删除 portfolio = 软归档 + 归档后允许永久删除（A + refinement）

软归档为默认路径：`portfolios.archived_at timestamptz`；归档后从 switcher / 默认查询过滤，**保留所有交易历史**。`/me/portfolios` 折叠的"已归档"区每行除了「恢复」按钮，**还额外提供「永久删除」**（两步保护：必须先归档才能永久删除）。

永久删除流程：

1. 用户必须先 `归档` portfolio（任何 active 状态不可直接永久删除）
2. 展开"已归档"区 → 长按某条 → 出"永久删除"红色 destructive action
3. 弹 confirmation dialog：「此操作不可撤销。将永久删除 portfolio "{name}" 及其全部 {N} 笔交易记录。」+ 输入 portfolio 名做二次确认（Github / Linear 同款防误删模式）
4. 确认 → `DELETE FROM portfolios WHERE id = ?` → CASCADE 删除全部 transactions + target_allocations + portfolio_value_snapshots

理由：自用阶段绝大多数误操作能通过归档缓冲恢复；少量真删需求（错误命名、测试 portfolio）保留出口；二次输入名做闸门，足够安全。

### 决策 7 — Insights Tab = 卡片仪表盘（B + per-portfolio card pattern）

**Insights Tab / Markets Tab 不挂 PortfolioSwitcher**：

| Tab           | Switcher | 数据范围                                                                             |
| :------------ | :------- | :----------------------------------------------------------------------------------- |
| **Portfolio** | ✅ 顶栏  | active portfolio scope（按 switcher 切换）                                           |
| **Insights**  | ❌       | **Card-per-portfolio dashboard** —— 每个未归档 portfolio 一张 rebalance summary card |
| **Markets**   | ❌       | User-scoped watchlist（`watchlist_items.user_id` FK；与 portfolio 无关）             |
| **Me**        | ❌       | User-level settings；`/me/portfolios` 子页是 portfolios 管理入口（CRUD + 归档）      |

**Insights Tab 重构（参考 Delta app `投资组合洞察` Tab 模式）**：

垂直滚动的卡片列表。Stage 3 必做卡片：

```
┌─────────────────────────────────────────────────┐
│ ← 洞察                                            │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ My Portfolio                          → 详情 │ │
│ │ ¥ 125,300       +1.2% 今日                   │ │
│ │ ┌─ donut ─┐  目标偏离 8.3%                   │ │
│ │ │  环形图  │  3 笔再平衡建议                   │ │
│ │ └─────────┘  [ 查看 ]                         │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ 加密钱包                              → 详情 │ │
│ │ $ 23,450        +5.8% 今日                   │ │
│ │ ┌─ donut ─┐  目标偏离 14.1%                   │ │
│ │ │  环形图  │  5 笔再平衡建议                   │ │
│ │ └─────────┘  [ 查看 ]                         │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ 401k                                  → 详情 │ │
│ │ ... (per-portfolio card)                     │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ 跨组合再平衡 [Stage 4+ PRO 占位]               │ │
│ │ 自定义跨 portfolio 配比，统一再平衡             │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

**Stage 3 范围**：

- 每张 per-portfolio card 显示：name + 报告币种总额 + 今日变动 + AllocationDonut + 偏离百分比 + 再平衡条目数 + "[查看]" CTA
- "[查看]" tap → `/insights/rebalance/setup?portfolioId=...` 现有路由（带 portfolio_id query；与现有路由兼容）
- **跨组合再平衡卡片** 仅占位，标 "Stage 4+ PRO"（与 roadmap §决策 2 订阅占位同色 chip 路径）

**Stage 3 不做** 但 spec 留出空间（Block C/D 加）：

- 历史净值时段曲线（Delta `历史记录` card）→ Block C
- 投资组合表现 bar chart（Delta `投资组合表现` card）→ Block D
- 资产多样性 donut / 收益报告 table / P/E / 风险 / 贸易统计 / 费用 / 资产价值 → Stage 4 PRO+ 锁卡

**架构含义**：

- `PortfolioSwitcher` 组件只在 Portfolio Tab 头部 mount（不在 Insights / Markets）
- 新增 `<InsightsTabContent>` 容器组件：根据 `usePortfolios({ includeArchived: false })` 渲染 N 个 `<PortfolioInsightCard>`
- 现有 `/insights/rebalance/setup` `/insights/rebalance/actions` 路由保留；接受 `portfolioId` query 参数（之前隐式用 active；现在需要 explicit 才能按 per-card context 跳）

### 决策 8 — `activePortfolioId` 持久化 = Zustand + **AsyncStorage**（修订 2026-05-20）

**初版（A）写的是 MMKV**，但 MMKV 是 native module，Expo Go 不内置 → 引入会让 Stage 3 自用阶段被迫切 Dev Build (10-15 分钟首编 + 后续每加 native dep 重编)。`activePortfolioId` 是低频写场景（< 10 次/天），AsyncStorage < 10ms boot read 完全够用。改为 Zustand + AsyncStorage 一条路径，MMKV 评估推到 Stage 4 + 真出现 high-frequency write hotspot 后再换。

冷启动从 AsyncStorage 读 → 命中且未归档则用；指向归档/删除 → fallback `portfolios[0]` + clear；portfolios 空则 null。

### 决策 9 — 转账余额校验 = open-time snapshot + submit-time double-check（A）

Modal 打开时一次性 `useCashBalances(sourcePortfolioId)` 读余额并缓存在 form state；输入金额实时与缓存比较；submit 前再 server-side 读一次余额做 double-check（多设备 / 并发 transaction 防御）。

### 决策 10 — 跨币种转账目标 portfolio 缺 CASH:\* 资产 = 自动 ensureAsset（A）

mutation 调用 `ensureAsset({id: "CASH:{currency}", market: "CASH", symbol: currency, currency, name: currency})`（migration 0008 + 0009 RLS 已允许 authenticated INSERT CASH）；idempotent upsert，已存在则 no-op；不需要 form 弹"先创建账户"。

---

## Data model

### Migration 0011 — `portfolios.archived_at` (assuming Open Q 1 = A)

```sql
-- packages/db/drizzle/migrations/0011_portfolios_archived_at.sql
ALTER TABLE "portfolios"
  ADD COLUMN "archived_at" timestamptz NULL;

CREATE INDEX "portfolios_archived_at_idx" ON "portfolios" ("archived_at")
  WHERE "archived_at" IS NULL;
```

Index 是 partial（非归档行），让 active 查询 `WHERE archived_at IS NULL` O(log n)。归档行不进 default queries → switcher / 估值 / rebalance 自然过滤。

### Drizzle schema 更新

```ts
// packages/db/src/schema/portfolios.ts
archivedAt: timestamp("archived_at", { withTimezone: true }).default(sql`NULL`),
```

### Transaction transfer pair pattern (决策 4)

无 schema 改动。`notes` 字段约定：

| 转账方向                  | source transaction `notes` | dest transaction `notes`  |
| :------------------------ | :------------------------- | :------------------------ |
| portfolio A → portfolio B | `transfer-out-to-{B.id}`   | `transfer-in-from-{A.id}` |

两笔 transaction `created_at` 严格用同一 `now()` 调用（client 端生成同一 ISO timestamp，作为两笔 insert 的 `created_at`），Stage 3 末若需 group_id 加迁移时回填即可。

### `@arc/core` 扩展

```ts
// packages/core/src/domain/types.ts — 扩展 Portfolio
export interface Portfolio {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly reportingCurrency: Currency;
  readonly createdAt: string;
  readonly archivedAt: string | null; // 新增
}

// packages/core/src/portfolio/transfer.ts — 新增
export interface TransferIntent {
  readonly sourcePortfolioId: string;
  readonly destPortfolioId: string;
  readonly assetId: `CASH:${Currency}`; // 决策 11 — 必须是 CASH:*，禁止非现金转账
  readonly amount: Decimal; // 决策 12 — > 0 必须；validateTransfer 检查 ≤ 源余额
}

export type TransferError =
  | { code: "amount_not_positive" }
  | { code: "amount_exceeds_balance"; balance: Decimal }
  | { code: "same_portfolio" }
  | { code: "non_cash_asset" };

export const validateTransfer = (
  intent: TransferIntent,
  sourceBalance: Decimal
): ReadonlyArray<TransferError> => {
  /* ... */
};

export const buildTransferTransactions = (
  intent: TransferIntent,
  createdAtIso: string
): { source: NewTransaction; dest: NewTransaction } => {
  /* ... */
};
```

`validateTransfer` 是 pure function，property test 在 `@arc/core` 单测中覆盖（与 `validateTargetAllocations` 同模式）。

---

## Architecture

### New code locations

| File                                                             | Role                                                                                                                                     |
| :--------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/db/drizzle/migrations/0011_portfolios_archived_at.sql` | + `archived_at` column + partial index                                                                                                   |
| `packages/db/src/schema/portfolios.ts`                           | + `archivedAt` field                                                                                                                     |
| `packages/core/src/domain/types.ts`                              | extend `Portfolio` with `archivedAt`                                                                                                     |
| `packages/core/src/portfolio/transfer.ts`                        | `TransferIntent` / `validateTransfer` / `buildTransferTransactions`                                                                      |
| `apps/mobile/src/lib/store/active-portfolio.ts`                  | Zustand store + AsyncStorage persist (决策 8)                                                                                            |
| `apps/mobile/src/lib/queries/use-portfolios.ts`                  | extend with `useCreatePortfolio` / `useArchivePortfolio` / `useUnarchivePortfolio` / `useRenamePortfolio` / **`useHardDeletePortfolio`** |
| `apps/mobile/src/lib/queries/use-active-portfolio.ts`            | derived hook: returns `Portfolio` from store + queries                                                                                   |
| `apps/mobile/src/lib/queries/use-transfer.ts`                    | `useTransferBetweenPortfolios` mutation (calls `buildTransferTransactions` + supabase)                                                   |
| `apps/mobile/src/lib/queries/use-portfolio-insights.ts`          | per-portfolio insight summary (total value + change% + deviation + rebalance count) — feeds `PortfolioInsightCard`                       |
| `apps/mobile/app/me/portfolios/index.tsx`                        | active list + 已归档折叠区 + 新建 / 重命名 / 归档 / **永久删除 (with name confirm)**                                                     |
| `apps/mobile/app/me/portfolios/new.tsx`                          | new portfolio modal                                                                                                                      |
| `apps/mobile/app/(tabs)/insights.tsx` (rewrite)                  | **InsightsTabContent dashboard** — vertical card list per unarchived portfolio + Stage 4 占位卡                                          |
| `apps/mobile/app/me/cash-balances.tsx` (modify)                  | add "转账到其他组合" button → opens transfer sheet                                                                                       |
| `apps/mobile/app/insights/rebalance/setup.tsx` (modify)          | accept `?portfolioId=` query param explicit；fallback to active 仅 Portfolio Tab 入口路径                                                |
| `apps/mobile/src/components/PortfolioSwitcher.tsx`               | dropdown — **仅在 Portfolio Tab 顶部 mount**（决策 7）                                                                                   |
| `packages/ui/src/finance/PortfolioInsightCard.tsx`               | per-portfolio summary card（name / 总额 / 今日 % / AllocationDonut / 偏离 + CTA）                                                        |
| `packages/ui/src/finance/CashBalanceTransferSheet.tsx`           | reusable Sheet (Stage 2 `@gorhom/sheet` wrapper 已存在)                                                                                  |
| `packages/ui/src/finance/HardDeleteConfirmDialog.tsx`            | text-input confirmation dialog (Github / Linear 同款模式)                                                                                |
| seed: `tools/seed-dev-data.ts` + `seed-core.ts`                  | 3 new scenarios: `portfolios:single`, `portfolios:multi-3`, `portfolios:transfer-history`                                                |
| `@arc/i18n`                                                      | ~40 strings (CRUD labels / 转账文案 / validation errors / hard-delete 确认文案 / Insights 卡片 + 占位卡)                                 |

### Active portfolio store (Open Q 3 = A)

```ts
// apps/mobile/src/lib/store/active-portfolio.ts + active-portfolio-storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export const useActivePortfolioStore = create<ActivePortfolioState>()(
  persist(
    (set) => ({
      activePortfolioId: null,
      setActivePortfolioId: (id) => set({ activePortfolioId: id }),
    }),
    {
      name: "arc.activePortfolioId",
      storage: createJSONStorage(() => ({
        getItem: (k) => AsyncStorage.getItem(k),
        setItem: (k, v) => AsyncStorage.setItem(k, v),
        removeItem: (k) => AsyncStorage.removeItem(k),
      })),
    }
  )
);
```

`useActivePortfolio` derived hook resolves the stored ID against the live `usePortfolios()` query, with these fallbacks:

1. `activePortfolioId` 命中且未归档 → 用它
2. `activePortfolioId` 指向归档 / 删除的 portfolio → fallback `portfolios[0]` 且 `setActivePortfolioId(portfolios[0].id)`
3. portfolios 空 → null

### Transfer mutation flow

```
User submits transfer form
    ↓
useTransferBetweenPortfolios.mutate({ intent })
    ↓
1. Read latest source balance via supabase (server-side double-check)
    ↓
2. validateTransfer(intent, latestBalance) — pure
    ↓ (if errors)
       throw → form 显示 inline error
    ↓ (else)
3. buildTransferTransactions(intent, isoNow)
    ↓
4. supabase.from("transactions").insert([source, dest]) — single batch insert
    ↓
5. onSuccess: invalidate ["portfolios", uid] + ["cash-balances", sourceId] + ["cash-balances", destId]
   + close modal + toast 「转账完成」
```

**Batch insert vs sequential**：用单次 `insert([source, dest])` 让 Supabase 原子写。如果 RLS 有任一拒绝（不该发生 — 同 user），两笔都失败。**重要**：不开 explicit transaction（Supabase JS client 不暴露），靠 `insert(array)` 的内置原子性。

---

## UI contract

### `/me/portfolios` list

```
┌─────────────────────────────────────────────────┐
│ ← Portfolios                                    │
│                                                 │
│ ● My Portfolio                    CNY  · 默认   │
│ ○ 加密钱包                         USD          │
│ ○ 401k                            USD          │
│                                                 │
│           [ + 新建组合 ]                          │
│                                                 │
│ ── 已归档 ────────────────────────────── ▼      │
│   (折叠默认；展开后)                              │
│   ○ 旧账户                         CNY          │
└─────────────────────────────────────────────────┘
```

- 当前 active = ● 实心圆；其他 = ○ 空心
- Swipe-left / 长按 → 「重命名 / 归档」
- "+ 新建组合" → modal: name input + reporting_currency picker (segmented control CNY/USD/HKD/JPY)
- 已归档区折叠；展开后每行末尾「恢复」按钮（设 `archived_at = NULL`）

### Tab 顶部 switcher（Open Q 2 = A — Portfolio/Insights/Markets Tab）

```
┌─────────────────────────────────────────────────┐
│  ▼ My Portfolio                          [+ 录]│  ← 顶栏；tap name 弹下拉
│  ────────────────────────────────────────       │
│  ...Tab 内容...                                 │
└─────────────────────────────────────────────────┘

Tap ▼ →
┌─────────────────────────┐
│ ● My Portfolio    CNY   │  (顶栏直接下拉)
│ ○ 加密钱包         USD   │
│ ○ 401k            USD   │
│ ──                      │
│   管理 portfolios →     │  (links to /me/portfolios)
└─────────────────────────┘
```

- 单 portfolio 用户：显示 "My Portfolio" 不带 ▼（没切换需求 → 不浪费视觉权重）
- 多 portfolio：显示 ▼ + 当前 portfolio name

### Cash balances + 转账（决策 14：不开新路由）

```
┌─────────────────────────────────────────────────┐
│ ← Cash balances (My Portfolio)                  │
│                                                 │
│ CASH:USD       [ 5000.00       ]                │
│ CASH:CNY       [ 12000.00      ]                │
│ CASH:HKD       [ 0.00          ]                │
│                                                 │
│ [ 保存 ]                                         │
│                                                 │
│         [ 转账到其他组合 →]                       │
└─────────────────────────────────────────────────┘

Tap "转账到其他组合" →

┌─────────────────────────────────────────────────┐
│ 转账到其他组合 (Sheet)                            │
│                                                 │
│ 从  My Portfolio                                │
│ 到  [ 选择 ▼ ]   ←  下拉 active 以外的 portfolio │
│ 币种 [ USD ▼ ]   ←  限当前组合有余额的 CASH:*    │
│ 金额 [ 1000.00  ] / 5000.00 可用                 │
│                                                 │
│ ⓘ 不会自动换汇 — USD 转过去仍是 USD               │
│                                                 │
│ [ 确认转账 ]                                     │
└─────────────────────────────────────────────────┘
```

- 金额输入实时校验：超过余额 → 灰按钮 + inline "转出金额超过余额（CASH:USD {balance}）"
- 转账成功 toast: "已转账 USD 1000 到 加密钱包" + 关闭 sheet（不自动切换 active portfolio — 决策留在源 portfolio 视角）

---

## Acceptance criteria (S3-AC-B.x)

### S3-AC-B.1 — 新建 portfolio

**Given** 我有 1 个 portfolio
**When** `/me/portfolios` → "+ 新建组合" → 输入 "加密钱包" + USD → 确认
**Then** `portfolios` 表新增一行（user_id = 我，archived_at = NULL）
**And** 顶栏 switcher 列表立刻包含 "加密钱包"
**And** active 不自动切换（仍是原 portfolio；新建只是创建，不切到）

### S3-AC-B.2 — 切换 active + 持久化

**Given** 我有 ≥ 2 个 portfolio，active = "My Portfolio"
**When** 顶栏 switcher → 选 "加密钱包"
**Then** Portfolio Tab / Insights Tab / Markets Tab 切到 "加密钱包" 数据（持仓 / rebalance / watchlist 都按该 portfolio）
**When** 杀进程重启
**Then** active 仍是 "加密钱包"（AsyncStorage 持久化）

### S3-AC-B.3 — Active 指向归档 / 删除的 portfolio → fallback

**Given** active = "加密钱包"
**When** 归档 "加密钱包"
**Then** active 自动 fallback 到 `portfolios[0]`（第一个非归档）
**And** 本地持久化同步更新

### S3-AC-B.4 — 重命名 + 归档不破坏交易历史

**Given** "加密钱包" 有 3 笔历史交易
**When** 重命名为 "DeFi 钱包" → 归档 → 恢复 → 再删除（如果 Open Q 1 = A 则无硬删除路径 → 该步骤不适用）
**Then** 3 笔交易仍存在 `transactions` 表（CASCADE 未触发，因为只是 archived_at 更新）
**And** 归档后 Portfolio Tab switcher 不显示该 portfolio

### S3-AC-B.5 — 跨组合转账成功路径

**Given** "美股" CASH:USD = 5000，"加密钱包" CASH:USD = 0
**When** `/me/cash-balances`（美股 active）→ "转账到其他组合" → dest=加密钱包 / USD / 1000 → 确认
**Then** `transactions` 表新增 2 行：

- { portfolio_id=美股, asset_id=CASH:USD, type=SELL, shares=1000, price_per_share=1, currency=USD, notes="transfer-out-to-{加密钱包 id}" }
- { portfolio_id=加密钱包, asset_id=CASH:USD, type=BUY, shares=1000, price_per_share=1, currency=USD, notes="transfer-in-from-{美股 id}" }
  **And** 两笔 created_at 相同（同一 ISO 字符串）
  **And** "美股" CASH:USD 余额 = 4000，"加密钱包" CASH:USD = 1000
  **And** active 仍是 "美股"（不自动跳）

### S3-AC-B.6 — 不允许做空现金

**Given** "美股" CASH:USD = 4000
**When** 转账金额输入 5000
**Then** 确认按钮 disabled + inline error "转出金额超过余额（CASH:USD 4000）"
**When** 强行 form-submit（curl / 多设备并发）— 源余额 server-side 校验已掉到 3500
**Then** mutation 抛 `TransferError({code: "amount_exceeds_balance", balance: 3500})` + form 不重置不丢用户输入

### S3-AC-B.7 — 币种保持不换汇

**Given** "美股" CASH:USD = 5000
**When** 转 1000 USD 到 "加密钱包"
**Then** 转账 sheet 没有"换汇"选项；产生的 dest transaction.currency = USD（不是 CNY）

### S3-AC-B.8 — 目标 portfolio 缺 CASH 资产 → 自动 ensure

**Given** "加密钱包" 从未持有 CASH:HKD
**When** 从 "美股" 转 1000 HKD 到 "加密钱包"（假设源有 HKD 余额）
**Then** mutation 调用 `ensureAsset({id: "CASH:HKD", ...})`（idempotent upsert）
**And** dest transaction 写入成功（不报 FK constraint error）

### S3-AC-B.9 — Switcher 仅在 Portfolio Tab；Insights/Markets 无 switcher（决策 7）

**Given** 我有 ≥ 2 个 portfolio
**Then** **Portfolio Tab** 顶栏显示 ▼ switcher
**And** **Insights Tab** 顶栏显示「洞察」标题，**无** switcher
**And** **Markets Tab** 顶栏显示「自选」标题，**无** switcher
**And** **Me Tab** 顶栏无 switcher（已有行为）

**Given** 用户只有 1 个未归档 portfolio
**Then** Portfolio Tab 顶栏显示 portfolio name 但**不带 ▼ icon**

### S3-AC-B.10 — Insights Tab 卡片仪表盘（决策 7）

**Given** 我有 3 个未归档 portfolio
**When** 进 Insights Tab
**Then** 渲染 3 张 `PortfolioInsightCard`（按 `created_at asc`），外加 1 张 "跨组合再平衡 [Stage 4+ PRO]" 占位卡（决策 7）
**And** 每张卡显示该 portfolio 的：name + 报告币种总额 + 今日变动 + AllocationDonut + 目标偏离 % + 再平衡条目数
**When** 我 tap 其中一张卡的「查看」
**Then** 跳到 `/insights/rebalance/setup?portfolioId={该卡的 id}`（query 参数显式带，与 active portfolio 解耦）

**Given** 该 portfolio 未设 target_allocations
**Then** 该卡显示「未设目标配置」+ 「设置」CTA → tap 跳 `/insights/rebalance/setup?portfolioId=...`

### S3-AC-B.11 — Rebalance / Daily-snapshot 数据按 portfolio 隔离

**Given** "美股" 已设 target_allocations (仅 US 资产)，"加密钱包" 已设 target_allocations (仅 BTC/ETH)
**When** Insights Tab 卡片列表渲染
**Then** "美股" 卡 + "加密钱包" 卡显示**各自 portfolio 的 targets + 偏离**（target_allocations 表已含 portfolio_id FK，migration 0007）
**Given** active = "加密钱包"（Portfolio Tab）
**When** Portfolio Tab `DailySnapshotCard` 渲染
**Then** 显示 "加密钱包" 的 portfolio_value_snapshots（按 active）

### S3-AC-B.12 — 永久删除流程（决策 6 refinement）

**Given** "测试组合" 已归档（archived_at != NULL）
**When** `/me/portfolios` 展开"已归档"区 → 长按 "测试组合" → tap "永久删除"
**Then** 弹 confirmation dialog 显示 "{name} 及 {N} 笔交易记录将被永久删除"
**And** 要求输入 portfolio name "测试组合" 完整匹配才解锁红色 destructive button
**When** 输入正确 + tap 确认
**Then** `DELETE FROM portfolios WHERE id = ?` 执行 → CASCADE 删除全部 transactions + target_allocations + portfolio_value_snapshots
**And** 已归档区列表立刻刷新（不再显示该 portfolio）

**Given** active portfolio (archived_at = NULL)
**Then** 永久删除按钮**不可见**（必须先归档；两步保护）

---

## Out of scope (Stage 3 explicitly NOT doing)

- **硬删除 portfolio** — Open Q 1 锁 A 后永久 archived 模式；硬删除评估 Stage 4 用户主动诉求
- **跨币种自动换汇** — 决策 11 已锁，仍要用户分两步主动操作
- **Portfolio templates / 复制** — 复制现有 portfolio 结构到新 portfolio：post-MVP
- **Portfolio sharing / collaborative** — Stage 4 + auth 多角色
- **Portfolio import / export 单独路径** — 走 Block F CSV 通用导入导出
- **`transfer_group_id` 外键** — 决策 4 P2 项；Stage 3 用 notes 字符串约定够用
- **多 active portfolio**（"同时看 3 个"）— 切换语义；多视图 post-MVP
- **Drag 重排 portfolios** — `created_at asc` 默认即可
- **Per-portfolio currency override on display** — Stage 3 仍用全局 reporting currency；per-portfolio 显示币种 Stage 4
- **Block A Tushare HK / FUND adapters** — ADR 011 / spec §决策 14 / 15 已锁，不重启

---

## Implementation plan (recommended commit order)

> Routing: Sonnet/Cursor — pattern 与 J9 Rebalance 接近（schema → core → hook → UI → seed）。Opus 在 transfer 算法 / property tests 介入。每个 commit 独立 PR-able + `pnpm typecheck` 6/6 + `pnpm lint` 6/6 + `pnpm test` ✅。

1. **`feat(db): portfolios.archived_at + migration 0011`** — schema + migration SQL + Drizzle 字段 + `apps/mobile` Portfolio type 同步
2. **`feat(core): TransferIntent / validateTransfer / buildTransferTransactions + property tests`** — 5+ property tests（Decimal 边界 / same-portfolio reject / non-cash reject / negative amount reject / build pair 双笔 created_at 相同）— **Opus 推荐 review**
3. **`feat(mobile): active-portfolio Zustand store + AsyncStorage persist`** — store + `useActivePortfolio` derived hook + fallback 逻辑
4. **`feat(mobile): portfolios CRUD hooks`** — `useCreatePortfolio` / `useArchivePortfolio` / `useUnarchivePortfolio` / `useRenamePortfolio` / **`useHardDeletePortfolio`**
5. **`feat(mobile): /me/portfolios list + new portfolio modal + 已归档区 + 永久删除 confirm dialog`** — list 视图 + 已归档折叠 + 长按 actions + `HardDeleteConfirmDialog`（决策 6 refinement）
6. **`feat(ui+mobile): PortfolioSwitcher (仅 Portfolio Tab)`** — `@arc/ui` 下拉组件 + **仅 Portfolio Tab 头部挂载**（决策 7）
7. **`feat(mobile): transfer sheet + useTransferBetweenPortfolios`** — `CashBalanceTransferSheet` UI + mutation hook + ensureAsset wrapper（决策 10）
8. **`feat(mobile): /me/cash-balances "转账到其他组合" button`** — sheet 入口（决策 14 / roadmap）
9. **`feat(mobile): downstream hooks consume active portfolio`** — `useCashBalances` / `usePortfolioHoldings` 等改读 `useActivePortfolio()`（移除 `portfolios?.[0]?.id` 写死）；`/insights/rebalance/setup` `/insights/rebalance/actions` 接受 `?portfolioId=` query 参数（与 active 解耦）
10. **`feat(ui+mobile): PortfolioInsightCard + InsightsTabContent dashboard`**（决策 7）— `@arc/ui/finance/PortfolioInsightCard` + `apps/mobile/app/(tabs)/insights.tsx` 重写为卡片仪表盘 + `use-portfolio-insights` hook + "跨组合再平衡 Stage 4+ PRO" 占位卡
11. **`feat(seed): 3 portfolio scenarios + DEV panel`** — `portfolios:single` / `portfolios:multi-3` / `portfolios:transfer-history`
12. **`docs(spec+session-state): mark Block B Accepted + bump`**

**Order rationale**: schema → core → store → hooks → CRUD UI → switcher → transfer → cash-balances 入口 → downstream rewire → Insights 卡片重构 → seed → docs。每个 commit 独立。Insights restructure (#10) 在 downstream rewire (#9) 之后，因为 Insights Tab 需要 hooks 已接 active；reb plate 的 query 参数化也在 #9 落地。

---

## Test plan

| AC                               | Layer    | Artifact / how to run                                                                                                        |
| :------------------------------- | :------- | :--------------------------------------------------------------------------------------------------------------------------- |
| S3-AC-B.1 新建                   | L4       | `pnpm seed:portfolios:single` → tap "+ 新建组合"                                                                             |
| S3-AC-B.2 切换 + 持久化          | L4       | `pnpm seed:portfolios:multi-3` → 切换 → 杀进程 → 验证                                                                        |
| S3-AC-B.3 active fallback        | L1 + L4  | `useActivePortfolio` unit test + UAT                                                                                         |
| S3-AC-B.4 归档不破坏历史         | L4 + SQL | `pnpm seed:portfolios:transfer-history` → 归档 → SQL verify transactions 仍存                                                |
| S3-AC-B.5 跨组合转账成功         | L1 + L4  | `@arc/core` property test on `buildTransferTransactions` + UI flow                                                           |
| S3-AC-B.6 不允许做空             | L1 + L4  | property test on `validateTransfer({amount > balance})` + UI inline error                                                    |
| S3-AC-B.7 币种保持               | L1       | `validateTransfer` + `buildTransferTransactions` 不引入 FX                                                                   |
| S3-AC-B.8 ensureAsset 自动       | L4       | UAT — 转 HKD 到从未持有 HKD 的 portfolio                                                                                     |
| S3-AC-B.9 Switcher 仅 Portfolio  | L4       | `seed:portfolios:single` (单 portfolio 无 ▼) + `multi-3` (Portfolio 有 ▼; Insights/Markets 无)                               |
| S3-AC-B.10 Insights 卡片仪表盘   | L4       | `seed:portfolios:multi-3` → Insights Tab 渲染 3 卡 + Stage 4 占位卡；tap 「查看」带 portfolioId 跳转                         |
| S3-AC-B.11 数据按 portfolio 隔离 | L4       | `seed:portfolios:multi-3` 每 portfolio 独立 target → Insights 卡显示对应数据；Portfolio Tab 切 active 验证 DailySnapshotCard |
| S3-AC-B.12 永久删除流程          | L4 + SQL | 归档 → 长按 → 输入 name confirm → SQL verify transactions / target_allocations / portfolio_value_snapshots 全部 CASCADE 删除 |

**Property tests target** (@arc/core)：

- `validateTransfer` 输入空间：amount ∈ ℝ / source-balance ∈ ℝ+ / source ?= dest / assetId 形态。预期 5+ property tests：
  - `validateTransfer(intent, sourceBalance >= amount && amount > 0 && source != dest && CASH:*) === []`
  - `amount <= 0 → contains "amount_not_positive"`
  - `amount > sourceBalance → contains "amount_exceeds_balance"`
  - `source == dest → contains "same_portfolio"`
  - `assetId !startswith "CASH:" → contains "non_cash_asset"`
- `buildTransferTransactions` invariants:
  - `source.shares.eq(dest.shares)` 永远成立
  - `source.currency === dest.currency` 永远成立
  - `source.createdAt === dest.createdAt`
  - `source.notes.includes(dest.portfolioId)` & `dest.notes.includes(source.portfolioId)`

---

## Risks

| Risk                                                       | Likelihood       | Impact                                      | Mitigation                                                                                               |
| :--------------------------------------------------------- | :--------------- | :------------------------------------------ | :------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 转账并发 — 同源 portfolio 两笔转账 race                    | Low (单设备)     | 超额扣 → 余额变负                           | 提交前 server-side double-check + Supabase `insert([source, dest])` 单批；后续 Stage 4 加 row-level lock |
| `activePortfolioId` 指 stale ID 导致 UI crash              | Med              | 进 Portfolio Tab 白屏                       | `useActivePortfolio` fallback 链 + Boundary：null → 引导到 `/me/portfolios` 列表                         |
| 归档逻辑漏掉过滤位 → 估值 / rebalance 错算入归档 portfolio | Med              | 财务数据错                                  | `usePortfolios` 默认 `WHERE archived_at IS NULL`；要看归档显式传 `{ includeArchived: true }`             |
| transfer notes 字符串约定后续 group_id 迁移困难            | Low              | 历史 transaction notes 不规整               | `notes` regex `^transfer-(out-to                                                                         | in-from)-([0-9a-f-]{36})$` 一致；Stage 4 加 group_id 迁移可回填 |
| 单批 insert 失败时 partial state                           | Low              | 半笔 → 余额数据腐败                         | Supabase `insert([])` 是原子的（PostgREST 单 statement multi-row insert）；UAT verify                    |
| 多设备同时切换 active portfolio                            | Low (单设备 dev) | 视图闪烁                                    | AsyncStorage 是单设备本地存储，不跨设备同步；Stage 4 加 Supabase user_preferences 表                     |
| Rebalance target_allocations 跨 portfolio 串               | Low              | 切到 portfolio B 看到 portfolio A 的 target | `target_allocations` schema (migration 0007) 已含 `portfolio_id` FK + RLS — 切换天然过滤                 |

---

## Verification checklist before merging back to `dev/stage-3`

- [ ] All S3-AC-B.1–B.10 manually verified on iOS sim
- [ ] `pnpm typecheck` 6/6 ✅ / `pnpm lint` 6/6 ✅ / `pnpm test` ✅（含 5+ 新 property tests on `validateTransfer` / `buildTransferTransactions`）
- [ ] Migration 0011 applied on dev Supabase + user confirmed
- [ ] DEV 3 个新场景跑通：`portfolios:single` / `multi-3` / `transfer-history`
- [ ] Daily-snapshot Edge Function 对多 portfolio 跑通（Stage 2 已多 portfolio-aware；只需 verify）
- [ ] Rebalance UI 切换 active 后 targets 隔离（migration 0007 已支持）
- [ ] `apps/mobile/app/me/cash-balances.tsx` 不再硬写 `portfolios?.[0]?.id`（grep 验证）
- [ ] `session-state.md` bumped (Block B Accepted；next = Block C `holdings-table-stage-3.md`)

---

## Hand-off

- **Implementation owner**: Sonnet/Cursor — commit chain 模板与 J9 Rebalance 接近
- **Review owner**: Opus
  - commit #2 `validateTransfer` + `buildTransferTransactions` + property tests — **Opus 主场**（核心 invariant + Decimal 边界）
  - commit #9 downstream rewire（`portfolios?.[0]?.id` → `useActivePortfolio()`）— Opus 把关，避免漏点
- **External dependency**: 用户在 Supabase SQL Editor 跑 migration 0011（commit #1 推完）
- **Blocking ADR**: 无 —— Block A 已 unlock 多市场 adapter；本 spec 不引入新外部依赖

---

## Next after Block B

Block C `holdings-table-stage-3.md`（持仓表 + 详情页 + 多时段图表，HeroUI Pro chart）— roadmap §决策 6 已锁底层组件。spec 起草前需要 review：

- AKShare wrapper `historical.py` 日期窗口（Block A code review §P1-1）—— Block C 多时段图表的硬依赖
- Pro chart subpath import 套路 + `@arc/ui/charts/` 封装层 ADR 必要性

---

## Context bundle

```bash
pnpm ctx:feature multi-portfolio
```

Config: `.specify/feature-specs/stage-3/multi-portfolio.repomix.json`
