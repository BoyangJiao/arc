# Feature: Daily Snapshot (Stage 2 — first feature)

- **Status**: Accepted — all 6 open questions resolved as drafted (BoyangJiao approved 2026-05-17)
- **Author**: Claude Opus 4.7 (draft) + BoyangJiao (review)
- **Created**: 2026-05-17
- **Implements**: `docs/user-journeys.md` J7, `docs/development-plan.md` §七 Stage 2 第 1 块
- **Conforms to**: `.specify/constitution.md` (Decimal everywhere, real-flow integrity), ADR 003 v3.1 (Business tokens), ADR 007 (real-link integrity), ADR 008 (dev market data policy)
- **Touches**: `packages/db` (1 migration), `packages/core` (1 new type + 1 new pure function), `apps/mobile` (1 new hook + 1 page integration + 1 Edge Function), `packages/ui/finance` (1 new component), seed script

---

## Why this feature exists

Until now, the Portfolio Tab shows a static snapshot — the current value, nothing else. Users have no reason to open the app on any given day unless they're making a transaction.

**Daily Snapshot is the hook**: when the user opens the Portfolio Tab, the top of the screen shows what happened today — total change in their reporting currency, percentage move, and the top 3 movers. That answers "should I care about my portfolio right now?" in 2 seconds.

This is also the first place in the app where **gains and losses get a colored visual treatment** — which finally lets us verify S1-AC-5 (red-up / green-down toggle) that we deferred from Stage 1.

Per IA v2.2, this card is the first thing on the Portfolio Tab above all the existing card list. The visual focus of the page shifts from "your total" to "what changed today" — that's the daily-engagement gravity.

---

## User journey (J7, condensed)

**Given** I've been using Arc for at least one full day (a baseline snapshot exists from yesterday)
**And** my portfolio has at least one holding
**When** I open the Portfolio Tab
**Then** I see a Daily Snapshot card at the top showing:

- Today's total change (e.g. `¥+352.20`) — large + colored by gain/loss token
- Today's percentage change (e.g. `+1.23%`)
- Top 3 movers (asset symbol + per-asset change %), sorted by absolute % move
- Subtle disclaimer "仅供参考，可能延迟"

**When** I tap a mover card → no-op for Stage 2 (Stage 3 routes to asset detail). The tap target stays present so muscle memory is built early.

---

## Data model

### New table: `portfolio_value_snapshots`

One row per portfolio per UTC date. The snapshot represents the portfolio's value **at the end of the snapshot day's chosen UTC moment** (see "Snapshot timing" below).

| Column               | Type                                  | Notes                                                                                                                                           |
| :------------------- | :------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                 | `uuid` PK default `gen_random_uuid()` |                                                                                                                                                 |
| `portfolio_id`       | `uuid` FK → `portfolios.id` cascade   |                                                                                                                                                 |
| `snapshot_date`      | `date NOT NULL`                       | UTC calendar date. UNIQUE (portfolio_id, snapshot_date) so re-running cron is idempotent.                                                       |
| `reporting_currency` | `currency_enum NOT NULL`              | Frozen at snapshot time (user might switch later; this stays the historical reading)                                                            |
| `total_value`        | `numeric(28,12) NOT NULL`             | In `reporting_currency`. Decimal-as-string at app layer.                                                                                        |
| `total_cost_basis`   | `numeric(28,12) NOT NULL`             | Same currency.                                                                                                                                  |
| `per_asset`          | `jsonb NOT NULL`                      | Array of `{ assetId, shares, valueNative, currency, valueReporting }` — one entry per held asset at snapshot time. Decimals encoded as strings. |
| `computed_at`        | `timestamptz NOT NULL default now()`  |                                                                                                                                                 |
| `source`             | `text NOT NULL`                       | `'edge-function'` (cron) / `'manual'` (seed / one-off backfill)                                                                                 |

**RLS**: `user_id = auth.uid()` derived via `portfolio_id` join (same pattern as `transactions`). Edge Function uses `service_role` to write across all users — does not use anon key.

**Schema rationale**:

- `per_asset` as JSONB rather than a separate table: Stage 2 only needs to read it for top-3 movers; we don't query per-asset-per-date for historical lines yet. Stage 3 (when we want per-asset history charts) can either keep JSONB + add functional indexes, or migrate to a normalized child table. JSONB defers that choice cheaply.
- `reporting_currency` per row: if the user changes their reporting currency mid-month, old snapshots still reflect the currency they had at the time. New snapshots use the new currency. Daily Snapshot only compares **two consecutive snapshots**, both of which are in the same currency, so the user sees the right number.

