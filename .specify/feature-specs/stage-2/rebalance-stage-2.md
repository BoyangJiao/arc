# Feature: Rebalance (Stage 2 — third feature)

- **Status**: Accepted — 4 structural + 6 tactical decisions locked (BoyangJiao approved 2026-05-18)
- **Author**: Claude Opus 4.7 (draft) + BoyangJiao (review)
- **Created**: 2026-05-18
- **Implements**: `docs/user-journeys.md` J9, `docs/development-plan.md` §七 Stage 2 第 3 块
- **Conforms to**: `.specify/constitution.md` (Decimal everywhere, real-flow integrity, **文案铁律：永不"建议买入/卖出"**), ADR 003 v3.1 (`deviationWarning`/`deviationCritical` Business tokens), ADR 006 (`@arc/ui` layering), ADR 007 (real-link integrity), ADR 008 (dev market data policy)
- **Touches**: `packages/db` (1 migration), `packages/core/rebalance` (fill in stubs + property tests), `packages/core/domain` (light additions), `packages/data-sources` (CASH adapter), `packages/ui/finance` (3 new components), `apps/mobile` (3 new routes + 3 new hooks), seed (4 new scenarios), i18n (~18 new strings)

---

## Why this feature exists

Daily-Snapshot answers "what changed today"; Watchlist answers "what am I tracking". **Rebalance** answers the harder question that motivates everything: **"am I still on the strategy I set for myself?"**

For Arc's target user (3+ asset classes across 2+ platforms), portfolio drift is the central failure mode — without an external view, the user gradually overweights whatever's been winning, then is surprised by drawdown. Rebalance is the first feature in the app that gives a **decision** (not just an observation). It must do this without crossing into investment-advice territory (constitution 文案铁律).

This is also the most algorithmically dense feature in Stage 2: Decimal math, sum-to-100 invariants, per-market rounding rules, FX consistency, sign correctness on action items. Property-based tests are non-optional.

---

## User journey (J9, condensed)

**Given** I have ≥1 holding in my portfolio
**When** I tap Insights Tab → first-time
**Then** I see an empty state with CTA "设置首次目标配置"

**When** I tap → `/insights/rebalance/setup` (modal)
**Then** I see one row per held asset + a row per non-zero cash balance, each with a percentage input
**When** I enter percentages that sum to 100
**And** I tap 保存
**Then** the modal closes and Insights Tab shows the deviation view (double donut + per-asset bars colored by tier)

**When** I tap "查看再平衡行动单"
**Then** `/insights/rebalance/actions` shows "达到目标配置需要的份额变化为 +5 股 AAPL / -3 股 NVDA / +¥2,300 现金"

**Hard constraints**:

- Copy NEVER includes "建议买入"、"应该卖"、"推荐"。Only "达到目标需要"、"偏离目标 X%"
- Action quantities use Decimal-precise math + per-market rounding (no `5.7 股 AAPL`)
- Multi-currency portfolios compute deviation in **reporting currency** consistently

---

## Resolved decisions (locked 2026-05-18)

1. **Cash slot** — synthetic `CASH:USD` / `CASH:CNY` / `CASH:HKD` / `CASH:JPY` assets (new `CASH` market enum value). Cash holdings are real `transactions` rows of type BUY (price always = 1.0 native). Rebalance treats CASH assets identically to equities except the rounding step (currency minor unit). Stage 3 may introduce dedicated `CASH_IN`/`CASH_OUT` transaction types if the BUY-at-price-1 hack creates UX friction.
2. **Rounding** — per-market step-size table in `packages/core/rebalance/rounding.ts`:
   - `US` / `CN` / `HK` → `floor` to integer shares (avoid buying more than you can afford)
   - `FUND` → `floor` to integer (Chinese mutual funds = 1 unit minimum)
   - `CRYPTO` → 8 decimals (satoshi resolution)
   - `CASH` → 2 decimals (currency minor unit; JPY → 0 decimals special-case)
