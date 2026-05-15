# Arc — Session State (Live)

> **READ THIS FIRST in every new Claude Code session.**
>
> This file is the single living snapshot of "where we are right now". It's
> intentionally short and high-frequency-update. Stable rules go in
> `constitution.md`; permanent decisions in `docs/adr/`; per-feature contracts
> in `feature-specs/`. This file answers: **"if I dropped in cold, what would
> I need to know to keep working?"**
>
> Update mechanism: invoke the `/checkpoint` skill (see `.claude/skills/checkpoint/`)
> at end of major work blocks, OR before context window fills.
>
> **Last updated**: 2026-05-15 by Claude Opus 4.7 (Stage 1 step 4 audit + ADR 006/007 起草)

---

## You are here

| Field                 | Value                                                                                                                                                                        |
| :-------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Active stage**      | Stage 1 (MVP-0 端到端骨架)                                                                                                                                                   |
| **Step**              | **5/5 步骤文件已写完，但 step 4 端到端 DoD 未达成** — 审计后回头修                                                                                                           |
| **Branch**            | `dev/stage-1` (10+ commits ahead of main, uncommitted changes for step 4 pages + polish)                                                                                     |
| **Last commit**       | `5e25024` — fix(mobile) add @types/node devDep                                                                                                                               |
| **PR**                | [#5](https://github.com/BoyangJiao/arc/pull/5) — OPEN — **CI 实际是红的**：`@arc/mobile#lint` 失败（FloatingTabBar rgba 字面量违反 step 5 加的 `no-restricted-syntax` 规则） |
| **CI status**         | ⚠️ typecheck ✅，**lint ❌**（2 errors），tests 未跑（lint 先 fail）。session-state 之前标 ✅ 是误报                                                                         |
| **Mobile dev server** | Running on port 8081 (Metro with --clear, started this session)                                                                                                              |
| **gh CLI**            | Installed at `~/.local/bin/gh` (v2.92.0), already on PATH; auth via `GH_TOKEN` env var                                                                                       |

## Stage 1 step progress

| #   | Step                                                                           | Status               | Commits               |
| :-- | :----------------------------------------------------------------------------- | :------------------- | :-------------------- |
| 1   | Drizzle DB schema + RLS + Supabase migrations                                  | ✅ done              | `00bbd2b`             |
| 2   | Auth (OTP code primary; magic link secondary; PKCE deep link)                  | ✅ done              | `ade7787` → `3da0fb8` |
| 3   | Data source adapters (Alpha Vantage US + Frankfurter FX + cache + 31 tests)    | ✅ done              | `dc426f1`             |
| 4   | 5 real pages (Portfolio Tab, detail, add-tx modal, Settings, Me + tabs layout) | ⚠️ 文件齐但 DoD 未达 | uncommitted (local)   |
| 5   | Business token system + ESLint guard                                           | ✅ done              | `5d398af`             |

Stage 1 complete = **当前 4.5/5**。Step 4 审计后发现核心 DoD 未达成，需回头修。

### Step 4 审计核心结论（2026-05-15 by Claude Opus 4.7）

- **P0-1/2/3 数据链路断裂**：`usePrice` / `useFxRate` / `computeMarketValue` 全未被任何页面调用；Portfolio Tab/Detail 展示的"总市值"实为成本基（cost basis）；切换报告货币只换符号不换数字。**S1-AC-2 / S1-AC-3 未达成。**
- **P0-4 Lint 红线**：FloatingTabBar.tsx 两处硬编码 rgba 违反 step 5 加的 `no-restricted-syntax`。session-state 此前标 ✅ 是错的。
- **P0-5 transactions/new 偏离铁律**：用 `Number()` 校验金融数值、用字符串拼接 `assetId` 不走 `composeAssetId()`、缺日期字段、`currency` 硬编码 `"USD"` 与 symbol 输入不一致。
- **P0-6 ADR 004 未落地**：手写圆+首字母替代了 dicebear gradient avatar；Portfolio Tab 与 Me 两处复制粘贴。
- **根因**：`DEV_BYPASS_AUTH` + 前端 dev-seed 把 auth + hooks 链路全短路 → 真实数据流从未跑过 → P0 长期掩盖。

### 应对（已就位 / 待执行）

- ✅ 起草 ADR-006「`@arc/ui` 分层 + 非 HeroUI 组件归位规范」
- ✅ 起草 ADR-007「Dev Auth 持久化 + 种子数据 SQL 注入策略」
- ✅ 更新 constitution.md 加铁律「真实链路不可绕过」+ 扩展 Components 铁律覆盖所有第三方包
- ✅ 更新 CLAUDE.md §三新增 §3.5、§五 monorepo 结构改 8 层 + 决策树
- ⏳ 待执行：lint 修复 → DEV_BYPASS 清理 → 真实数据接通 → ADR 004 头像落地 → useUserPreferences TanStack Query 化 → ESLint `no-restricted-imports` → S1-AC-1～6 真测

## Recent decisions (last 7 days)

- **iOS 26 floating tab bar** — 使用自定义 FloatingTabBar 组件（半透明 View 胶囊），替代默认 react-navigation tab bar。expo-blur 因版本不兼容已移除，改用 rgba 背景。
- **Lucide Icons for tabs** — Tab 图标使用 lucide-react-native（BarChart3 / TrendingUp / Lightbulb），替代之前的 emoji。
- **Dark Mode via ThemeProvider** — useColorMode() hook + Appearance.setColorScheme()；Screen 组件背景色从 SafeAreaView 移到 Uniwind-aware View。
- **BusinessTokensProvider 内部状态** — financeColorMode 改为内部 useState 管理，暴露 setFinanceColorMode，解决跨组件切换问题。
- **Dev seed data (bypass mode)** — mock portfolio + 3 transactions（AAPL/MSFT/NVDA）注入 use-portfolios / use-transactions hooks。
- **OTP code primary, magic link secondary** — Mac browser can't bridge `exp://` deep links to iOS sim's Expo Go; OTP works everywhere.
- **Screen primitive in `@arc/ui`** — every screen uses `<Screen>` for safe-area + scroll.

## Active blockers / waiting on user

- ⏳ **User 待 review ADR-006 + ADR-007 草稿**（`docs/adr/006-*.md` + `007-*.md`）— review 通过后进入下方"修复推进顺序"

## Immediate next actions (next session, 按顺序)

1. ⏳ User review ADR-006 / ADR-007 → 状态从「提议」改为「已接受」
2. ⏳ 修 lint 红线：FloatingTabBar rgba 挪入 `TAB_BAR_COLORS.*.pillBackground`；同步迁移到 `packages/ui/src/navigation/FloatingTabBar.tsx`
3. ⏳ 删 `DEV_BYPASS_AUTH` 全链路 + 整删 `apps/mobile/src/lib/queries/dev-seed.ts`
4. ~~Supabase dev project Dashboard 把 refresh token absolute lifetime 调到 60 天~~ — Free tier 无此项；默认即"事实上无 absolute lifetime"，跳过（ADR 007 §决策二修订）
5. ⏳ 写 `tools/seed-dev-data.ts`（service role + 真 SQL 注入）+ `pnpm seed:dev`
6. ⏳ 接通真实数据：Portfolio Detail HoldingRow 用 `usePrice` + `useFxRate`，Portfolio Tab 用 `computePortfolioValuation`
7. ⏳ 修 transactions/new：`composeAssetId` + Decimal 校验 + 日期字段 + Pro NumberField/DatePicker/Segment + currency 由 assetId 反推
8. ⏳ 落 ADR 004 渐变头像（`packages/ui/src/avatar/UserAvatar.tsx` + dicebear）
9. ⏳ `useUserPreferences` 切到 TanStack Query
10. ⏳ ESLint `no-restricted-imports`：禁 `apps/**` 直接 import `heroui-native` / `heroui-native-pro` / `react-native-safe-area-context` / `lucide-react-native` / `@gorhom/*` / `@dicebear/*`
11. ⏳ Markets/Insights 空态换 Pro `EmptyState` + Lucide 图标；Me 行尾 `→` 换 `ChevronRight`
12. ⏳ 跑 S1-AC-1 ～ S1-AC-6 真实 web + iOS 验收 → 才进 Stage 2 规划

## Open decisions / questions for user

- ADR-006 / 007 中的待确认项（见各自正文「实施清单」）
- Pro license 商业分发合规性沟通时点（建议 Stage 4 末做一次正式商务确认）

## Critical mental model (gotchas easy to forget)

- **Decimal.js everywhere**: any financial number is Decimal, never `number`. ESLint catches; tests catch (`packages/core/__tests__/decimal.spec.ts`).
- **Asset ID immutable**: `market:symbol` (e.g., `US:AAPL`); written via `composeAssetId()` from `@arc/core`. Never reassign.
- **Business tokens for gain/loss**: business code does NOT use `text-success` / `text-danger` directly for PnL. Use `useBusinessClasses()` from `@arc/ui`. ESLint will eventually enforce; for now CR.
- **HeroUI Foundation only**: no Tailwind built-in colors (`bg-red-500` etc.) in business code. ESLint enforces.
- **i18n required**: no hardcoded user-facing strings. Use `t()` from `@arc/i18n`. Add to both `zh.ts` and `en.ts` simultaneously.
- **Supabase RLS**: client writes to `price_snapshots`/`fx_rates` will fail (expected); reads work for everyone. Stage 4 fixes via Edge Function.
- **heroui-native-pro postinstall**: needs `HEROUI_AUTH_TOKEN` (CI) or macOS keychain login (`npx heroui-pro login`, dev). CI reads token from GitHub Secret `HEROUI_AUTH_TOKEN` (CI/CD token from heroui.pro/dashboard, NOT Personal Token).
- **OTP length 8**: this Supabase project (jdvlzkictwinkgcvgwew) is configured for 8-digit; code accepts 6-10.
- **Expo Go quirk**: Mac browser cannot trigger `exp://` deep link to sim. Use OTP code flow for dev. Magic link only works in standalone build (Stage 4).
- **SafeAreaView is NOT Uniwind-aware**: react-native-safe-area-context 的 SafeAreaView 不被 Uniwind 运行时拦截，className 在编译期静态解析。背景色必须放在外层 View 上。
- **expo-blur 版本不兼容**: Expo SDK 54 期望 expo-blur ~15.0.8，npm 安装的 v55 报 Unimplemented component。已移除，改用半透明 View。
- **pnpm monorepo Metro 解析**: 新装的包需在 apps/mobile/node_modules 下存在，且需重启 Metro（--clear）才能识别。
- **inline Stack.Screen options 导致全页刷新**: 在 new.tsx 等页面中不要写 inline options 对象（每次 re-render 新引用），应在 \_layout.tsx 中静态声明。

## Active env / config snapshot

| File                        | Status                                                                           |
| :-------------------------- | :------------------------------------------------------------------------------- |
| `apps/mobile/.env`          | exists locally; Supabase URL/anon-key + Alpha Vantage key set; gitignored        |
| Supabase project            | `jdvlzkictwinkgcvgwew` (Tokyo, Postgres 17.6.1, ACTIVE_HEALTHY)                  |
| Supabase Auth redirect URLs | Configured: `arc://auth/callback`, `arc://**`, `exp://**/--/auth/callback`, etc. |
| Supabase SMTP               | Resend configured (custom SMTP enabled)                                          |
| GitHub branch               | `dev/stage-1` (3 commits ahead of main on first commit, now ~10 ahead)           |
| GitHub Actions              | Pre-push Quality Gate (push + PR triggers)                                       |
| Husky                       | pre-commit (prettier on staged) + post-checkout/merge (sync skills)              |
| Stop hook                   | `.claude/hooks/quality-gate.sh` runs typecheck + tests on AI signal completion   |

## Recent ADRs (most relevant first)

| ADR            | Topic                                                             |
| :------------- | :---------------------------------------------------------------- |
| 005            | Tailwind v4 OKLCH 色阶系统                                        |
| 003 v3.1       | Design Tokens 架构（Foundation 直消费 + Business 平行）           |
| 004            | Avatar generation (dicebear gradient)                             |
| 002 (branch A) | UI library decision (HeroUI Native + Pro + Uniwind + Tailwind v4) |
| 001            | Tech stack (Expo + Supabase + Drizzle + decimal.js)               |

## How to use this file

**Starting a new session?**

1. Read CLAUDE.md (project rules)
2. Read this file (current state)
3. Read most recent feature-spec relevant to next action
4. Begin work — you're caught up

**Ending a session (or context near full)?**

- Invoke `/checkpoint` skill → updates this file with latest state
- Commit the update
- Safe to close session

**Major step boundary?**

- After completing a Stage step or major refactor, manually update §"You are here", §"Recent decisions", §"Stage progress" before commit
