# Feature: Welcome (Stage 2 — fourth & final feature)

- **Status**: Accepted — 4 tactical decisions locked (BoyangJiao approved 2026-05-19)
- **Author**: Claude Opus 4.7 (draft) + BoyangJiao (review)
- **Created**: 2026-05-18
- **Positioning**: Minimal viable placeholder + Stage 5 foundation. Stage 5 will replace single screen with multi-step onboarding carousel; the `has_seen_welcome` boolean and routing gate survive the upgrade.
- **Implements**: `docs/user-journeys.md` J6, `docs/development-plan.md` §七 Stage 2 第 4 块
- **Conforms to**: `.specify/constitution.md` (文案铁律), ADR 006 (`@arc/ui` layering)
- **Touches**: `apps/mobile` (1 new route + light routing logic), `packages/i18n` (~6 strings), one tiny preference flow

---

## Why this feature exists

After J1 magic-link sign-in lands, a new user goes straight to the Portfolio Tab — which is empty. There's no orientation, no sense of what Arc actually does. We've watched (the development plan's hypothetical first user) bounce off the empty tab without ever opening the FAB.

Welcome is the **2-screen tax** at first launch: a 30-second visual intro and a single CTA "添加第一笔资产". It runs once per user (via `user_preferences.has_seen_welcome`), never again.

This is intentionally the **smallest feature in Stage 2**. No data model changes (the column already exists from Stage 1). No new adapters. No algorithm work. Single screen + single boolean flip.

---

## User journey (J6, condensed)

**Given** I'm a new user who just signed in via J1 magic link
**And** `hasSeenWelcome` is `false`
**When** J1's "OTP verified" step would redirect me to `/(tabs)`
**Then** I'm redirected to `/welcome` instead

**When** I see the Welcome screen
**Then** I see a short hero (icon + title + 1-2 sentence positioning) and a single primary CTA "添加第一笔资产"

**When** I tap the CTA
**Then** `hasSeenWelcome` is set to `true` (server-side via Supabase) and I'm pushed to `/(tabs)/index` with the Add-Transaction FAB / sheet pre-opened (or just landing on Portfolio Tab; see Open Q #1)

**When** I cold-restart the app any time later
**Then** I land on `/(tabs)` directly — Welcome never shows again

**Skip path** — a small "跳过" link in the screen's footer for users who don't want the orientation. Same `hasSeenWelcome=true` flip, but no FAB pre-open.

---

## Resolved decisions (locked 2026-05-19)

1. **CTA target screen** — `/(tabs)/index` simple landing (no FAB pre-open). User discovers the FAB naturally; deeper guidance is Stage 5's onboarding carousel job.
2. **Skip link visibility** — always visible in the footer. 30s of orientation isn't worth coercing past.
3. **Routing gate location** — `apps/mobile/app/_layout.tsx` top-level. Survives deep links, single source of truth for "first-time?" check.
4. **Optimistic flip** — local `hasSeenWelcome=true` immediately on tap + navigate; DB write happens in background, retried by TanStack mutation defaults. Avoids trapping the user behind a spinner; failure modes are acceptable (next session may re-show Welcome — rare and benign).

**Stage 5 hook**: keep `app/welcome.tsx` as a single file. When Stage 5 builds the multi-step carousel, it will likely become `app/(onboarding)/` route group with steps; the `has_seen_welcome` column + routing gate stay; only the screen content gets replaced/expanded. **Do NOT pre-engineer a steps array now** — over-abstraction here is more expensive than the Stage 5 refactor.

---

## Data model

**No new tables. No migration.** All necessary state already exists:

- `user_preferences.has_seen_welcome` `boolean NOT NULL DEFAULT false` — added in Stage 1 schema for exactly this feature; see [packages/db/src/schema/user-preferences.ts:23](../packages/db/src/schema/user-preferences.ts#L23)
- `apps/mobile/src/lib/user-preferences.ts` already exposes `hasSeenWelcome` field and patch path; see [apps/mobile/src/lib/user-preferences.ts:39](../apps/mobile/src/lib/user-preferences.ts#L39)

Implementation just needs:

1. A new mutation `markWelcomeSeen()` (one-liner on the existing patch path)
2. A `useEffect` in `app/_layout.tsx` (or the auth-gate equivalent) that redirects when `hasSeenWelcome === false`

---

## Architecture

### Data flow

```
                ┌──────────────────────────┐
                │   J1 magic link verified │
                └─────────────┬────────────┘
                              ▼
                useUserPreferences().hasSeenWelcome
                              │
                  false ─────┴───── true
                    ▼                ▼
              /welcome           /(tabs)/index
                    │
              (user taps CTA or skip)
                    ▼
              markWelcomeSeen() → DB
                    ▼
              router.replace("/(tabs)/index")
```

### New code locations

| File                                                       | Role                                                                               |
| :--------------------------------------------------------- | :--------------------------------------------------------------------------------- |
| `apps/mobile/app/welcome.tsx`                              | New route — single screen, hero illustration + title + paragraph + primary + skip  |
| `apps/mobile/src/lib/user-preferences.ts`                  | Add `markWelcomeSeen()` mutation (1 line over existing patch helper)               |
| `apps/mobile/app/_layout.tsx`                              | Light routing gate — read `hasSeenWelcome` after auth, redirect to `/welcome` once |
| `packages/i18n/src/locales/{en,zh}.ts`                     | ~6 strings (title, body 1, body 2, primary CTA, skip, footer disclaimer)           |
| `supabase/functions/_shared/seed-core.ts`                  | 2 new scenarios: `welcome:fresh` / `welcome:seen` (toggle `has_seen_welcome` flag) |
| `apps/mobile/src/lib/dev-tools/scenarios.ts`               | Register "Welcome" feature group                                                   |
| `apps/mobile/src/lib/dev-tools/run-welcome-seed-client.ts` | Client JWT path — same pattern as `run-watchlist-seed-client.ts`                   |

---

## UI contract

### Single screen layout (mobile-first)

```
┌─────────────────────────────────────────────────┐
│                                                 │
│              [ hero icon / illustration ]        │
│                                                 │
│              欢迎来到 Arc                          │
│                                                 │
│       全球资产配置追踪器 & 再平衡助手                  │
│                                                 │
│       跨多平台多市场的资产，集中追踪                    │
│       目标配置 + 偏离度 + 再平衡，全 Decimal           │
│       本工具不构成投资建议                            │
│                                                 │
│         [ 添加第一笔资产  →  ]                      │
│                                                 │
│              跳过                                  │
└─────────────────────────────────────────────────┘
```

- Hero icon: `Sparkles` / `Wallet` / similar Lucide (use existing wrapped icon set per ADR 006 T1)
- Title: `text-foreground text-2xl font-bold`
- Body: `text-muted text-sm` 2-3 lines max
- Disclaimer line: smaller, `text-muted-foreground text-xs`
- Primary CTA: full-width `Button`
- Skip: `Pressable` with `text-accent text-sm`
- 文案铁律 zero-tolerance: no "推荐"/"建议"/"应该" tokens; `lint:copy` will catch any slip

### States

| Condition                                      | Rendering                                                                                                         |
| :--------------------------------------------- | :---------------------------------------------------------------------------------------------------------------- |
| **First load** (`hasSeenWelcome === false`)    | Welcome screen visible                                                                                            |
| **CTA tapped**                                 | Optimistic local flip + DB write; replace `/(tabs)/index`                                                         |
| **Skip tapped**                                | Same flip + DB write; replace `/(tabs)/index`                                                                     |
| **DB write fails** (rare)                      | Still navigate (don't trap the user); log + retry in background; next session may show Welcome again — acceptable |
| **Returning user** (`hasSeenWelcome === true`) | `/welcome` never renders; if user manually navigates there, immediately redirect to `/(tabs)/index` (defense)     |

---

## Acceptance criteria (S2-AC-4.x)

### S2-AC-4.1 — First-login surface

**Given** I'm a fresh-seeded user with `hasSeenWelcome = false`
**When** I sign in via OTP (J1)
**Then** I land on `/welcome`, not `/(tabs)/index`

### S2-AC-4.2 — CTA flow

**Given** Welcome is visible
**When** I tap "添加第一笔资产"
**Then** `user_preferences.has_seen_welcome` becomes `true` in DB
**And** I land on `/(tabs)/index`

### S2-AC-4.3 — Skip flow

**Given** Welcome is visible
**When** I tap "跳过"
**Then** the same DB flip happens
**And** I land on `/(tabs)/index`

### S2-AC-4.4 — One-shot guarantee

**Given** `hasSeenWelcome` is already `true`
**When** I cold-restart the app
**Then** I land on `/(tabs)/index` directly — Welcome never appears
**And** manual navigation to `/welcome` redirects to `/(tabs)/index` (defense)

### S2-AC-4.5 — 文案铁律

**Given** the Welcome screen's i18n strings
**When** `pnpm lint:copy` runs
**Then** zero forbidden tokens are reported
**And** the disclaimer "本工具不构成投资建议" (or equivalent) is rendered visibly

### S2-AC-4.6 — DB write failure tolerance

**Given** the network is down when I tap CTA
**When** the DB write fails
**Then** I still land on `/(tabs)/index` (no trap)
**And** the local React Query cache reflects `hasSeenWelcome = true` optimistically
**And** background retry eventually persists the flip

---

## Out of scope (Stage 2 explicitly NOT doing)

- **Multi-screen onboarding carousel** — Stage 5 (`development-plan.md` §555 "完整 onboarding 推到 Stage 5")
- **Personalized welcome content** based on user signals — Stage 4+
- **Welcome video / animation** — kept text-only for Stage 2
- **Re-show on app major upgrade** — out of scope; this is one-shot only
- **Localized illustrations** per locale — same icon for both languages

---

## Implementation plan (recommended commit order)

1. **`feat(mobile): /welcome route + i18n strings`** — pure UI; uses existing `useUserPreferences` for read; calls a stub `markWelcomeSeen()` that just calls existing patch path.
2. **`feat(mobile): mark-welcome-seen mutation + routing gate in _layout`** — DB write + redirect logic.
3. **`feat(seed): welcome dev scenarios + dev panel feature group`** — `welcome:fresh` / `welcome:seen`; client JWT path.
4. **`docs(spec): sync user-journeys.md J6 + Stage 2 DoD check-off`** — wrap.

3-4 commits total. Estimate: 1 short session.

---

## Test plan

| AC                          | Layer          | Artifact                                                             |
| :-------------------------- | :------------- | :------------------------------------------------------------------- |
| S2-AC-4.1 first-login       | L4             | `pnpm seed:welcome:fresh` → relaunch app → assert `/welcome` lands   |
| S2-AC-4.2 CTA flow          | L4             | Tap CTA → assert DB row updated + `/(tabs)/index` lands              |
| S2-AC-4.3 skip flow         | L4             | Tap skip → same                                                      |
| S2-AC-4.4 one-shot          | L4             | `pnpm seed:welcome:seen` → relaunch → assert `/(tabs)/index` direct  |
| S2-AC-4.5 文案铁律          | L0 `lint:copy` | Auto                                                                 |
| S2-AC-4.6 failure tolerance | L4 (manual)    | Airplane mode → tap CTA → still navigates; reconnect → flip persists |

L1 unit tests not required (single boolean mutation; covered indirectly by L4 + integration with `useUserPreferences` already exercised).

---

## Verification checklist before merging back to `main`

- [ ] All 6 S2-AC-4.x acceptance criteria manually verified
- [ ] `pnpm typecheck` 6/6 ✅
- [ ] `pnpm lint` 6/6 ✅
- [ ] `pnpm test` ✅ (no new tests required; existing suite still green)
- [ ] `pnpm lint:copy` ✅
- [ ] J6 in `docs/user-journeys.md` synced (skip link clause + state diagram)
- [ ] Stage 2 DoD verified: Daily Snapshot ✅ + Watchlist ✅ + Rebalance ✅ + Welcome ✅
- [ ] Ready for **Stage 2 → main PR**
