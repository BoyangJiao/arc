# Arc — Session State (Live)

> **READ THIS FIRST in every new AI session** (Cursor, Claude Code, Qoder, etc.).
>
> Update mechanism: `/checkpoint` (Cursor command or Claude skill).
>
> **Never write here:** API keys, JWTs, `DATABASE_URL`, `.env` contents, or other secrets.
>
> **瘦身规则（2026-07-08 起）**：本文件只保留「当前状态 + 最近 ≤3 条 Last updated + 未决事项 + gotchas」。
> checkpoint 时若 Last updated 超过 3 条，把最老的移入 `.specify/archive/`。
> 历史全量（2026-05-17 → 07-05 的所有条目、Stage 2/3 各 Block 执行记录、handoff、Track A–G、
> 已解决决策）见 [`archive/session-state-archive-2026-07-08.md`](archive/session-state-archive-2026-07-08.md)。

## Last updated

- **2026-07-08 by Claude Code (remote)** — **文档系统 review + 修复批次**（branch `claude/docs-review-optimization-1so23n`）。修复：project-background 未闭合代码块（§3.2/3.3 含 R7/R8 此前渲染为代码块）；**ADR 017 授权结论回写** legal-risk-map L3/§七 + 风险登记册 R1（旧「Tushare Pro 已含授权」口径清除）；CLAUDE.md 阶段快照（Stage 0→1 更正为 Stage 3→4）/图表栈/seed 命令/skill 表/阅读地图；development-plan §二§三§六 加「已被取代」横幅 + 删孤儿表格碎片；feature-specs README 补 6 份缺失 spec + 状态列对齐 as-built；本文件瘦身（722 行 → 精简版，全量存档零损失）。**同会话另交付**：全部 .specify/docs 文档的 16 项发现 review + 架构/算法/数据源选型按 2026-07 标准的 re-review（结论见会话记录；未修项按优先级列入 §Open items #8）。
- **2026-07-05 by Claude Code (remote)** — **全项目深度 code review + 修复批次**（PR #11，已合入）。9 组修复要点：FX 缺失不再静默 1:1（`core/fx` 真实现 + `missingQuote/FxAssetIds` 暴露 + 首页提示）；computeHoldings 防御排序 + 超卖不 throw；XIRR 容差尺度相关；daily-snapshot Edge Function 重构（依赖注入 + 10 deno test；修交易未排序 / supabase-js 1000 行静默截断 / cost basis 含 fee 口径统一）；txFingerprint 改 FNV-1a；图表色板集中 `tokens/chart-palette.ts`；i18n `zh satisfies typeof en`；akshare wrapper 加固；风险登记册 +R7/R8（均上架 blocker）。验证：core 238 / ds 171 / ui 40 / mobile 169 / functions 10 全绿。**有意不动**：性能项（规模到了再做）、R7/R8 架构迁移（绑定阿里云迁移轮）、assets 元数据 enrich（待 BoyangJiao 决策）。
- **2026-06-18 by Opus 4.8** — 风险/回撤拆两个详情页 + `/insights/trade-stats` + **数据源大调研（Tushare/akshare/聚宽全非商用 → ADR 017 + 发版闸门）** + 美股历史切 akshare 兜底（registry US 历史 akshare→tushare→AV；Finnhub 仍管实时）+ **指数对标 #9 全栈**（bucketReturn/calendarBuckets + benchmark 目录 ETF 代理 + `/insights/benchmark` 详情页）。踩坑：app 读 `apps/mobile/.env`（非 root `.env.dev.local`）；`AKSHARE_WRAPPER_TOKEN` Vercel Sensitive 不可读回，已轮换。

## You are here

| Field                 | Value                                                                                                                                                                                                     |
| :-------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Active stage**      | **Stage 3 → Stage 4 过渡** — Stage 3 全量已合 `main`（**PR #10 merged**，merge commit `d314314`）；PR #11（code review 修复）已合入；EAS dev build 配置已落地（`46370e6`）；Revyl 云测试配置（`f34fa69`） |
| **Next step**         | 锁定时序第 3–4 步：**EAS dev build 装真机 → 自用 ≥4 周**（真实场景 + 攒 TWR 雪球对标数据 + 记 bug）。注：原时序第 5 步（PR #10 合 main）已提前完成                                                        |
| **Branch**            | `main`（`dev/stage-3` 已合并）；文档修复分支 `claude/docs-review-optimization-1so23n` 待 review                                                                                                           |
| **Mobile dev server** | `pnpm mobile` → 8081；改 `.env` / migration 后 **Metro `--clear`**                                                                                                                                        |
| **Out of scope**      | Block E 价格异动后台 job、Finnhub Vercel proxy、大陆 Auth（ADR 012 P1）实现 — 全部绑定**阿里云迁移轮**；多平台 CSV profile（按真实模板逐个加，架构 seam 已就位）                                          |

**BoyangJiao 外部 todo**：注册 **Apple Developer 账号（$99/年）** — dev build 装真机必需（若已注册，checkpoint 时删本行）。