3. **Rebalance mode** — Stage 2 = **internal only**. Total portfolio value (including cash) stays constant; SELL overweight + BUY underweight nets to zero ± rounding residual. "Add X new dollars" flow deferred to Stage 3.
4. **Deviation tiers** — fixed thresholds: `|dev| ≤ 5%` → neutral, `5% < |dev| ≤ 10%` → warning (yellow), `|dev| > 10%` → critical (red). Implemented via `useBusinessClasses().deviationWarning` / `.deviationCritical`. No user override in Stage 2.

---

## Data model

### New table: `target_allocations`

| Column           | Type                                  | Notes                                 |
| :--------------- | :------------------------------------ | :------------------------------------ |
| `id`             | `uuid` PK default `gen_random_uuid()` |                                       |
| `portfolio_id`   | `uuid` NOT NULL FK → `portfolios.id`  | ON DELETE CASCADE                     |
| `asset_id`       | `text` NOT NULL FK → `assets.id`      | `market:symbol`, includes CASH assets |
| `target_percent` | `numeric(28,12) NOT NULL`             | 0 ≤ x ≤ 100; Decimal-as-string        |
| `updated_at`     | `timestamptz NOT NULL default now()`  |                                       |

**Indexes / constraints**:

- `UNIQUE (portfolio_id, asset_id)` — one target per (portfolio, asset)
- Index `(portfolio_id)` for "fetch all targets for this portfolio" query
- `CHECK (target_percent >= 0 AND target_percent <= 100)`
- **Sum-to-100 invariant is enforced at app layer**, not DB — partial saves during edit need to be allowed; the final save validates atomically via a single transaction.

**RLS** (same shape as `watchlist_items`, all CRUD scoped by JWT):

- SELECT / INSERT / UPDATE / DELETE: portfolio belongs to `auth.uid()` (join via `portfolios.user_id`)

### Market enum addition

`market_enum` adds `CASH`. Existing `assets` rows are unaffected. New seeded rows:

| `id`       | `market` | `symbol` | `name`       | `currency` |
| :--------- | :------- | :------- | :----------- | :--------- |
| `CASH:USD` | `CASH`   | `USD`    | "美元现金"   | `USD`      |
| `CASH:CNY` | `CASH`   | `CNY`    | "人民币现金" | `CNY`      |
| `CASH:HKD` | `CASH`   | `HKD`    | "港元现金"   | `HKD`      |
| `CASH:JPY` | `CASH`   | `JPY`    | "日元现金"   | `JPY`      |

These rows are public (RLS `assets_public_read` already covers them; INSERT happens in migration via service_role).

### `packages/core/src/domain/types.ts` — light additions

```ts
// types.ts (extend Market)
export type Market = "CN" | "HK" | "US" | "CRYPTO" | "FUND" | "CASH";

// Already exists at line 164 — no changes
export interface TargetAllocation {
  readonly assetId: string;
  readonly targetPercent: Decimal;
}
```

### `packages/core/src/rebalance/` — fill in stubs

```ts
// rebalance/rounding.ts (new)
export const stepSizeForMarket = (market: Market, currency: Currency): Decimal => {
  /* table-driven */
};
export const roundShares = (raw: Decimal, market: Market, currency: Currency): Decimal => {
  /* floor/decimals per table */
};

// rebalance/index.ts — fill in existing stubs
export const computeRebalance = (holdings, valuations, targets): ReadonlyArray<DeviationItem> => {
  /* pure */
};

export const validateTargetAllocations = (targets): ReadonlyArray<string> => {
  /* sum to 100 ± 0.01; no duplicates; all 0–100; all asset_ids unique */
};
```

