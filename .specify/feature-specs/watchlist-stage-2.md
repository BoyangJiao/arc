# Feature: Watchlist (Stage 2 — second feature)

- **Status**: Accepted — all 6 open questions resolved as drafted (BoyangJiao approved 2026-05-18)
- **Author**: Claude Opus 4.7 (draft) + BoyangJiao (review)
- **Created**: 2026-05-18
- **Implements**: `docs/user-journeys.md` J8, `docs/development-plan.md` §七 Stage 2 第 2 块
- **Conforms to**: `.specify/constitution.md` (Decimal everywhere, real-flow integrity), ADR 003 v3.1 (Business tokens), ADR 006 (`@arc/ui` layering), ADR 007 (real-link integrity), ADR 008 (dev market data policy)
- **Touches**: `packages/db` (1 migration), `packages/core` (1 new type), `packages/data-sources` (Alpha Vantage `SYMBOL_SEARCH` endpoint), `packages/ui/finance` (1 new component family), `apps/mobile` (2 new routes + 2 new hooks), seed script (3 new scenarios), i18n (~12 new strings)

---

## Why this feature exists

The Markets Tab is currently a "coming soon" empty state. Daily-Snapshot proved the engagement hook for **owned** positions; **Watchlist** is the engagement hook for positions the user is **considering or tracking but doesn't own**.

This unlocks the "windowshop without committing a transaction" use case — the user can park NVDA / TSLA / a fund they're researching, and casually see how it moved without polluting their portfolio with hypothetical positions.

This is also where the Alpha Vantage `SYMBOL_SEARCH` endpoint enters the codebase, paving the way for Stage 3 transaction-entry autocomplete.

---

## User journey (J8, condensed)

**Given** I want to follow a symbol I don't own
**When** I tap Markets Tab
**Then** I see my watchlist (or an empty state with a primary "搜索添加自选" CTA)

**When** I tap "搜索添加自选" → `/markets/search` modal opens
**And** I type `NVDA`
**Then** Alpha Vantage `SYMBOL_SEARCH` returns matches (debounced 350ms)
**When** I tap NVDA → it's added to my watchlist + modal closes
**Then** Markets Tab shows the new row with current price + percentage change since previous close

**When** I swipe-left on a watchlist row → "移除"
**Then** the row leaves with an animation; persisted state updates

---

## Resolved decisions (formerly open questions, locked 2026-05-18)

1. **Search backend** — **Path B**: static Top-200 US tickers JSON in `packages/data-sources/`, AV `SYMBOL_SEARCH` as fallback only when the static list has zero matches. Protects the 25/day AV free-tier quota for watchlist quote refresh (the higher-value spend).
2. **Cross-market** — Stage 2 = US only. Search modal explicitly labels "Stage 2 仅支持美股，更多市场即将推出". A 股 / 港股 / 基金 / 加密 wait for Stage 3 (Tushare + CoinGecko).
3. **Refresh cadence** — Cache TTL = 5 minutes for watchlist quotes; pull-to-refresh bypasses cache; tab focus = cache check only (no forced fetch). `user-journeys.md` J8 must drop the "5s 内刷新" claim as part of commit step 8.
4. **Watchlist row tap** — Stage 2 = no-op + dev console log (mirror of Daily-Snapshot mover pattern). Swipe-left = remove. Asset detail route lands in Stage 3.
5. **Reordering** — chronological by `added_at desc` (most recent at top). No drag-to-reorder until Stage 3+.
6. **Search-result interaction** — single-tap = add + close modal. Long-press preview chart deferred to Stage 3+.

---

## Data model

### New table: `watchlist_items`

| Column     | Type                                  | Notes                                   |
| :--------- | :------------------------------------ | :-------------------------------------- |
| `id`       | `uuid` PK default `gen_random_uuid()` |                                         |
| `user_id`  | `uuid` NOT NULL FK → `auth.users`     | ON DELETE CASCADE                       |
| `asset_id` | `text` NOT NULL FK → `assets.id`      | `market:symbol` format (e.g. `US:NVDA`) |
| `added_at` | `timestamptz NOT NULL default now()`  | Sort key for "most recent at top"       |