## 🗺️ 时序（BoyangJiao 锁定 2026-06-02；改动需其同意）

```
1. Block F UAT ✅ → 2. UI/UX 地基打磨（80 分即停）✅ → 3. EAS dev build 上机 ← 当前
→ 4. 自用 ≥4 周 + 雪球对标 + 记 bug → 5. Stage 3 收尾 PR #10 合 main ✅（已提前）
→ 6. Stage 4：onboarding（第一件）→ IAP / TestFlight / 阿里云迁移 / 法务
```

- 自用 = dev build 上机（Expo Go 不可用：MMKV/NitroModules 不支持），不是 TestFlight。
- UI/UX 第二波（使用驱动精修）依赖 4 周自用数据，自用后再做。

## ⏸️ 有意推后（不是漏做）

| 项                                | 为何推后                                                             | 目标节点             |
| :-------------------------------- | :------------------------------------------------------------------- | :------------------- |
| Inbox 推送 + 价格异动后台         | 需 Edge Function+cron+APNs；迁移前不建新 Vercel                      | 阿里云迁移轮         |
| 订阅打通 + 支付（IAP/Stripe）     | 上架级工程；需自用反馈 + 计价策略                                    | Stage 4              |
| new user onboarding               | 自用不需引导；设计应被自用困惑点驱动                                 | Stage 4 开头         |
| UI/UX 第二波（使用驱动精修）      | 需 4 周自用数据                                                      | Stage 3 末 / Stage 4 |
| TestFlight                        | 给外部测试者的渠道，自用不需要                                       | Stage 4              |
| 收益报告「已实现」列              | `realized-pnl-fx-stage-3.md`（Draft）；需历史 FX-at-sale 查询        | 新会话（focused）    |
| Performance Attribution 实施      | spec Accepted 未实施（`performance-attribution-stage-3.md`）         | 待排期               |
| #12 资产位置（按平台/账户）       | 需 DB migration `transactions.account` + 录入表单；BoyangJiao 暂跳过 | 待定                 |
| benchmark beta（vs 基准回归系数） | 指数对标已落地，beta 算法 deferred                                   | 待排期               |

## Open items / known bugs（未修，按发现时间）

1. **风险页年化波动率 450% / 回撤 -54.8% 异常** = 快照 totalValue 序列脏数据/尖刺（2026-06-18 发现，数据质量 bug，未修）。
2. 指数对标 forward-fill 修复后**真机复验**是否出数据；多基准分组柱颜色/拥挤度；全部 Skia 图表真机渲染（06-17/06-18 待 UAT 项）。
3. **assets 元数据 first-writer 永不 enrich**（需 UPDATE policy 设计，待 BoyangJiao 决策）。
4. **R7 客户端内嵌数据源 key / R8 共享缓存表投毒** — 上架 blocker，随阿里云迁移轮做 Edge Function 代理 + RLS 收敛（风险登记册 + ADR 017）。
5. MMKV 加密 key 的 expo-crypto follow-up（沙箱装不上，暂用 Web Crypto getRandomValues + Math.random 兜底）。
6. TWR known limitations FU-1…FU-5（批量 fallback 拉价 / Sentry 接管 warn / from clamp / FX_LOOKBACK / useAssetTwr 双拉价）见 `twr-stage-3.md §Known limitations`。
7. `export.tsx` 错误 Alert 读 stale-closure errorMessage（建议改内联渲染，非阻塞）。
8. 文档层遗留（2026-07-08 review 的 P1/P2 项）：stage-acceptance-criteria Stage 3 段回填或降级定位；product-roadmap 订阅/CSV 口径与 roadmap 决策 2 矛盾；information-architecture「以本文件为准」条款 vs as-built 漂移；polish-backlog 核销一轮；handoffs/ 归档；HARNESS.md pre-commit typecheck gate 未回写；\_RESTRUCTURE-PLAN 触发器状态行过期（stage-3 已 16 份）。

## Critical mental model (gotchas easy to forget)