`DeviationItem` already declared at [rebalance/index.ts:22](../packages/core/src/rebalance/index.ts#L22). No changes to shape — `sharesNeeded` is the post-rounding actionable quantity; `amountNeeded` is the pre-rounding reporting-currency delta.

---

## Architecture

### Data flow

```
                  ┌──────────────────────────────────────┐
                  │  Insights Tab (insights.tsx)         │
                  └────────────────┬─────────────────────┘
                                   ▼
                   useTargetAllocations + useRebalance
                                   ▼
              ┌────────────────────┴────────────────────┐
              │  target_allocations  +  computeRebalance │
              │  (joined with holdings + valuations from  │
              │   existing usePortfolioValuation)         │
              └────────────────────┬────────────────────┘
                                   ▼
                ┌──────────────────┴──────────────────┐
                │  <DeviationDonut>                   │
                │  <DeviationBar> per asset           │
                │  <RebalanceActionList> (next route)  │
                └─────────────────────────────────────┘


  /insights/rebalance/setup       /insights/rebalance/actions
              │                                │
              ▼                                ▼
      <TargetAllocationForm>          <RebalanceActionList>
       (Decimal inputs +               (sharesNeeded per asset
        live sum-to-100 hint)           rounded per market)
              │                                │
       upsertTargets()              (read-only render of
              │                       computeRebalance output)
              ▼
       target_allocations
```

### CASH asset price adapter

The CASH market needs a price adapter (returning price=1.0 in the asset's native currency). Cleanest: add a small **constant adapter** in `packages/data-sources/src/adapters/cash-adapter.ts` registered for the `CASH` market. No external API. FX layer takes care of converting `CASH:CNY` → reporting currency.

### New code locations

| File                                                                  | Role                                                                                    |
| :-------------------------------------------------------------------- | :-------------------------------------------------------------------------------------- |
| `packages/db/drizzle/schema/target-allocations.ts`                    | Drizzle schema                                                                          |
| `packages/db/drizzle/migrations/0006_target_allocations_and_cash.sql` | Table + market_enum CASH + seed 4 CASH assets + 4 RLS policies                          |
| `packages/core/src/rebalance/rounding.ts`                             | Per-market step-size table + `roundShares()`                                            |
| `packages/core/src/rebalance/index.ts`                                | Fill in `computeRebalance` + `validateTargetAllocations`                                |
| `packages/core/__tests__/rebalance.spec.ts`                           | Property tests (Decimal invariants, sign, sum, rounding, multi-currency)                |
| `packages/data-sources/src/adapters/cash-adapter.ts`                  | `createCashPriceAdapter` — always returns price=1.0 native                              |
| `packages/data-sources/src/registry.ts`                               | Register CASH adapter alongside US                                                      |
| `apps/mobile/src/lib/queries/use-target-allocations.ts`               | TanStack hooks: list / upsert-many / delete-all                                         |
| `apps/mobile/src/lib/queries/use-rebalance.ts`                        | Composes `usePortfolioValuation` + `useTargetAllocations` + `computeRebalance`          |
| `packages/ui/src/finance/TargetAllocationForm.tsx`                    | Editable list of (asset, % input); live sum indicator + validation                      |
| `packages/ui/src/finance/DeviationDonut.tsx`                          | Double-ring donut (target outer / current inner) + legend                               |
| `packages/ui/src/finance/DeviationBar.tsx`                            | Per-asset horizontal bar with color tier + delta %                                      |
| `packages/ui/src/finance/RebalanceActionList.tsx`                     | List of "达到目标需要 ±X 股 / ±Y 金额"                                                  |
| `apps/mobile/app/(tabs)/insights.tsx`                                 | Replace empty stub → deviation view OR empty CTA                                        |
| `apps/mobile/app/insights/rebalance/setup.tsx`                        | New modal route: target form                                                            |
| `apps/mobile/app/insights/rebalance/actions.tsx`                      | New screen: action list                                                                 |
| `apps/mobile/app/me/cash-balances.tsx`                                | Simple cash setter form (writes BUY/SELL on CASH assets); link from Settings or FAB     |
| `packages/i18n/src/locales/{en,zh}.ts`                                | ~18 new strings (titles, validation, action verbs, cash labels, tier names)             |
| `supabase/functions/_shared/seed-core.ts`                             | 4 new scenarios: `rebalance:empty-target` / `:aligned` / `:mild-drift` / `:heavy-drift` |
| `apps/mobile/src/lib/dev-tools/scenarios.ts`                          | Register Rebalance feature group + 4 scenarios                                          |
| `docs/user-journeys.md`                                               | J9 spec sync (cash slot + rounding rules + threshold values)                            |

---

## UI contract

### Insights Tab — empty state

```
┌─────────────────────────────────────────────────┐
│                                                 │
│            [ icon: Target ]                     │
│         设置目标配置开始追踪偏离度                  │
│                                                 │
│           [ 设置首次目标配置 → ]                  │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Insights Tab — populated

```
┌─────────────────────────────────────────────────┐
│ 再平衡                                            │
│                                                 │
│      ┌──── target outer ring ────┐              │
│      │   ┌── current inner ──┐   │              │
│      │   │                   │   │   AAPL  40%  │
│      │   │     双环图          │   │   NVDA  30%  │
│      │   │                   │   │   MSFT  20%  │
│      │   └───────────────────┘   │   CASH  10%  │
│      └───────────────────────────┘              │
│                                                 │
│  AAPL    +2.1%  ━━━━━━━━━━ (绿 / neutral)        │
│  NVDA    +7.4%  ━━━━━━━━━━━━━ (黄 / warning)     │
│  MSFT    -12.3% ━━━━━━━━━━━━━━━━━ (红 / critical) │
│  CASH    +2.8%  ━━━━━━━━━━ (绿 / neutral)        │
│                                                 │
│              [ 查看再平衡行动单 → ]                 │
│                                                 │
│  仅供参考，不构成投资建议                            │
└─────────────────────────────────────────────────┘
```

### `/insights/rebalance/setup` — target form

```
┌─────────────────────────────────────────────────┐
│ 取消              设置目标配置             保存    │
│ ─────────────────────────────────────────────── │
│                                                 │
│  按资产分配目标占比（合计需等于 100%）             │
│                                                 │
│  AAPL  Apple Inc.            [  40  ] %         │
│  NVDA  Nvidia                [  30  ] %         │
│  MSFT  Microsoft             [  20  ] %         │
│  CASH  美元现金               [  10  ] %         │
│                                                 │
│  当前合计：100% ✓                                │
│                                                 │
└─────────────────────────────────────────────────┘
```

- 输入 < 100 → "当前合计：X% — 还差 Y%" 黄色
- 输入 > 100 → "当前合计：X% — 超出 Y%" 红色 + 保存按钮 disabled
- 输入 = 100 ± 0.01 → "✓" + 保存按钮 enabled
- 输入框接 Decimal 精度，禁止粘贴非数字

### `/insights/rebalance/actions` — action list

```
┌─────────────────────────────────────────────────┐
│ ← 返回                  再平衡行动单              │
│ ─────────────────────────────────────────────── │
│                                                 │
│  按当前价格估算，达到目标配置需要：                  │
│                                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  AAPL                                           │
│  份额变化  +5 股                                 │
│  约 ¥6,800（按今日价 $189.50 估算）              │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  NVDA                                           │
│  份额变化  -3 股                                 │
│  约 -¥18,700（按今日价 $875 估算）               │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  ...                                            │
│                                                 │
│  仅供参考，不构成投资建议。实际交易需自行决策。       │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 文案铁律检查清单（每条 PR review 必跑）

| 禁止                    | 替代                       |
| :---------------------- | :------------------------- |
| ❌ "建议买入 5 股 AAPL" | ✅ "份额变化 +5 股"        |
| ❌ "应该卖出"           | ✅ "份额变化 -X"           |
| ❌ "推荐配置"           | ✅ "目标配置"              |
| ❌ "将获得 X% 收益"     | （不出现这种文案）         |
| ✅ Action 列表底部必含  | "仅供参考，不构成投资建议" |

### 颜色规则

- 双环 outer ring（target） → foreground neutral; inner ring（current） → per-segment business token
- DeviationBar 颜色：`|dev| ≤ 5%` → neutral; `5–10%` → `deviationWarning.bg`; `>10%` → `deviationCritical.bg`
- 直接 `text-success` / `text-danger` 仍然禁止（ESLint 守门）

---

## Acceptance criteria (S2-AC-3.x)

### S2-AC-3.1 — First setup + persistence

**Given** I have ≥1 holding and 0 target allocations
**When** I open Insights Tab
**Then** I see the empty CTA
**When** I tap → enter percentages summing to 100 → 保存
**Then** the form closes, Insights Tab shows the deviation view
**And** the targets persist across cold restart

### S2-AC-3.2 — Sum-to-100 validation

**Given** I'm in the target setup form
**When** the input total ≠ 100 (within ±0.01)
**Then** 保存 button is disabled
**And** the sum indicator shows tier-appropriate color + delta text
**When** I correct to sum exactly 100
**Then** 保存 button enables

### S2-AC-3.3 — Deviation math is correct (property tests)

**Given** random valid (holdings, valuations, targets) inputs (fast-check generators)
**When** `computeRebalance` runs
**Then** for each item: `currentPercent + deviationPercent` matches the recomputed current %
**And** `Σ currentPercent ≈ 100` (Decimal tolerance 0.01)
**And** `Σ amountNeeded ≈ 0` (internal rebalance invariant; tolerance 0.01)
**And** if `deviationPercent > 0` then `sharesNeeded < 0` (overweight → sell), and vice versa

### S2-AC-3.4 — Color tier matches deviation magnitude

**Given** a portfolio with assets at +2%, +7%, -12%, +0.5% deviation
**When** I render the deviation view
**Then** the three rendered bars use neutral, warning, critical tokens respectively
**And** color flip on red-up/green-down toggle is unaffected (deviation tokens are independent of gain/loss tokens — ADR 003)

### S2-AC-3.5 — Action quantities respect per-market rounding

**Given** a US equity needs +5.7 raw shares for perfect alignment
**When** the action list renders
**Then** it shows `+5` (floor)
**And** the displayed approximate amount uses 5 shares × current price (not 5.7 × price)
**And** for a CRYPTO asset, fractional shares show with up to 8 decimals
**And** for a CASH asset, the amount shows currency-appropriate decimals (USD 2 / JPY 0)

### S2-AC-3.6 — Cash slot integrates

**Given** my portfolio has $5000 cash recorded as a BUY of `CASH:USD` shares=5000 price=1.0
**When** I open target setup
**Then** `CASH:USD` appears in the row list alongside equity holdings
**When** I set target 10% on CASH:USD
**Then** the deviation calculation includes cash in both numerator and denominator
**And** if I'm overweight cash → action list shows "CASH:USD 份额变化 -X"

### S2-AC-3.7 — 文案铁律 zero-tolerance

**Given** all i18n strings in `packages/i18n/src/locales/{en,zh}.ts` related to Rebalance
**When** I grep for forbidden tokens (`建议买入`, `推荐`, `应该买`, `应该卖`, `recommend`, `should buy`, `should sell`)
**Then** the grep returns 0 matches
**And** action list copy uses only "份额变化 ±X" / "偏离目标 X%" / "目标配置"
**And** the disclaimer "仅供参考，不构成投资建议" is present on both the deviation view footer and the action list footer

### S2-AC-3.8 — Multi-currency portfolio

**Given** a portfolio with AAPL (USD), 600519 (CNY), BTC (BTC), `CASH:HKD` (HKD)
**And** reporting currency = CNY
**When** I compute deviation
**Then** all currentPercent values are computed against the same reporting-currency total
**And** sharesNeeded values are in native shares (USD shares of AAPL, CNY shares of 600519, BTC of BTC, HKD of CASH:HKD)
**And** amountNeeded values are in reporting currency

---

## Out of scope (Stage 2 explicitly NOT doing)

- **Asset-class targets** ("20% bonds / 50% stocks") — Stage 3, requires asset classification taxonomy
- **Drag-to-adjust % UI** — Stage 2 = numeric input only
- **"Add new cash" flow** — Stage 2 = internal only; Stage 3 lets user model "if I add $5000, what's the action list?"
- **Tax-aware action sequencing** — Stage 3+; current actions don't consider holding period or lot accounting
- **Rebalance reminders / scheduled notifications** — Stage 4
- **Multiple target allocation sets per portfolio** ("aggressive" vs "conservative" presets) — post-MVP
- **Dedicated `CASH_IN` / `CASH_OUT` transaction types** — Stage 2 uses BUY/SELL on CASH assets at price=1
- **Min-trade-amount filter** ("ignore <$50 actions") — Stage 3 polish
- **Confidence interval on action quantities** (price moves between view + execution) — out of scope; disclaimer covers it
- **Asset-detail tap from deviation bar** — same pattern as Daily-Snapshot mover: tap reserved, no-op in Stage 2

---

## Implementation plan (recommended commit order)

1. **`feat(db): migration 0006 + target_allocations schema + CASH market + seed CASH assets`** — DB groundwork. Includes seed inserts for 4 CASH assets via service_role.
2. **`feat(core): Market CASH + rebalance rounding table + property tests`** — extend Market enum in types.ts; new `rounding.ts`; tests pass before computeRebalance fills in.
3. **`feat(core): fill in computeRebalance + validateTargetAllocations + property tests`** — pure functions; full coverage of invariants from S2-AC-3.3.
4. **`feat(data-sources): CASH price adapter + registry registration`** — constant 1.0 native; reused by valuation pipeline.
5. **`feat(ui): TargetAllocationForm + DeviationDonut + DeviationBar + RebalanceActionList in @arc/ui/finance`** — presentational only.
6. **`feat(mobile): use-target-allocations + use-rebalance hooks + Insights Tab integration`** — wires UI to data.
7. **`feat(mobile): /insights/rebalance/setup modal + /insights/rebalance/actions screen`** — both routes.
8. **`feat(mobile): /me/cash-balances form + transaction write path for CASH assets`** — entry point for setting cash.
9. **`feat(seed): 4 rebalance scenarios + dev panel registration`** — `rebalance:empty-target` / `:aligned` / `:mild-drift` / `:heavy-drift`.
10. **`docs(spec): sync user-journeys.md J9 (cash slot + rounding + thresholds)`**.

Each commit gates on `pnpm typecheck` + `pnpm lint` + `pnpm test` (the `core` ones run property tests).

---

## Test plan (per `docs/testing-strategy.md`)

| AC                        | Layer(s)                   | Artifact                                                                                    |
| :------------------------ | :------------------------- | :------------------------------------------------------------------------------------------ |
| S2-AC-3.1 setup + persist | L4 + L5                    | `pnpm seed:rb:empty-target` → fill form → cold-restart                                      |
| S2-AC-3.2 sum-to-100      | L4                         | UI: type 99 / 101 / 100 → assert button state + sum-indicator color                         |
| S2-AC-3.3 deviation math  | **L1 property tests**      | `packages/core/__tests__/rebalance.spec.ts` — fast-check generators for invariants          |
| S2-AC-3.4 color tier      | L4                         | `seed:rb:mixed-drift` → assert bars use deviationWarning / deviationCritical tokens         |
| S2-AC-3.5 rounding        | **L1 property tests** + L4 | Property: random holdings → sharesNeeded rounds per-market table; UI: `seed:rb:heavy-drift` |
| S2-AC-3.6 cash slot       | L4 + L1                    | Property: include CASH in computeRebalance fixtures; UI: `seed:rb:with-cash`                |
| S2-AC-3.7 文案铁律        | **L0 lint / grep**         | Add npm script `pnpm lint:copy` that greps locales for forbidden tokens + asserts 0 hits    |
| S2-AC-3.8 multi-currency  | L1 property tests          | Generator covers (USD, CNY, BTC, CASH:HKD) mix with CNY reporting                           |

**Notable**: L0 copy-lint script (S2-AC-3.7) is new infra — small (~30 LOC) but worth landing as part of commit #10. It blocks future regressions where someone localizes "recommend" into a Rebalance string.

---

## Verification checklist before merging back to `main`

- [ ] All 8 S2-AC-3.x acceptance criteria manually verified on iOS sim
- [ ] `pnpm typecheck` 6/6 ✅
- [ ] `pnpm lint` 6/6 ✅
- [ ] `pnpm test` ✅ — `packages/core/__tests__/rebalance.spec.ts` has ≥ 12 passing property tests
- [ ] `pnpm lint:copy` ✅ (new — greps forbidden investment-advice tokens)
- [ ] Migration 0006 applied on dev Supabase (SQL Editor; verify `market_enum` includes CASH + 4 CASH assets present)
- [ ] FAB Sheet entry "导入 CSV" was already removed in Stage 2 reorder — confirm not re-added
- [ ] `docs/user-journeys.md` J9 updated with final cash + rounding + threshold semantics
- [ ] Action list disclaimer "仅供参考，不构成投资建议" visible on both deviation view + action list

---

## Risks + mitigations

| Risk                                                                 | Mitigation                                                                                                  |
| :------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------- |
| Rounding causes `Σ amountNeeded ≠ 0` (sells don't fund buys exactly) | Property test asserts `                                                                                     | Σ amountNeeded | ≤ max(price) × N_assets × 1 share`; UI shows residual as separate "未分配 ¥X" row |
| Multi-currency FX drift between view + action list render            | Both views read from a single `usePortfolioValuation` snapshot held in TanStack cache; no recompute between |
| User sets 100% target on one asset → divide-by-zero in % rendering   | `validateTargetAllocations` allows; `computeRebalance` handles; tested by property                          |
| Forbidden copy slips into action list via translator typo            | `pnpm lint:copy` grep on both locales blocks merge                                                          |
| CASH:USD treated as equity in valuation pipeline (priced at $1)      | CASH adapter returns price=1.0 native; existing FX layer converts to reporting currency cleanly             |
| User has cash but never registers it via BUY CASH:\* → silent miss   | `/me/cash-balances` form linked from Settings + first-time Insights empty-state hint                        |

---

## Resolved tactical decisions (formerly open questions, locked 2026-05-18)

1. **Cash entry UX** — `/me/cash-balances` global form (separation of concerns; cash is portfolio-wide, not rebalance-specific). Insights's empty-state CTA links to it when CASH is missing.
2. **Property test coverage** — Stage 2 Rebalance lands **≥ 12** property tests (deviation math, rounding correctness, multi-currency invariants, sum-to-100 boundary, sign correctness).
3. **`pnpm lint:copy` script** — repo root + pre-push hook integration (CI also runs it). Single grep-based script blocks forbidden investment-advice tokens in both locales.
4. **DeviationDonut** — single Victory Native implementation, rendered on both RN + Web via react-native-web. **Revision cost flagged**: if Web rendering quality is insufficient post-UAT, split to Recharts (Web) + Victory Native (RN) — estimated ~半天 work.
5. **Action list visual** — flat list, sorted by `|amountNeeded|` descending. Grouping by action type rejected (violates 文案铁律 spirit: implies an action verb).
6. **Migration 0006 CASH seed** — INSERT 4 CASH assets via service_role inside the migration, `ON CONFLICT (id) DO NOTHING` for idempotency. Re-runs are safe.

---

## Notes for future stages

- Stage 3 Performance Attribution will read from `target_allocations` for "tracking error" metric
- Stage 3 dedicated `CASH_IN` / `CASH_OUT` transaction types will deprecate the BUY-at-price-1 hack (DB migration adds new enum values; old rows stay valid)
- Stage 3 asset-class taxonomy will add `asset_class` column on `assets` + `target_allocations.asset_class_id` alternative target column (two target schemes supported)
- Stage 4 push notifications: "your portfolio drifted >10% from target — open Arc to see actions"
