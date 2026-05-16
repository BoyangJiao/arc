# Stage Acceptance Criteria (BDD format)

> Per-Stage Definition of Done in Given/When/Then format.
> Sourced from `docs/development-plan.md` §七 + `docs/user-journeys.md`.
> Each criterion ties back to a specific journey (J\*).

---

## Stage 0 — Pre-flight

**Given** I'm a new contributor to Arc
**When** I run `pnpm install` from a fresh clone
**Then** all dependencies install without errors
**And** `pnpm typecheck` passes 6/6
**And** `pnpm --filter @arc/mobile web` starts successfully

---

## Stage 1 — MVP-0 端到端骨架

### S1-AC-1 — First-time login (J1)

**Given** the app is opened for the first time
**When** I enter my email and tap "发送登录链接"
**Then** I see "请检查邮箱" feedback
**And** clicking the magic link in my email logs me in
**And** I land on `/(tabs)/index` with a default portfolio "My Portfolio" auto-created
**And** the portfolio shows "暂无持仓"

### S1-AC-2 — Add first transaction (J2 — core MVP-0 DoD)

**Given** I'm on `/portfolio/[id]` with an empty portfolio
**When** I tap FAB → 手动添加交易
**And** I enter AAPL, buy, today, 10 shares, $180.00 USD, no fee
**And** I tap 保存
**Then** the modal closes and the portfolio detail refreshes
**And** the holdings table shows: `AAPL — 10 — $180.00 — $1,800.00 — ¥12,960.00`
**And** the top displays total market value `¥12,960.00`
**And** there is a "仅供参考，可能延迟" disclaimer
**And** all numerical operations used `Decimal` (no `number`)

### S1-AC-3 — Switch reporting currency (J3)

**Given** I'm on `/portfolio/[id]` showing `¥12,960.00`
**When** I navigate to `/me/settings` and change reporting currency from CNY to USD
**Then** returning to portfolio shows `$1,800.00`
**And** the holdings table "市值" column changes from `¥` to `$`
**And** the "单价" column stays `$180.00 USD` (transaction-currency)
**And** there are no rounding errors

### S1-AC-4 — Switch language (J4)

**Given** any page is open
**When** I switch language from 中文 to English in settings
**Then** all visible text on all 5 pages + 1 modal + Me screen is in English
**And** zero Chinese strings remain
**And** zero `t('xxx.yyy')` placeholder text appears

### S1-AC-5 — Switch red-up/green-down theme (J5)

**Given** the portfolio has positive and negative day-change values
**When** I toggle "涨跌色" to "红涨绿跌" in settings
**Then** positive change values turn red
**And** negative change values turn green
**And** Foundation tokens (`success` stays green, `danger` stays red) are unaffected
**And** Business token mapping (`gain` → `danger`, `loss` → `success`) takes effect via `useBusinessTokens()` hook

### S1-AC-6 — Build & deploy

**Given** Stage 1 code is complete
**When** I run `pnpm --filter @arc/mobile web` and `expo export`
**Then** Web build succeeds
**And** `pnpm typecheck` passes
**And** `pnpm test` passes (property tests for Decimal / FX round-trip / holdings purity)
**And** TestFlight build can be installed on a physical iPhone

---

## Stage 2 — 让 3 Tab 真正跑起来

### S2-AC-1 — First-launch welcome (J6)

**Given** I'm a brand-new user completing J1 for the first time
**When** I land in the app post-login
**Then** I see `/welcome` first (1-screen, 30-sec intro)
**And** I can either tap "添加第一笔资产" or 跳过
**And** subsequent launches do not show `/welcome` again
**And** `userPreferences.hasSeenWelcome = true` is persisted

### S2-AC-2 — Daily snapshot (J7)

**Given** I have ≥1 holding and a 24h-old portfolio_value_snapshot exists
**When** I open Portfolio Tab
**Then** the top of `/(tabs)/index` shows a Daily Snapshot card with:

- Today's total change (e.g. `¥+352.20`)
- Today's percent change (e.g. `+1.23%`, colored via Business token `gain` / `loss`)
- Top 3 movers (asset symbol + change %)
  **And** the change colors respect user's red-up/green-down preference

### S2-AC-3 — Watchlist (J8)

**Given** Markets Tab is empty
**When** I tap "搜索添加自选" and search NVDA, then tap to add
**Then** the watchlist persists across app restart
**And** duplicate addition is silently no-op
**And** real-time price refreshes within 5 seconds

### S2-AC-4 — First Rebalance setup (J9)

**Given** I have ≥2 holdings
**When** I open Insights Tab and tap "设置首次目标配置"
**And** I assign target percentages summing to 100%
**And** I save
**Then** I see a deviation comparison view
**And** deviations 5-10% use `deviation-warning` color
**And** deviations >10% use `deviation-critical` color
**And** the actions panel says "达到目标配置需要的份额变化为 +X" (NOT "建议买入")

### S2-AC-5 — CSV import (J10)

**Given** I have a valid CSV file with ≥100 transaction rows
**When** I tap FAB → 导入 CSV → confirm preview
**Then** import completes in <10 seconds
**And** all rows pass validation
**And** invalid rows highlight with specific error messages

---

## Stage 3 — MVP-1 自用版（J11-J16）

Listed as future criteria; details TBD when Stage 3 begins.

Key DoD anchors:

- TWR error vs Snowball/Tonghuashun < 1% (3 sample assets)
- Multi-market load (≥10 transactions across 5 markets) renders <2s
- All 5 markets' adapters resilient to single-source failure (fallback to "价格暂不可用")

---

## Stage 4 — MVP-2 闭门测试 + 连接协作

Key DoD anchors (J17-J20):

- AI screenshot import accuracy ≥90% on 3 mainstream sources (支付宝 / 同花顺 / 盈透)
- ≥10 seed users active for ≥4 weeks
- ≥5 users use the app ≥2× per week
- 0 P0 / P1 issues open at end of stage

---

## Stage 5 — V1.0 公开发布

Key DoD anchors:

- App Store + ≥1 国内 Android 商店上架成功
- Pro 订阅完成首单（含自购）
- 官网可访问，SEO 元数据齐全
- AI prompt-caching 默认启用 + 文案铁律 100% 通过 evals
- Onboarding 完整版上线

---

## How to use this document

- **PR review checklist**: locate the relevant S*-AC-* criterion; verify all 3 layers (Given/When/Then) are met
- **Stage gate**: at end of each Stage, run through every criterion manually + automated tests
- **AI agent task input**: when implementing a journey, AI should re-read its corresponding AC before starting

## Maintenance

- Edit when journey definition changes (in sync with `docs/user-journeys.md`)
- Add new criteria when adding new journeys
- Don't delete completed criteria; mark them ✅ at Stage gate review