**Indexes / constraints**:

- `UNIQUE (user_id, asset_id)` — same asset cannot be added twice
- Index on `(user_id, added_at desc)` for the Markets Tab list query

**RLS**:

- SELECT / INSERT / DELETE: `user_id = auth.uid()`
- UPDATE: not allowed (no editable columns)

**Why FK to `assets.id`, not loose text**: ensures Stage 2 search flow always upserts the asset row first, so we never end up with a watchlist pointing at a phantom symbol. Cleanup on asset deletion is automatic via CASCADE.

### Migration 0004

File: `packages/db/drizzle/migrations/0004_watchlist_items.sql`
Mirror the 0003 RLS pattern; the only differences are the table shape and the all-CRUD-via-user-jwt policy (no service-role-only writes here, since users add their own items).

### `@arc/core` additions

Minimal — Watchlist is mostly an app + adapter concern. Just one new domain type to encapsulate the read shape:

```ts
// packages/core/src/domain/watchlist.ts
import type { Decimal } from "decimal.js";
import type { Asset } from "./types";

export interface WatchlistRow {
  readonly id: string;
  readonly addedAt: string; // ISO
  readonly asset: Asset;
  readonly quote: {
    readonly price: Decimal;
    readonly currency: Currency;
    readonly changePercent: Decimal | null; // null if previous close unknown
    readonly asOf: string; // ISO
    readonly stale: boolean; // true if last update > 5 min ago
  } | null; // null until first quote lands
}
```

Pure type; no compute function needed at this layer — sort and filter live in the TanStack hook.

---

## Architecture

### New code locations

| File                                                                 | Role                                                                              |
| :------------------------------------------------------------------- | :-------------------------------------------------------------------------------- |
| `packages/db/drizzle/schema/watchlist-items.ts`                      | Drizzle schema + indexes + RLS                                                    |
| `packages/db/drizzle/migrations/0004_watchlist_items.sql`            | Generated                                                                         |
| `packages/core/src/domain/watchlist.ts`                              | `WatchlistRow` type                                                               |
| `packages/data-sources/src/adapters/alphavantage.ts`                 | Add `searchSymbols(query: string): Promise<SymbolSearchResult[]>`                 |
| `packages/data-sources/src/interfaces.ts`                            | Extend `PriceAdapter` with optional `searchSymbols?` (Stage 2 US-only)            |
| `packages/data-sources/src/static-symbols.ts`                        | (If Open Question 1 = B) Top-200 US tickers JSON                                  |
| `apps/mobile/src/lib/queries/use-watchlist.ts`                       | List + add + remove TanStack hooks                                                |
| `apps/mobile/src/lib/queries/use-watchlist-quotes.ts`                | Per-row quote fetch via PriceCache; 5-min TTL                                     |
| `apps/mobile/src/lib/queries/use-symbol-search.ts`                   | Debounced search hook                                                             |
| `packages/ui/src/finance/WatchlistRow.tsx`                           | Presentational row: symbol / name / price / change% chip                          |
| `packages/ui/src/finance/WatchlistEmptyState.tsx`                    | Empty state with primary CTA                                                      |
| `apps/mobile/app/(tabs)/markets.tsx`                                 | Replace empty-state stub; render list + FAB                                       |
| `apps/mobile/app/markets/search.tsx`                                 | New modal route (presentation: modal); TextField + result list                    |
| `packages/i18n/src/locales/{en,zh}.ts`                               | ~12 strings (titles, empty CTA, search placeholder, market-scope hint)            |
| `tools/seed-dev-data.ts` + `supabase/functions/_shared/seed-core.ts` | 3 new scenarios: `watchlist:empty`, `watchlist:3-items`, `watchlist:stale-quotes` |

### Data flow