### `@arc/core` additions

```ts
// packages/core/src/domain/types.ts
export interface PortfolioDailySnapshot {
  readonly portfolioId: string;
  readonly snapshotDate: string; // YYYY-MM-DD
  readonly reportingCurrency: Currency;
  readonly totalValue: Decimal;
  readonly totalCostBasis: Decimal;
  readonly perAsset: ReadonlyArray<SnapshotAsset>;
  readonly computedAt: string; // ISO
  readonly source: "edge-function" | "manual";
}

export interface SnapshotAsset {
  readonly assetId: string;
  readonly shares: Decimal;
  readonly valueNative: Decimal;
  readonly currency: Currency;
  readonly valueReporting: Decimal;
}

// packages/core/src/snapshot/compute-daily-delta.ts (new)
export interface DailyDelta {
  readonly totalDeltaReporting: Decimal;
  readonly totalDeltaPercent: Decimal;
  readonly movers: ReadonlyArray<AssetDelta>; // already sorted by abs(deltaPercent) desc
  readonly baselineDate: string; // the snapshot we compared against
  readonly currentReportingCurrency: Currency;
  readonly status: "ok" | "no-baseline" | "empty-portfolio";
}

export interface AssetDelta {
  readonly assetId: string;
  readonly deltaReporting: Decimal;
  readonly deltaPercent: Decimal; // 0 if baseline value was 0 (new buy)
  readonly currentValueReporting: Decimal;
}

export const computeDailyDelta = (
  current: PortfolioValuation,
  baseline: PortfolioDailySnapshot | null
): DailyDelta => {
  /* pure function */
};
```

**Pure function**: takes today's `PortfolioValuation` (already computed in Stage 1) + yesterday's `PortfolioDailySnapshot`, returns the delta. No I/O. Property-tested (`packages/core/__tests__/compute-daily-delta.spec.ts`).

---

## Snapshot timing

**Decision**: Daily cron at **23:00 UTC** (= 07:00 北京时间 next day, after US market close, before CN market open).

Why this time:

- US market closes at 21:00 UTC. By 23:00 UTC the closing prices are stable and have made it into `price_snapshots` via user activity during the day.
- 07:00 北京时间 next morning, the user opens the app, sees yesterday's closing snapshot as the comparison baseline — matches their mental model of "what changed yesterday".
- CN market opens 01:30 UTC (09:30 北京). The 23:00 UTC snapshot is captured before any CN intraday activity, so it's a clean end-of-day for CN positions too.

**Tradeoff knowingly accepted**: A user in California (UTC-8) opens the app on Monday morning to see Sunday-night snapshot. That's fine for Stage 2 — multi-timezone refinement is Stage 3+ if it becomes a real complaint.

**Cron implementation** (per ADR 007 §决策三补 pattern):

- GitHub Actions workflow `.github/workflows/daily-snapshot.yml` runs at 23:00 UTC daily
- The workflow calls a Supabase Edge Function `daily-snapshot` with a shared secret in the Authorization header
- The Edge Function iterates portfolios, reads each portfolio's latest known per-asset cached values from `price_snapshots` + `fx_rates` (does NOT call external adapters — uses what's already cached from user activity), computes `PortfolioValuation`, writes a row to `portfolio_value_snapshots`
- Idempotent: `ON CONFLICT (portfolio_id, snapshot_date) DO UPDATE` — re-running the workflow on the same day overwrites the row

**Why not hit Alpha Vantage from the Edge Function**:

- 25/day quota would be obliterated as soon as we have a handful of holdings × users
- The cache already holds quotes pushed there by user activity throughout the day; if it's stale, the snapshot reflects whatever we knew at close time, which is still meaningful
- Stage 4 can introduce a Polygon / paid tier and switch the Edge Function to "force fresh" — out of Stage 2 scope

---

## Architecture

### Data flow

```
                   ┌─────────────────────────────────────┐
                   │  daily 23:00 UTC GitHub Actions     │
                   │  → POST /functions/v1/daily-snapshot│
                   └────────────────┬────────────────────┘
                                    │ service_role auth
                                    ▼
              ┌──────────────────────────────────────────┐
              │  Supabase Edge Function `daily-snapshot` │
              │  for each portfolio:                     │
              │    read price_snapshots + fx_rates       │
              │    computePortfolioValuation (from @arc/core)
              │    upsert portfolio_value_snapshots row  │
              └──────────────────────────────────────────┘

                          (one day later)

                  ┌─────────────────────────────────┐
                  │ User opens Portfolio Tab        │
                  └────────────┬────────────────────┘
                               ▼
        usePortfolioValuation (current)   useDailySnapshot (baseline)
                       │                            │
                       └──────┬─────────────────────┘
                              ▼
                  computeDailyDelta (pure)
                              ▼
                  <DailySnapshotCard>  (renders if status === 'ok')
```

