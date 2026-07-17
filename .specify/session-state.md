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

- **2026-07-17 by Claude Code (Fable 5)** — **Revyl Atlas 基线轮完成 + 进入全量 UX/UI 打磨（branch `dev/ux-polish`）**。(1) **auth-bypass 落地**（PR #14 merged）：`arc://revyl-auth?email&password` → 真实 `signInWithPassword`（ADR 007 合规）；三重防线 = 构建期门禁 `EXPO_PUBLIC_REVYL_BYPASS`（仅 revyl-build/revyl-dev profile）+ Clean 邮箱 allowlist + 凭据走 Revyl org vars；邮箱归一化覆盖深链三形态（+/空格/%2B，云端实测踩坑）。Clean 账号已设密码（`.env.dev.local` `REVYL_BYPASS_PASSWORD`）。(2) **8 个 journey 测试套件**入库（`apps/mobile/.revyl/tests/` + 登录模块），**6 跑 5 过**；Atlas 成图 **14 屏 / 20 转场 / 265 观测**（app.revyl.ai Atlas 页）。(3) **构建踩坑**：`revyl test run` 需静态 release 包（dev client 无 Metro 起不来）→ profile 拆分 revyl-build/revyl-dev；EAS 本地构建 tarball 环境拿不到 `HEROUI_AUTH_TOKEN`（Pro 包装不上 → release 打包解析失败）→ **临时用 xcodebuild 直构 + `revyl build upload` 绕过**，遗留：把 token 放进 EAS env 修正规链路。(4) **两个待查发现**：active portfolio 解析疑似不一致（同账号有的会话空组合有的满配，Atlas 拍到 portfolio_empty_state）；transaction-flow 删除路径未走通（Revyl 报告有录像）。Clean 账号已重 seed 清残留。(5) **BoyangJiao 决策**：Revyl 暂停充值（$20/mo 现阶段不值），**上架前再充一个月做全量回归 + 刷新 Atlas**（测试资产已入库即插即用）；自建**轻量 screen-map**（复刻 Atlas 运行时观测思想）：v0 = 路由清单 + 深链截图 sweep（`tools/screen-map/`，打磨 before/after 基线），v1 = dev-only 导航监听出真实转场图，v2 = 上架后评估独立工具化；**产品化接口（schema 工具无关）、最小化实现**；可视化用 React Flow/SVG 即可，WebGL 属过度工程。
- **2026-07-15 by Claude Code (Fable 5)** — **换机后全仓地毯式排查 + 修复批次（PR #13 + docs PR #12 均已合入）**。排查结论：**换机无损坏**（typecheck/lint/tests/lint:copy 全绿、husky 在位、无密钥入库、铁律零违规、live DB 数据完好）。落地：lint 17 warnings 清零；删 `tools/spike-heroui-native/` + `generate-stage1-design-pen.mjs`（git 历史留档）；换机适配入库（allowBuilds 收敛 + `.nvmrc` + `install-heroui-pro.sh`）；**revyl-build profile 加 `developmentClient`**（原配置 hot reload 连不上 Metro）；**migration 0017（RLS policy 合并 + FK 索引）已应用 live**，advisor `multiple_permissive_policies` 清零（R8 有意保留）；**远端 11 个已合并分支全删，仓库只剩 `main`**；Revyl CLI v0.1.51 已装 + auth 完成。发现：Supabase leaked password protection 为 **Pro 专属**，Free plan 无法开启（advisor 警告不可消，已确认忽略）。**BoyangJiao 决策（2026-07-15，调整锁定时序，已认可）**：Stage 4 前先做**全量 UX/UI 打磨**；顺序 = Revyl Atlas 全量基线 → 打磨（Atlas 当覆盖清单）→ Atlas 回归 → **阿里云迁移规划**；onboarding 设计放**大陆 Auth 方案锁定后**（第一屏=注册登录，Auth 不定设计必重做）；TestFlight 在打磨 + onboarding v1 后、**不等迁移完成**（TestFlight 不需备案；中国区 App Store 上架需 App 备案 = 迁移是硬前置）；**自用上机用 preview build（非 dev build）**，与 Atlas/打磨并行；Apple Developer 账号已注册 ✅。
- **2026-07-08 by Claude Code (remote)** — **文档系统 review + 修复批次**（branch `claude/docs-review-optimization-1so23n`）。修复：project-background 未闭合代码块（§3.2/3.3 含 R7/R8 此前渲染为代码块）；**ADR 017 授权结论回写** legal-risk-map L3/§七 + 风险登记册 R1（旧「Tushare Pro 已含授权」口径清除）；CLAUDE.md 阶段快照（Stage 0→1 更正为 Stage 3→4）/图表栈/seed 命令/skill 表/阅读地图；development-plan §二§三§六 加「已被取代」横幅 + 删孤儿表格碎片；feature-specs README 补 6 份缺失 spec + 状态列对齐 as-built；本文件瘦身（722 行 → 精简版，全量存档零损失）。**同会话另交付**：全部 .specify/docs 文档的 16 项发现 review + 架构/算法/数据源选型按 2026-07 标准的 re-review（结论见会话记录；未修项按优先级列入 §Open items #8）。