```
            ┌────────────────────────────────┐
            │ Markets Tab (markets.tsx)      │
            └───────────────┬────────────────┘
                            ▼
                  useWatchlist (list)
                            ▼
              ┌─────────────┴─────────────┐
              │     watchlist_items       │
              │     joined to assets       │
              └─────────────┬─────────────┘
                            ▼
                useWatchlistQuotes (per row)
                            ▼
             PriceCache.get (5-min TTL)
                            │ miss
                            ▼
              AV adapter (fetchLatest)
                            ▼
                  PriceCache.set


            ┌────────────────────────────────┐
            │ Search modal (search.tsx)      │
            └───────────────┬────────────────┘
                            ▼
                  useSymbolSearch
                       (debounced)
                            ▼
       static-symbols.ts (preferred, no quota)
                            │ zero matches
                            ▼
        AV adapter.searchSymbols (counts 1 call)
                            ▼
              Tap result → upsertAsset(asset)
                       → insert watchlist_items
                       → close modal
```

---

## UI contract

### Markets Tab (when populated)

```
┌─────────────────────────────────────────────────┐
│ 自选                                              │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ NVDA      Nvidia            $875.42  +3.21% │ │
│ │ AAPL      Apple             $189.50  -0.42% │ │
│ │ MSFT      Microsoft         $420.30  +1.05% │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│              [ + 搜索添加自选 ]                   │
└─────────────────────────────────────────────────┘
```

- Row swipe-left → 移除 confirm
- Pull-to-refresh on the list → force-fresh quotes (bypasses 5-min cache)
- Stale quote (> 5 min): subtle "·" indicator next to price

### Markets Tab (empty)

```
┌─────────────────────────────────────────────────┐
│                                                 │
│            [ icon: TrendingUp ]                 │
│           还没有自选                              │
│       搜索一个标的，开始追踪它的行情                  │
│                                                 │
│             [ + 搜索添加自选 ]                    │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Search modal (`/markets/search`)

```
┌─────────────────────────────────────────────────┐
│ Cancel                                          │
│ ┌─────────────────────────────────────────────┐ │
│ │  🔍  搜索标的（如 NVDA / AAPL）...            │ │
│ └─────────────────────────────────────────────┘ │
│ Stage 2 仅支持美股，更多市场即将推出                │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ NVDA      Nvidia Corporation             [+]│ │
│ │ NVDS      Direxion Daily NVDA Bear 1X    [+]│ │
│ │ ...                                          │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

