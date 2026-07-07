# Cursor / Sonnet kickoff — Real-data DEV environments

接力 Arc cross-stage 任务：**Real / Clean 双 DEV 环境**（不属于 Block D，但解锁 Phase 3 雪球对标 + 持续 dogfooding）。

## 必读顺序

1. `CLAUDE.md` § 三工程铁律 + §七模型分工
2. `.specify/constitution.md`（特别是 §Real-flow integrity — 不绕 auth）
3. `.specify/session-state.md` §Block D Phase 1+2 进度（建立背景）
4. **`.specify/feature-specs/cross-stage/real-env-dev-tools.md`**（本任务契约 — 3 决策已锁，6 commit chain 明文）

## 任务范围

按 spec § Implementation plan 6 commits 全部交付：

| #   | Commit message                                                              | 核心改动                                                                                                                 |
| :-- | :-------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------- |
| 1   | `feat(mobile): env-mode detection + .env DEV_REAL_EMAIL / DEV_CLEAN_EMAIL`  | 新 `apps/mobile/src/lib/dev-tools/env-mode.ts` + `app.config.ts` 桥接 `Constants.expoConfig.extra` + `.env.example` 注释 |
| 2   | `feat(mobile): run-reset-clean.ts + RLS-mediated user-scoped delete script` | 新 `run-reset-clean.ts`；refuses when not Clean；删除 6 表 + AsyncStorage + QueryClient.clear                            |
| 3   | `feat(mobile): DEV FAB Environment section + env switcher + reset button`   | `DevToolsFab.tsx` 顶部加 Environment 区；Switch action = signOut + signInWithOtpCode(targetEmail) 预填                   |
| 4   | `feat(mobile): gate scenarios.ts entries by envMode === 'clean'`            | scenarios.ts 加 `requiredEnv` 字段；FAB 渲染按 envMode 过滤 + 禁用态 tooltip                                             |
| 5   | `test(mobile): reset-clean smoke + envMode unit + S3-AC-RE.4 button-guard`  | Vitest 单测（mock supabase client）覆盖 spec S3-AC-RE.1/.3/.4 核心路径                                                   |
| 6   | `docs(spec+state): real-env feature ready, Phase 3 dependency unblocked`    | spec status → Implemented；session-state 标记 Real Env 已上线 + Phase 3 unblocked                                        |

## 锁定的 3 个决策（不要改）

- **§决策 1**: Gmail `+alias` 双邮箱 = 双 Supabase auth user（不是单用户 + flag）
- **§决策 2**: Reset Clean 清 EVERYTHING 包括 `user_preferences`（完整 new-user 模拟）
- **§决策 3**: Real Env 保护栏 = 最小（仅 FAB 隐藏 seed buttons + tooltip；无手输确认、无状态栏、无空仓 warning）

## 约束 / 红线

- **绝不绕 auth**（ADR 007）— Switch 必须走完整 signInWithOtpCode + verifyOtpCode；不允许 service_role 直登
- **Real Env data 神圣** — 任何代码路径都不能写到 Real user 的表；reset 脚本 hard-gate by email match，写单元测试覆盖"signed in as Real → throw"
- **不动 schema / migrations** — 现有 RLS 已经覆盖（migration 0001-0013 全部 user-scoped）
- **不动 `@arc/core` / `@arc/data-sources` / Edge Functions** — 纯 mobile-side 改动
- **每 commit 末**: `pnpm typecheck` 6/6 ✅ + `pnpm --filter @arc/mobile test` 全绿
- **不 push**（用户控制节奏）

## 已知坑 / 提前知会

1. **`Constants.expoConfig.extra` 桥接**: Expo SDK 55 下 `process.env.X` 不自动出现在 `extra`；需要 `app.config.ts` 显式 `extra: { devRealEmail: process.env.DEV_REAL_EMAIL, ... }`。先验证 `console.log(Constants.expoConfig?.extra)` 在 commit #1 末出值，再写 env-mode.ts。
2. **`signInWithOtpCode` 预填 email**: 现有 OTP 屏幕在 `apps/mobile/app/auth/...` — 检查它是否接受 `email` query param 或 route param。如果不接受，commit #3 顺手加 `?email=<encoded>` 支持。
3. **AsyncStorage key 名**: Don't hardcode—greppable list before delete. 当前已知:
   - `active-portfolio-id`（multi-portfolio Block B）
   - `welcome-seen`（J6 welcome）
   - `color-mode`（red-up/green-down toggle）
   - `last-used-market-{portfolioId}`（Block C）
     先 `grep -rEn 'AsyncStorage.(set|get|remove)Item' apps/mobile/src` 拉清单确认。
4. **Gmail +alias Supabase 兼容**: 99% 应该工作（Supabase 用整个 email string 做 unique），但 commit #1 末用 +arc-real 真的 signInWithOtp 一次确认 OTP 邮件能收到 + verifyOtp 成功创建 user 行。
5. **TanStack queryClient access in dev-tools**: 现有 reset 类操作的 queryClient 拿法 — 看 `run-portfolios-seed-client.ts` 等已有脚本怎么取，复用同 pattern。

## 提交节奏建议

- 6 commits 一次跑完；每 commit 跑 typecheck + 相关测试；commit message 严格按 spec 表
- 完成后报告 commit SHAs + manual smoke 结果（S3-AC-RE.1/.3/.4 各一句话签 off）
- 用户会自己跑 S3-AC-RE.2（Metro restart）+ .5（Real ↔ Clean 来回数据完好）

## 不在范围（明确拒绝）

- Onboarding 流程本身改造（只搭建测试床；onboarding 当前长什么样就什么样）
- Sentry env 标签（FU-RE.1，Stage 4 polish）
- 任何 schema migration
- 任何 production build 改动（DEV FAB 已被 `__DEV__` gate 排除）
- Phase 3 雪球对标本身 — 用户自己跑（这个 spec 只是它的 prereq）

## Pre-flight 给用户的清单（spec § J-RE.1）

实施完后用户需要做:

1. 在 `apps/mobile/.env` 里填:
   ```
   DEV_REAL_EMAIL=cyberjby+arc-real@gmail.com
   DEV_CLEAN_EMAIL=cyberjby+arc-clean@gmail.com
   DEV_SEED_EMAIL=cyberjby+arc-clean@gmail.com  # 兼容现有 scripts
   ```
2. 重启 Metro `--clear`
3. DEV FAB → Switch to Real → 收 OTP → 验证 → 进入 Real Env 空状态
4. 走 onboarding 录入真实持仓（与 Delta / 支付宝 同步）
5. 后续日常使用即 Real Env；测试新功能时 Switch to Clean