## You are here

| Field                 | Value                                                                                                                                                            |
| :-------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Active stage**      | **全量 UX/UI 打磨进行中**（Stage 4 前插入阶段）— PR #10–#14 全部已合 `main`；Release 已上机自用（4 周时钟运行中）；Atlas 基线已立                                |
| **Next step**         | ① screen-map v0（深链截图 sweep → 打磨 before 基线）② 打磨 backlog 整理（首查 active portfolio 解析不一致）③ 逐屏/逐流程打磨                                     |
| **Branch**            | `dev/ux-polish`（打磨主分支，完成后 PR 合 main）                                                                                                                 |
| **Context slug**      | `twr`                                                                                                                                                            |
| **Context bundle**    | `.specify/codectx/twr.xml`                                                                                                                                       |
| **Mobile dev server** | `pnpm mobile` → 8081；改 `.env` / migration 后 **Metro `--clear`**                                                                                               |
| **Out of scope**      | Block E 价格异动后台 job、Finnhub Vercel proxy、大陆 Auth（ADR 012 P1）实现 — 全部绑定**阿里云迁移轮**；多平台 CSV profile（按真实模板逐个加，架构 seam 已就位） |

## 🗺️ 时序（BoyangJiao 锁定 2026-06-02；2026-07-15 认可调整；改动需其同意）

```
1. Block F UAT ✅ → 2. UI/UX 地基打磨 ✅ → 3. Stage 3 全量合 main（PR #10–13）✅
→ 4. preview build 上机自用 ✅（时钟运行中）＋ Revyl Atlas 基线 ✅（14 屏图已立）
→ 5. 全量 UX/UI 打磨（screen-map + Atlas 当覆盖清单 + 自用反馈驱动）← 当前
→ 6. 阿里云迁移规划（ADR：架构 / 大陆 Auth / 备案主体）→ onboarding 设计（Auth 方案锁定后）
→ 7. Stage 4：onboarding 实现 → TestFlight（不等迁移完成）→ IAP → 迁移实施 + App 备案 → 中国区上架
```

- **自用 = preview build**（release、JS 内嵌、独立运行）；dev build 无 bundle 必须连 Metro，只用于开发。Expo Go 不可用（MMKV/NitroModules）。
- **中国区 App Store 上架强制 App 备案（需国内服务器）→ 阿里云迁移是上架硬前置**；TestFlight 内测不需要备案号，可先行。
- UI/UX 第二波（使用驱动精修）依赖 4 周自用数据，与第 5 步打磨合流。

## ⏸️ 有意推后（不是漏做）

| 项                                | 为何推后                                                             | 目标节点                            |
| :-------------------------------- | :------------------------------------------------------------------- | :---------------------------------- |
| Inbox 推送 + 价格异动后台         | 需 Edge Function+cron+APNs；迁移前不建新 Vercel                      | 阿里云迁移轮                        |
| 订阅打通 + 支付（IAP/Stripe）     | 上架级工程；需自用反馈 + 计价策略                                    | Stage 4                             |
| new user onboarding               | 设计依赖大陆 Auth 方案（第一屏=注册登录）+ 自用困惑点                | 设计=Auth 方案锁定后；实现=Stage 4  |
| UI/UX 第二波（使用驱动精修）      | 需 4 周自用数据                                                      | 与全量打磨（时序第 5 步）合流       |
| TestFlight                        | 给外部测试者的渠道，自用不需要；内测无需 App 备案                    | 打磨 + onboarding v1 后（不等迁移） |
| 收益报告「已实现」列              | `realized-pnl-fx-stage-3.md`（Draft）；需历史 FX-at-sale 查询        | 新会话（focused）                   |
| Performance Attribution 实施      | spec Accepted 未实施（`performance-attribution-stage-3.md`）         | 待排期                              |
| #12 资产位置（按平台/账户）       | 需 DB migration `transactions.account` + 录入表单；BoyangJiao 暂跳过 | 待定                                |
| benchmark beta（vs 基准回归系数） | 指数对标已落地，beta 算法 deferred                                   | 待排期                              |
| Revyl 付费全量回归 + Atlas 刷新   | 免费额度尽；$20/mo 现阶段不值；测试资产已入库即插即用                | 上架前（充一个月）                  |