### New code locations

| File                                                                | Role                                                                                                  |
| :------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------- |
| `packages/db/drizzle/schema/portfolio-value-snapshots.ts`           | Drizzle schema + UNIQUE constraint                                                                    |
| `packages/db/drizzle/migrations/0003_portfolio_value_snapshots.sql` | Generated; includes RLS policy                                                                        |
| `packages/core/src/domain/types.ts` (extend)                        | `PortfolioDailySnapshot`, `SnapshotAsset`, `DailyDelta`, `AssetDelta` types                           |
| `packages/core/src/snapshot/compute-daily-delta.ts`                 | Pure function — top-3 mover sorting, delta math                                                       |
| `packages/core/__tests__/compute-daily-delta.spec.ts`               | Property tests: signs, percentage zero-baseline, empty portfolio, missing assets, sorting stability   |
| `apps/mobile/src/lib/queries/use-daily-snapshot.ts`                 | TanStack Query hook: read `portfolio_value_snapshots` for (portfolioId, latest snapshot before today) |
| `apps/mobile/src/lib/queries/use-daily-delta.ts`                    | Composes `usePortfolioValuation` + `useDailySnapshot` + `computeDailyDelta`                           |
| `packages/ui/src/finance/DailySnapshotCard.tsx`                     | New presentational card (T2 finance layer per ADR 006)                                                |
| `packages/ui/src/finance/index.ts`                                  | re-export                                                                                             |
| `apps/mobile/app/(tabs)/index.tsx`                                  | Insert `<DailySnapshotCard>` above the portfolio card list                                            |
| `packages/i18n/src/locales/{en,zh}.ts`                              | 7-10 new strings (card title, mover list, empty states)                                               |
| `supabase/functions/daily-snapshot/index.ts`                        | Edge Function (Deno runtime); reuses Drizzle schema types via shared TypeScript                       |
| `.github/workflows/daily-snapshot.yml`                              | Cron workflow; requires repo secret `SUPABASE_DAILY_SNAPSHOT_SECRET`                                  |
| `tools/seed-dev-data.ts`                                            | Extend to seed one yesterday-snapshot per portfolio so dev sees the card immediately                  |

### Where everything else stays unchanged

- `usePortfolioValuation` keeps its existing contract; we just add a sibling hook
- `DailySnapshotCard` is presentational — receives `DailyDelta` as a prop, no internal data fetching
- `computeDailyDelta` is pure — no React, no TanStack Query, no I/O, fully testable
- Adapter-mode toggle (ADR 008) applies as usual: in fixture mode, current valuation comes from fixture; baseline snapshot is whatever the seed script wrote. In live mode, current is real-time; baseline comes from Edge Function runs.

---

## UI contract

### Layout (Portfolio Tab top, above existing avatar + portfolio cards)

```
┌─────────────────────────────────────────────────┐
│ 今日变动                                          │
│ ¥+352.20                          gain color    │
│ +1.23% · 仅供参考                                 │
│                                                 │
│ ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│ │ NVDA     │  │ AAPL     │  │ MSFT     │        │
│ │ +3.21%   │  │ +1.05%   │  │ -0.42%   │        │
│ └──────────┘  └──────────┘  └──────────┘        │
└─────────────────────────────────────────────────┘
```

### States

