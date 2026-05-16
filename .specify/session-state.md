# Arc — Session State (Live)

> **READ THIS FIRST in every new AI session** (Cursor, Claude Code, Qoder, etc.).
>
> This file is the single living snapshot of "where we are right now". It's
> intentionally short and high-frequency-update. Stable rules go in
> `constitution.md`; permanent decisions in `docs/adr/`; per-feature contracts
> in `feature-specs/`. This file answers: **"if I dropped in cold, what would
> I need to know to keep working?"**
>
> Update mechanism: `/checkpoint` (Cursor command or Claude skill — see `.claude/skills/checkpoint/`)
> at end of major work blocks, OR before context window fills.
>
> **Last updated**: 2026-05-16 by Cursor (行情 cache-first + AV 限额应对 + 左滑删除；大量改动未 commit)

---

## You are here

| Field                 | Value                                                                                                             |
| :-------------------- | :---------------------------------------------------------------------------------------------------------------- |
| **Active stage**      | Stage 1 (MVP-0 端到端骨架)                                                                                        |
| **Step**              | **Stage 1 代码收尾 + dev 行情策略** — 待 commit 未提交 diff + S1-AC-1～6 人工验收（S1-AC-5 推迟 Stage 2）         |
| **Branch**            | `dev/stage-1` — **ahead 1** of `origin/dev/stage-1`；另有 **~15 文件未 commit**（见 git status）                  |
| **Last commit**       | `45e57cd` — fix(mobile): validate symbols on add, delete holdings, smarter quote fetch                            |
| **PR**                | [#5](https://github.com/BoyangJiao/arc/pull/5) — OPEN — 本地 `typecheck` / `test` ✅；push 前需 commit 工作区改动 |
| **CI status**         | 本地 gate ✅（2026-05-16）；远程待 push 后确认                                                                    |
| **Mobile dev server** | 用户本地 Metro；改 `.env` 后需 `pnpm --filter @arc/mobile start --clear`                                          |
| **gh CLI**            | Installed at `~/.local/bin/gh` (v2.92.0), already on PATH; auth via `GH_TOKEN` env var                            |

## Stage 1 step progress

| #   | Step                                                                           | Status      | Commits               |
| :-- | :----------------------------------------------------------------------------- | :---------- | :-------------------- |
| 1   | Drizzle DB schema + RLS + Supabase migrations                                  | ✅ done     | `00bbd2b`             |
| 2   | Auth (OTP code primary; magic link secondary; PKCE deep link)                  | ✅ done     | `ade7787` → `3da0fb8` |
| 3   | Data source adapters (Alpha Vantage US + Frankfurter FX + cache + 31 tests)    | ✅ done     | `dc426f1`             |
| 4   | 5 real pages (Portfolio Tab, detail, add-tx modal, Settings, Me + tabs layout) | ✅ 代码就位 | `1c439db` 等          |
| 5   | Business token system + ESLint guard                                           | ✅ done     | `5d398af`             |

Stage 1 complete = **代码 ~5/5，验收待勾**。S1-AC-5（涨跌色可见 UI）**用户决定推迟到 Stage 2**（有图表后更易验证）；其余 S1-AC-1～4、6 需人工跑一遍。

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
- ✅ 上述 P0 修复项已在 2026-05-15～16 落地（见 `1c439db` 及此前 commits）
- ✅ `pnpm seed:dev` 用户已跑通；dev Supabase 有 seed 报价 + HOOD 占位价
- ⏳ **剩**：commit 本 session 未提交改动 → push PR #5 → S1-AC-1～4、6 人工验收 → Stage 1 签字

## Recent decisions (last 7 days)

- **行情 `cache-first`（**DEV** 默认）** — `EXPO_PUBLIC_MARKET_DATA_POLICY=cache-first`；内存 → AsyncStorage → Supabase；仅下拉刷新 / 新 ticker 首次校验打 AV。`live` 模式在 AV 限流时回退 stale 缓存。
- **组合详情左滑删除** — `@arc/ui` `SwipeableActionsRow`（ReanimatedSwipeable）；行尾垃圾桶已移除。
- **DB migration 0002** — `price_snapshots` / `fx_rates` authenticated INSERT（dev 持久化缓存）；0001 为 US `assets` INSERT。
- **FloatingTabBar 对齐 Crypto Wallet 模板** — HeroUI `Surface` + `PressableFeedback`；仅图标无文字；Ionicons outline/filled（`@arc/ui/wrappers/tab-bar-icons`）。列表/空态仍用 Lucide。
- **S1-AC-5 推迟** — Stage 1 不做涨跌色预览 UI；Stage 2 有 Daily Snapshot / 图表后再验。
- **iOS 26 floating tab bar** — 自建 FloatingTabBar（ADR 006 navigation 层）；expo-blur SDK 54 不兼容，模板用 HeroUI Surface 替代半透明胶囊。
- **Dark Mode via ThemeProvider** — useColorMode() hook + Appearance.setColorScheme()；Screen 组件背景色从 SafeAreaView 移到 Uniwind-aware View。
- **BusinessTokensProvider 内部状态** — financeColorMode 改为内部 useState 管理，暴露 setFinanceColorMode，解决跨组件切换问题。
- **Dev seed via SQL** — `pnpm seed:dev` → `tools/seed-dev-data.ts`（ADR 007）；已删 DEV_BYPASS / dev-seed.ts。
- **OTP code primary, magic link secondary** — Mac browser can't bridge `exp://` deep links to iOS sim's Expo Go; OTP works everywhere.
- **Screen primitive in `@arc/ui`** — every screen uses `<Screen>` for safe-area + scroll.

## Active blockers / waiting on user

- ⚠️ **Alpha Vantage 免费档已触限** — 调试期勿下拉刷新；用 seed/缓存价。配额恢复后再拉一次写入缓存。
- ⏳ **Supabase SQL** — 若未执行：应用 `0001_assets_authenticated_insert.sql` + `0002_market_cache_public_read_authenticated_insert.sql`
- ⏳ **Stage 1 人工验收**（J1–J4、J6；J5 推迟 Stage 2）

## Immediate next actions (next session, 按顺序)

1. **Commit 工作区**（cache-first、persistent cache、SwipeableActionsRow、migration 0002、data-sources 去重等）→ `git push` PR #5
2. 确认 `apps/mobile/.env` 为 `EXPO_PUBLIC_MARKET_DATA_POLICY=cache-first`；Metro `--clear` 后验总市值 ≈ **¥84,719**（4 持仓 + seed/HOOD 缓存）
3. 按 `.specify/stage-acceptance-criteria.md` 跑 S1-AC-1～4、6
4. Stage 1 签字 → Stage 2 规划

## Open decisions / questions for user

- ADR-006 / 007 中的待确认项（见各自正文「实施清单」）
- Pro license 商业分发合规性沟通时点（建议 Stage 4 末做一次正式商务确认）

## Critical mental model (gotchas easy to forget)

- **Decimal.js everywhere**: any financial number is Decimal, never `number`. ESLint catches; tests catch (`packages/core/__tests__/decimal.spec.ts`).
- **Asset ID immutable**: `market:symbol` (e.g., `US:AAPL`); written via `composeAssetId()` from `@arc/core`. Never reassign.
- **Business tokens for gain/loss**: business code does NOT use `text-success` / `text-danger` directly for PnL. Use `useBusinessClasses()` from `@arc/ui`. ESLint will eventually enforce; for now CR.
- **HeroUI Foundation only**: no Tailwind built-in colors (`bg-red-500` etc.) in business code. ESLint enforces.
- **i18n required**: no hardcoded user-facing strings. Use `t()` from `@arc/i18n`. Add to both `zh.ts` and `en.ts` simultaneously.
- **Supabase RLS**: migration `0002` 允许 authenticated INSERT 行情/汇率缓存；未应用 migration 时 client 写仍会 warn，内存+AsyncStorage 仍有效。
- **AV 限额 → 总市值 0**: `live` 策略 + 15min 过期 → 全 miss → 全限流 → 无报价。用 `cache-first` 或 stale 回退；seed 价见下表。
- **Dev seed 报价（USD）**: AAPL 189.50、MSFT 420.30、NVDA 875.00；FX USD→CNY 7.20；HOOD 占位 77.00（`dev-cost-basis`）。10/5/8/10 股 → 约 **¥84,719** 总市值。
- **heroui-native-pro postinstall**: needs `HEROUI_AUTH_TOKEN` (CI) or macOS keychain login (`npx heroui-pro login`, dev). CI reads token from GitHub Secret `HEROUI_AUTH_TOKEN` (CI/CD token from heroui.pro/dashboard, NOT Personal Token).
- **OTP length 8**: this Supabase project (jdvlzkictwinkgcvgwew) is configured for 8-digit; code accepts 6-10.
- **Expo Go quirk**: Mac browser cannot trigger `exp://` deep link to sim. Use OTP code flow for dev. Magic link only works in standalone build (Stage 4).
- **SafeAreaView is NOT Uniwind-aware**: react-native-safe-area-context 的 SafeAreaView 不被 Uniwind 运行时拦截，className 在编译期静态解析。背景色必须放在外层 View 上。
- **expo-blur 版本不兼容**: Expo SDK 54 期望 expo-blur ~15.0.8，npm 安装的 v55 报 Unimplemented component。已移除，改用半透明 View。
- **pnpm monorepo Metro 解析**: 新装的包需在 apps/mobile/node_modules 下存在，且需重启 Metro（--clear）才能识别。
- **inline Stack.Screen options 导致全页刷新**: 在 new.tsx 等页面中不要写 inline options 对象（每次 re-render 新引用），应在 \_layout.tsx 中静态声明。

## Active env / config snapshot

| File                        | Status                                                                                |
| :-------------------------- | :------------------------------------------------------------------------------------ |
| `apps/mobile/.env`          | Supabase + AV key；**`MARKET_DATA_POLICY=cache-first`**（勿改回 `live` 除非要测实时） |
| `.env.dev.local`            | repo root；`pnpm seed:dev` 用 service_role（用户已配置）                              |
| Migrations pending          | `0001` assets INSERT；`0002` price_snapshots/fx_rates RLS — 需在 Supabase 执行        |
| Supabase project            | `jdvlzkictwinkgcvgwew` (Tokyo, Postgres 17.6.1, ACTIVE_HEALTHY)                       |
| Supabase Auth redirect URLs | Configured: `arc://auth/callback`, `arc://**`, `exp://**/--/auth/callback`, etc.      |
| Supabase SMTP               | Resend configured (custom SMTP enabled)                                               |
| GitHub branch               | `dev/stage-1` (3 commits ahead of main on first commit, now ~10 ahead)                |
| GitHub Actions              | Pre-push Quality Gate (push + PR triggers)                                            |
| Husky                       | pre-commit (prettier on staged) + post-checkout/merge (sync skills)                   |
| Stop hook                   | `.claude/hooks/quality-gate.sh` runs typecheck + tests on AI signal completion        |

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