## Open items / known bugs（未修，按发现时间）

1. **风险页年化波动率 450% / 回撤 -54.8% 异常** = 快照 totalValue 序列脏数据/尖刺（2026-06-18 发现，数据质量 bug，未修）。
2. 指数对标 forward-fill 修复后**真机复验**是否出数据；多基准分组柱颜色/拥挤度；全部 Skia 图表真机渲染（06-17/06-18 待 UAT 项）。
3. **active portfolio 解析疑似不一致**（2026-07-17 Atlas 基线发现：同 Clean 账号部分会话见空组合；查 `resolve-active-portfolio` + 默认组合自愈逻辑；Revyl 报告有录像）。
4. **transaction-flow 删除路径未走通**（2026-07-17：云端测试搜不到刚加的 600519 完成删除；需人工复现判定 app bug vs 测试措辞）。
5. **assets 元数据 first-writer 永不 enrich**（需 UPDATE policy 设计，待 BoyangJiao 决策）。
6. **R7 客户端内嵌数据源 key / R8 共享缓存表投毒** — 上架 blocker，随阿里云迁移轮做 Edge Function 代理 + RLS 收敛（风险登记册 + ADR 017）。
7. MMKV 加密 key 的 expo-crypto follow-up（沙箱装不上，暂用 Web Crypto getRandomValues + Math.random 兜底）。
8. TWR known limitations FU-1…FU-5（批量 fallback 拉价 / Sentry 接管 warn / from clamp / FX_LOOKBACK / useAssetTwr 双拉价）见 `twr-stage-3.md §Known limitations`。
9. `export.tsx` 错误 Alert 读 stale-closure errorMessage（建议改内联渲染，非阻塞）。
10. 文档层遗留（2026-07-08 review 的 P1/P2 项）：stage-acceptance-criteria Stage 3 段回填或降级定位；product-roadmap 订阅/CSV 口径与 roadmap 决策 2 矛盾；information-architecture「以本文件为准」条款 vs as-built 漂移；polish-backlog 核销一轮；handoffs/ 归档；HARNESS.md pre-commit typecheck gate 未回写；\_RESTRUCTURE-PLAN 触发器状态行过期（stage-3 已 16 份）。

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
- **自用上机 = preview build**：dev build 无内嵌 JS，必须连 Metro（同 WiFi 或 --tunnel）；preview 与 dev build 同 bundleId（`com.arc.portfolio`）**互相覆盖**，想并存需 app variant。
- **EAS 云构建不上传 gitignored `.env`** → `EXPO_PUBLIC_*` 要么 `eas env:push` 上云，要么 `--local` 构建（读本地 .env）。
- **Revyl**: 装 CLI 用 `brew install RevylAI/tap/revyl`（换机必装）；Atlas 由跑过的会话/测试自动成图，无需单独操作。
- **Portfolio Hero UAT 首选场景**: DEV FAB → 组合 → `portfolios:30-days-history`。
- 更早的 Stage 1/2 gotchas（FixtureAdapter、OTP 8-digit、DeviationBar 高度、rebalance seed 预热等）见 archive。

## Active env / config snapshot

| File               | Status                                                                                                                  |
| :----------------- | :---------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile/.env` | Supabase + Finnhub + Tushare + AKShare + `DEV_REAL_EMAIL` / `DEV_CLEAN_EMAIL`（+alias，gitignored）                     |
| `.env.dev.local`   | `SUPABASE_DEV_*`, `DEV_SEED_EMAIL`（建议 = Clean alias）                                                                |
| Resend / Supabase  | `auth.boyangjiao.xyz` Verified · SMTP `noreply@auth.boyangjiao.xyz`（Dashboard 配置，非 repo）                          |
| Migrations         | `0001`–`0017` ✅ 全部已应用（0017 = RLS 合并 + FK 索引，2026-07-15 经 MCP 应用并复验 advisor）                          |
| AKShare wrapper    | `https://arc-akshare-wrapper.vercel.app` + `AKSHARE_WRAPPER_TOKEN` on Vercel（已轮换 06-18）                            |
| Supabase project   | `jdvlzkictwinkgcvgwew`（Free plan — leaked password protection 不可用，advisor 该警告忽略）                             |
| EAS                | 5 profile 就绪：development / development-simulator / preview（自用）/ production / revyl-build（含 developmentClient） |
| Revyl              | CLI v0.1.51（brew `RevylAI/tap/revyl`）已认证；config `apps/mobile/.revyl/config.yaml`（Metro 8082 / scheme arc）       |
| Node               | `.nvmrc` = 22.22.1（换机后 `nvm use` 即可）                                                                             |

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