- **Decimal.js everywhere** — see `packages/core/__tests__/`.
- **`assets` upsert**: RLS allows INSERT only → use `{ onConflict: "id", ignoreDuplicates: true }`.
- **Dev seed**: `service_role` only in CLI / Edge — never in app bundle. 紫色 DEV 面板场景走 client JWT；Daily Snapshot 场景走 Edge `dev-seed`。
- **iOS Simulator refresh**: **⌘D → Reload**（⌘R = screenshot）。
- **`/me` 导航**：根栈 `slide_from_left` + 右缘左滑关闭整个 Me；`app/me/_layout.tsx` 子栈自右 push。
- **TanStack error path**: `catch` + `return null` = success → 无 `isError` → 无横幅。**`AdapterError` 子类必须 rethrow**。
- **缓存信任 (ADR 010)**: 新写 cache-first 读路径必须 `isStaleQuoteSource` 过滤（`source ∈ {seed-dev, fixture, alphavantage}` 或 `changePercent == null` → 不信任）。
- **CI gate step 顺序**: typecheck → lint → test 为顺序 step，typecheck fail 时 lint 从不执行会掩盖 lint error；husky pre-commit 有 typecheck gate 但不跑 eslint → **推前本地 `pnpm lint` + `pnpm typecheck` + `pnpm test` 三件套**。
- **硬编码颜色 lint**: 装饰性原始色放 `packages/ui/src/tokens/**`（lint 豁免目录）。
- **失效 eslint-disable**: flat config 没注册 `react-hooks` 插件 → 任何该插件的 disable 注释会报 "rule not found" error。
- **Expo SDK 55**: 根 `pnpm.overrides` 钉 `react@19.2.0`；勿扫非 Arc Metro 二维码。**Expo Go 已不可用**（MMKV/NitroModules）→ 一律 dev build。
- **AKShare wrapper (Vercel)**: 纯 Python 子项目须 `vercel.json` `builds`+`routes`；共享代码放 `lib/`；Hobby 冷启动慢。
- **Tailwind soft-foreground**: 改 `@layer theme` 不够，须 `global.css` `@theme inline` 桥接 `--color-*-soft-foreground`（ADR 003 双命名空间）。
- **Real/Clean env**: `DEV_*_EMAIL` 经 `app.config.ts` → `Constants.expoConfig.extra`；改 `.env` 必须 `pnpm mobile -- --clear`；`envMode=unknown` → 全部 seed 场景隐藏（by design）。
- **Auth email (dev)**: 新 alias 首次 → **Confirm signup** 模板；returning → **Magic Link**；两模板都要 `{{ .Token }}`。
- **app 实际读 `apps/mobile/.env`**（非 root `.env.dev.local`，后者只给 seed 脚本）。
- **Portfolio Hero UAT 首选场景**: DEV FAB → 组合 → `portfolios:30-days-history`。
- 更早的 Stage 1/2 gotchas（FixtureAdapter、OTP 8-digit、DeviationBar 高度、rebalance seed 预热等）见 archive。

## Active env / config snapshot

| File               | Status                                                                                              |
| :----------------- | :-------------------------------------------------------------------------------------------------- |
| `apps/mobile/.env` | Supabase + Finnhub + Tushare + AKShare + `DEV_REAL_EMAIL` / `DEV_CLEAN_EMAIL`（+alias，gitignored） |
| `.env.dev.local`   | `SUPABASE_DEV_*`, `DEV_SEED_EMAIL`（建议 = Clean alias）                                            |
| Resend / Supabase  | `auth.boyangjiao.xyz` Verified · SMTP `noreply@auth.boyangjiao.xyz`（Dashboard 配置，非 repo）      |
| Migrations         | `0001`–`0013` ✅ 全部已应用（dev Supabase）                                                         |
| AKShare wrapper    | `https://arc-akshare-wrapper.vercel.app` + `AKSHARE_WRAPPER_TOKEN` on Vercel（已轮换 06-18）        |
| Supabase project   | `jdvlzkictwinkgcvgwew`                                                                              |
| EAS                | dev build 配置已落地（`46370e6`：eas.json + dev client + 模拟器 profile）                           |

## Recent ADRs (most relevant first)

| ADR     | Topic                                                                                  |
| :------ | :------------------------------------------------------------------------------------- |
| **017** | 数据治理管道 + 源可插拔 + 商用授权发版闸门（Tushare/akshare/聚宽均非商用）— **已接受** |
| **016** | 持仓收益口径（cost-basis since-open）+ 录入分级 + OPENING_SNAPSHOT（v3）— **已接受**   |
| 014/015 | 组合曲线算法 / 持仓行时段涨跌 — 部分/全部被 ADR 016 取代（见各自顶部注释）             |
| 013     | `@arc/ui` wrapper 所有权 + chart L2 polish — 已接受                                    |
| 012     | 双区域 Auth + 数据驻留（方案 A）— **已接受**（实施推后，绑定阿里云迁移轮）             |
| 011     | 多源 fallback + AKShare wrapper — 已接受 + 已实施                                      |

## Testing harness (canonical docs)

| Layer        | Arc artifact                                                                                             |
| :----------- | :------------------------------------------------------------------------------------------------------- |
| Strategy     | [`docs/testing-strategy.md`](../docs/testing-strategy.md)                                                |
| UAT commands | [`docs/dev-seed-cheatsheet.md`](../docs/dev-seed-cheatsheet.md)                                          |
| App DEV FAB  | 功能 → 场景（client JWT）；Daily Snapshot 场景走 Edge `dev-seed`                                         |
| UAT 清单     | [`uat/block-f-uat-checklist.md`](uat/block-f-uat-checklist.md)（Block F 已过；D 区离线缓存待 dev build） |

## How to use this file

1. 新会话：CLAUDE.md → 本文件 → 按任务读对应 feature spec（索引 `feature-specs/README.md`）。
2. 需要历史细节（某 Block 的 commit 链 / 已解决决策 / 旧 handoff）→ `archive/session-state-archive-2026-07-08.md`。
3. End session: `/checkpoint`（遵守顶部瘦身规则：Last updated ≤3 条，多的移档）。