- Already-in-watchlist results show ✓ instead of `+`, and tapping is a no-op (toast: 已在自选)
- Empty query → no list (don't pre-populate)
- API error → "搜索暂不可用，请稍后再试" inline; do NOT silently consume the tap

### Color rules

- Change% chip: `gain.text` / `loss.text` / `pnlNeutral.text` (zero) via `useBusinessClasses()`
- Stale dot: foundation `text-muted-foreground`
- Foundation token direct use forbidden as always (ESLint)

---

## Acceptance criteria (S2-AC-2.x)

### S2-AC-2.1 — Add + persist

**Given** my watchlist is empty
**When** I open `/markets/search`, type "NVDA", tap the NVDA result
**Then** the modal closes
**And** Markets Tab shows a NVDA row with current price
**When** I cold-restart the app
**Then** the NVDA row is still there

### S2-AC-2.2 — Dedup

**Given** NVDA is in my watchlist
**When** I open search, type "NVDA", and tap the result
**Then** the tap is a no-op + I see a toast "已在自选"
**And** there is still exactly one NVDA row

### S2-AC-2.3 — Remove

**Given** my watchlist has 3 items
**When** I swipe-left on the middle row and tap 移除
**Then** the row animates out + persists removal
**And** the asset row in `assets` is unchanged (only `watchlist_items` row deleted)

### S2-AC-2.4 — Quote refresh respects cache TTL

**Given** I have NVDA in my watchlist and a fresh quote was written 30 seconds ago
**When** Markets Tab gains focus
**Then** the displayed price equals the cached price
**And** zero new Alpha Vantage HTTP calls are made

**Given** the cached quote is 6 minutes old
**When** Markets Tab gains focus
**Then** the AV adapter is called once
**And** the new quote is persisted to `price_snapshots`

### S2-AC-2.5 — Pull-to-refresh bypasses cache

**Given** my watchlist has 2 items and the cached quotes are 30 seconds old
**When** I pull-to-refresh the list
**Then** both AV adapters are invoked (2 calls counted)
**And** rows update with fresh prices

### S2-AC-2.6 — Empty state CTA

**Given** my watchlist is empty
**When** I open Markets Tab
**Then** I see the empty illustration + primary CTA
**When** I tap the CTA
**Then** `/markets/search` modal opens

### S2-AC-2.7 — Color rules + S1-AC-5 (red-up/green-down) again

**Given** my watchlist has a green mover and a red mover
**When** I toggle finance color mode in Settings
**Then** all change% chips swap color schemes without unmount

### S2-AC-2.8 — Search degrades gracefully

**Given** my AV API key is rate-limited (HTTP 429 from `SYMBOL_SEARCH`)
**When** I type a query that misses the static list
**Then** I see an inline "搜索暂不可用，请稍后再试" message
**And** previous results (if any) stay visible — no silent clear

---

## Out of scope (Stage 2 explicitly NOT doing)

- Asset detail route on tap (Stage 3 — same as Daily-Snapshot mover)
- Drag-to-reorder (Stage 3)
- Cross-market search (A股 / 港股 / 基金 / 加密) — Stage 3 with Tushare + CoinGecko
- Sparkline / mini-chart on row (Stage 3, needs intraday data)
- Price alerts / push notifications (Stage 4)
- Long-press preview chart on search result (Stage 3+)
- Background quote refresh (Stage 4 + push notifications)
- Watchlist groupings or folders (post-MVP)

---

## Implementation plan (recommended commit order)

1. **`feat(db): watchlist_items schema + RLS + migration 0004`**
2. **`feat(core): WatchlistRow type`**
3. **`feat(data-sources): Alpha Vantage searchSymbols + static-symbols fallback`** (+ unit test for fallback path)
4. **`feat(ui): WatchlistRow + WatchlistEmptyState in @arc/ui/finance`**
5. **`feat(mobile): use-watchlist + use-watchlist-quotes + Markets Tab integration`**
6. **`feat(mobile): /markets/search modal + use-symbol-search hook`**
7. **`feat(seed): 3 watchlist scenarios in seed-core + CLI shortcuts`**
8. **`docs(spec): update user-journeys.md J8 (drop "5s" refresh; document cache TTL)`**

Each step independently shippable + has a passing test gate.

---

## Test plan (per `docs/testing-strategy.md`)

| AC                         | Layer(s) | Artifact / how to run                                       |
| :------------------------- | :------- | :---------------------------------------------------------- |
| S2-AC-2.1 add + persist    | L4 + L5  | `pnpm seed:wl:empty` → search → add → cold-restart          |
| S2-AC-2.2 dedup            | L4 + L1  | UI flow + property test on `addWatchlist(items, candidate)` |
| S2-AC-2.3 remove           | L4       | `pnpm seed:wl:3-items` → swipe-left                         |
| S2-AC-2.4 cache TTL        | L1 + L4  | Unit test on hook; UI verifies via debug counter overlay    |
| S2-AC-2.5 pull-to-refresh  | L4       | `pnpm seed:wl:stale-quotes` → pull → assert AV call count   |
| S2-AC-2.6 empty CTA        | L4       | `pnpm seed:wl:empty`                                        |
| S2-AC-2.7 red/green toggle | L4       | `pnpm seed:wl:3-items` with mixed movers; Settings toggle   |
| S2-AC-2.8 search degraded  | L1 + L4  | Mock AV 429; assert inline error + results untouched        |

---

## Verification checklist before merging back to `main`

- [ ] All 8 S2-AC-2.x acceptance criteria manually verified on iOS sim
- [ ] `pnpm typecheck` 6/6 ✅
- [ ] `pnpm lint` 6/6 ✅
- [ ] `pnpm test` ✅ (data-sources gains search fallback test; core gains dedup property test)
- [ ] Alpha Vantage daily quota dashboard checked — no exhaustion seen during UAT
- [ ] `user-journeys.md` J8 updated (drop "5s" claim)