| Condition                                            | Rendering                                                                                    |
| :--------------------------------------------------- | :------------------------------------------------------------------------------------------- |
| **Default (`status === 'ok'`)**                      | Full card as above. Top number colored via `useBusinessClasses().gain.text` or `.loss.text`. |
| **No baseline (`status === 'no-baseline'`)**         | Card with placeholder: "首次启动，明日开始追踪每日变动" — keeps real estate consistent.      |
| **Empty portfolio (`status === 'empty-portfolio'`)** | Card not rendered at all. Falls back to existing empty-portfolio CTA underneath.             |
| **Baseline older than 24h** (e.g. user gone 3 days)  | Card renders normally but with subtle "对比自 N 天前" label below the percentage.            |
| **Quote missing for one of today's holdings**        | Asset excluded from the mover list; delta + percent reflect what we could compute.           |
| **Live fetch in progress, baseline cached**          | Show baseline values (won't flicker on transient refetch).                                   |
| **No movers (e.g. only 1 holding, percentage = 0)**  | Hide the mover row, show just the top number + percentage.                                   |

### Mover sorting

**By absolute percentage move, descending**. Per the open question in `user-journeys.md` ("按金额变动还是百分比变动排"), percentage is the better Stage 2 default because:

- A 0.1% move on a $100K position dominates a 5% move on a $1K position by amount, but the 5% move is more "news"
- For a Stage 2 user with ≤10 holdings, percentage-sorted is more intuitive
- Stage 3 can offer a setting if it matters

### Color rules

- Top number + percentage: `gain.text` (positive) / `loss.text` (negative) / `pnlNeutral.text` (exactly 0)
- Mover chip percentages: same scheme, individually per mover (so the card shows mixed colors)
- All via `useBusinessClasses()` from `@arc/ui`. Foundation `text-success` / `text-danger` direct usage is forbidden as always (ESLint).

### Interaction

- Each mover chip is `Pressable` with `onPress={() => router.push(`/asset/${assetId}`)}` — **but the route doesn't exist yet in Stage 2**. We log to console in dev (`[daily-snapshot] tap ${assetId} — asset detail lands in Stage 3`) and otherwise no-op. Building the muscle memory + reserving the tap target is intentional.

---

## Acceptance criteria (S2-AC-1 for use in `stage-acceptance-criteria.md`)

### S2-AC-1.1 — Baseline + current → correct delta

**Given** there is a `portfolio_value_snapshots` row for my portfolio dated yesterday with `total_value = ¥10000`
**And** my current valuation is `¥10500`
**When** I open Portfolio Tab
**Then** the Daily Snapshot card shows `¥+500.00` and `+5.00%`
**And** all values are Decimal (no floating-point rounding in the visible string)

### S2-AC-1.2 — First-day placeholder

**Given** I am a brand-new user with no prior snapshot
**And** my portfolio has at least one holding from today
**When** I open Portfolio Tab
**Then** the Daily Snapshot card renders the placeholder copy ("首次启动…")
**And** does not render the top number / movers

### S2-AC-1.3 — Empty portfolio

**Given** I have a portfolio but no transactions
**When** I open Portfolio Tab
**Then** the Daily Snapshot card is NOT rendered (the existing empty-state CTA shows instead)

### S2-AC-1.4 — Top 3 mover sort

**Given** I have 5 holdings with the following per-asset percentage moves: AAPL +0.5%, MSFT -3%, NVDA +8%, HOOD -1%, TSLA +0.2%
**When** I open Portfolio Tab
**Then** the movers are shown in order: NVDA (8% green), MSFT (3% red), HOOD (1% red)
**And** AAPL + TSLA are not shown

### S2-AC-1.5 — Red-up/green-down toggle (verifies S1-AC-5)

**Given** my portfolio has both positive and negative movers
**And** I have set finance color mode to `greenUpRedDown`
**When** I open Portfolio Tab
**Then** positive deltas (top number + green-mover chips) are green
**When** I navigate to `/me/settings` and toggle to `redUpGreenDown`
**Then** the SAME card without remount immediately swaps colors: positives red, negatives green
**And** the Foundation tokens `success` / `danger` remain unchanged (green / red respectively)

### S2-AC-1.6 — Snapshot cron writes idempotently

**Given** the daily-snapshot Edge Function has already run today and written a row
**When** the workflow runs again (e.g. retry, accidental double-trigger)
**Then** the row is updated, not duplicated (UNIQUE constraint + `ON CONFLICT … DO UPDATE`)
**And** no errors occur

### S2-AC-1.7 — No external API calls during cron

**Given** the daily-snapshot Edge Function is running
**When** I inspect its outbound traffic
**Then** there are zero calls to Alpha Vantage / Frankfurter / any external market data API
**And** all per-asset prices come from existing `price_snapshots` rows
**And** all FX rates come from existing `fx_rates` rows
**(rationale: cost + quota; we don't introduce a new external dependency)**

---

## Out of scope (Stage 2 explicitly NOT doing)

- **Asset detail route on tap**: the tap target exists but is a no-op. Stage 3 builds `/asset/[id]`.
- **Historical view** (last 7 days / last 30 days deltas): Stage 3, requires charts. We're laying the snapshot foundation here.
- **Sparkline chart inside the card**: same as above.
- **Push notification when a big move happens**: Stage 4.
- **Realized P&L vs unrealized P&L distinction**: Stage 3.
- **Multi-timezone per-user snapshot times**: see "Snapshot timing" — we use a single global UTC time.
- **Force-fresh prices during snapshot**: snapshot uses existing cache. Live freshness is a Stage 4 paid-tier concern.
- **Snapshot retention policy**: we store forever for now. Stage 3 may add a 1-year retention with monthly rollup if storage cost becomes real (it won't for ≤100 users).
- **AC-1.5 user-journeys "tap mover routes to detail"** — confirmed deferred; only the tap target is reserved.

---

## Implementation plan (recommended commit order)

Each step is independently shippable + has a passing test gate at end:

1. **`feat(db): add portfolio_value_snapshots schema + RLS + migration 0003`** — Drizzle schema + generated SQL + apply to dev Supabase. No app code yet.
2. **`feat(core): PortfolioDailySnapshot type + computeDailyDelta pure function + property tests`** — fully testable in isolation, doesn't depend on app or Edge Function.
3. **`feat(ui): DailySnapshotCard presentational component in @arc/ui/finance`** — Storybook-style: takes `DailyDelta` prop, renders all 4 states. No data fetching.
4. **`feat(mobile): use-daily-snapshot + use-daily-delta hooks + Portfolio Tab integration`** — wires the card to real data (still uses fake baseline for now since cron isn't there yet).
5. **`feat(supabase): daily-snapshot Edge Function + auth check`** — Deno function lives in `supabase/functions/`. Manually invokable for testing.
6. **`feat(ci): daily-snapshot GitHub Actions workflow + secret`** — cron schedule, calls Edge Function. Manual `workflow_dispatch` for testing.
7. **`feat(seed): extend pnpm seed:dev to also seed a yesterday snapshot`** — so dev sees the card immediately without waiting 24h.
8. **`docs(adr-009): Daily snapshot — design + tradeoffs`** _(optional)_. If we decide the snapshot timing / no-external-call decision deserves long-term documentation, write the ADR after the implementation has settled. **Skip if not needed.**

After step 7, S2-AC-1.1–1.7 should pass end-to-end manually. After step 6 lands on `main`, the cron will start writing real snapshots; from then on the card transitions from "seeded" baseline to "real" baseline naturally.

---

## Open questions for your review

1. **Snapshot timing — 23:00 UTC** (= 07:00 北京 next day). OK with you? Alternative: 16:00 UTC (= 24:00 北京) which is right at midnight 北京 but US market is still open. I prefer 23:00 UTC because US close has settled by then.

2. **Mover sort — by absolute percentage** (current proposal) vs by absolute amount. Percentage is in `user-journeys.md` open question; I'm voting percentage but it's a product call.

3. **Card placement: above or below the portfolio top-value section?** I'm proposing above (so daily change becomes the new "primary signal"). Alternative is below the total, which keeps "total value" as the hero. **This is the biggest visual decision in this feature.**

4. **`per_asset` as JSONB vs. normalized table** — I'm voting JSONB for Stage 2 simplicity (defer normalization to Stage 3 when we want per-asset charts). Are you OK with that trade-off?

5. **Edge Function uses ONLY cached prices/FX** — never calls Alpha Vantage. The downside: if no user opened the app on a given day, the cache might be very stale. I'm voting this is acceptable for Stage 2 (a snapshot of "what we last knew" is still meaningful and the user will see a small "数据较旧" hint we'll add via the staleness check on `computed_at`). OK?

6. **Should we land ADR-009 for the snapshot timing decision** (step 8)? My take: yes, snapshot timing is a multi-stage decision (Stage 3 might revisit per-user TZ, Stage 4 might revisit "force fresh"), so an ADR locks the current decision + rationale. Or we just leave it in this feature spec and write the ADR only if it becomes contentious. **Slight preference: write the ADR now to anchor the rationale.**

---

## Verification checklist before merging back to `main`

- [ ] All 7 S2-AC-1.x acceptance criteria manually verified on iOS sim
- [ ] `pnpm typecheck` 6/6 ✅
- [ ] `pnpm lint` 6/6 ✅
- [ ] `pnpm test` ✅ (core gains property tests for `computeDailyDelta`)
- [ ] Edge Function deployed to Supabase + GitHub Actions secret configured
- [ ] One real `daily-snapshot` cron run observed (via `workflow_dispatch`) and a real row appears in `portfolio_value_snapshots`
- [ ] S1-AC-5 (red-up/green-down toggle, previously deferred) verified via this card
