# Arc — Session State (Live)

> **READ THIS FIRST in every new AI session** (Cursor, Claude Code, Qoder, etc.).
>
> Update mechanism: `/checkpoint` (Cursor command or Claude skill).
>
> **Never write here:** API keys, JWTs, `DATABASE_URL`, `.env` contents, or other secrets.
>
> **Last updated**: 2026-06-01 by Sonnet 4.6 — **Block F CSV 导入全链路实现完成**（6 commits `3491e91`→`7bfa70f` on `dev/stage-3`，未 push）。commit 链：`3491e91`（expo-document-picker SDK 55）→ `4caafcd`（L1 csv-raw-parse + L3 csv-to-transactions + 34 单测）→ `7f0e851`（L2 profiles arc-native + registry + 15 单测 AC.FI.12）→ `a1c64ba`（use-csv-import hook：pick+parse+importValid，US 跳在线校验，ensureAssetRow 复用）→ `2b13fe5`（/me/import 3-step 页 + Me 入口 + i18n 22 键 en+zh）→ `7bfa70f`（spec Implemented + session-state bump）。6/6 typecheck ✅ · 142/142 tests ✅ · lint:copy clean ✅。**待 BoyangJiao UAT**：S3-AC-FI.1–FI.12（特别是 FI.7 round-trip：导出 A → 导入到空 B → B 持仓 == A 持仓）。
>
> **Last updated**: 2026-06-01 by Opus 4.8（续）— **Block F CSV 导出 review+push + 导入 spec 起草**。(1) **CSV 导出 review 通过并 push**（Sonnet 5 commit `f45e3bc`→`864ee0a`，用户 UAT F.1–F.8 全过）：`transactions-to-csv` 纯函数（RFC 4180 + Decimal 全精度）/ `useAllTransactions`（portfolios join + RLS 单查）/ `/me/export` 三态页 / i18n 复数形式。(2) **工作区杂项按用户决策拆 2 独立 commit**：`6d92f91` **fix(core)** computeDailyDelta 跨币种 bug（之前 baseline.valueReporting 减今日 valueReporting，切币种后跨币种相减违反不变性 §4 → 改用 native 币种算 delta 再按今日 FX 换算；+3 测试，core 183 绿）；`a5d8b0e` **chore(mobile)** 隐藏每日盈亏卡（flag `SHOW_DAILY_SNAPSHOT_CARD=false`，feature 完整保留）。**已 push** `2d4094f..a5d8b0e`，CI 绿。(3) **pre-commit typecheck gate 实战生效**（fix(core) commit 时触发并通过）。(4) **Block F CSV 导入 spec = Draft 起草完**（`csv-import-stage-3.md`；7 决策 + 5 commit 链 + 11 AC + 交接 prompt；列契约复用导出、round-trip AC.FI.7）→ **待用户确认 2 个待定决策（1a 忽略 CSV portfolio_id / 4a 导入跳 US 在线校验）后交接 Sonnet**。**非阻塞 bug 记录**：`export.tsx:25` 错误 Alert 读 stale-closure errorMessage，不会可靠触发（建议改内联渲染）。
>
> **Last updated**: 2026-06-01 by Sonnet 4.6 — **Block F CSV 导出全链路实现完成**（5 commits on `dev/stage-3`，未 push）。commit 链：`f45e3bc`（expo-file-system+sharing SDK 55）→ `9695152`（transactions-to-csv 纯函数 + 17 单测 AC.6/AC.8）→ `9db2726`（useAllTransactions all-portfolio query + useCsvExport hook SDK 55 File API + web Blob 降级）→ `31b5bb2`（/me/export 确认页 + Me 入口行 + i18n export.\* en+zh）→ spec Implemented。6/6 typecheck ✅ · 76/76 tests ✅ · lint:copy clean ✅。**待 BoyangJiao UAT**：S3-AC-F.1–F.8（Me → 导出数据 → 确认页计数 → 导出 CSV → 系统分享 → 存文件 → Excel 打开）。
>
> **Last updated**: 2026-06-01 by Opus 4.8（续）— **真机复验通过 + 收尾杂务**。(1) 用户**真机复验语言/币种持久化通过**（commit `0cf0cb9` 确认有效）。(2) **2 个旧 stash 已 drop**（均经审查确认可弃）：`stash@{1}` = 陈旧 lint-staged 备份（文件已在 HEAD 且 HEAD 更新）；`stash@{0}` = 废弃的 akshare WIP —— 会**删掉 `fetch_search`**（`search.py` 依赖，破坏 Block C 搜索）+ 把 session-state 回退到 05-20，**不可恢复**。(3) **pre-commit 加 typecheck gate**：lint-staged 只跑 prettier/eslint 不跑 tsc（Block E 曾漏一个 HeroUI prop 类型错误到 CI）→ 现在暂存含 .ts/.tsx 时跑 turbo-cached `pnpm typecheck`，红就拦。(4) **Block F CSV 导出 spec = Accepted**（`csv-export-stage-3.md`；决策 1a=全部 portfolio、决策 4=确认页，按最佳 UX 定稿）→ **可交接 Sonnet 实现**（5-commit 链 + 交接 prompt 已在 spec 内）。⚠️ 现有 `useTransactions` 仅 per-portfolio，commit 3 需新增 all-portfolio query。
>
> **Last updated**: 2026-06-01 by Opus 4.8 — **Block E P1+P2 收尾 + UAT bugfix + push**。用户 UAT 通过，报 1 个问题：**币种/语言设置未持久化**。诊断（查 live DB 确认写入成功）：(1) **语言 = 真 boot bug** — i18n 硬编码 `lng` 初始化，唯一 `changeLanguage` 在 Settings toggle，冷启动不重新应用 `prefs.locale` → 英文回退中文；修复：AppShell `useEffect` 按 `prefs.locale` 调 `changeLanguage`（仿 `BusinessTokensProvider` 消费 `financeColorMode`）。(2) **币种 = 非持久化 bug**（DB 行正确）— `activePortfolio.reportingCurrency` 在 Portfolio Tab + daily-snapshot 盖过全局 Settings 币种；**用户决策：全局币种为准**，per-portfolio 币种只作新建默认值；2 处 `?? ` 顺序反转。commit `0cf0cb9`。typecheck 6/6 · test 全绿 · lint 0err · copy clean。**已 push**（branch 22 ahead → origin/dev/stage-3；PR #10 open）。**⚠️ 该 fix gate-green 但用户未在真机复验**（建议重启 App 验证语言/币种保持）。**⚠️ 2 个旧 stash 仍未动**：`stash@{0}` wip akshare P1（疑似前序未完成，需用户确认）/ `stash@{1}` lint-staged 备份。**下一步：Block F 启动准备**（CSV 进出 + P2 收尾；见 roadmap §三 Block F）。
>
> **Last updated**: 2026-05-31 by Opus 4.8 — **Block E P1+P2 全部代码完成**（on `dev/stage-3`，**未 push**）。**P1**（4 commit `465ef68`/`bed5162`/`4ea64ec`/`aa0e18c`）：份额/数量脱敏收口（`formatShares`，4 处 render 接 `amountsHidden`；脱敏单一控制点 = Hero 眼睛，不加 Settings 镜像开关）+ `/me/inbox` 空态 + 三态审计（5 主 journey 已全合规，无需改码）+ 6 个 formatShares 单测。**P2**（1 commit `8d1b71c`，用户选做 AI+订阅、跳过价格异动后台 job）：`/ai` 占位页（Insights header Sparkle 图标入口；「即将推出」+ disabled 预设问句 chip，不接 LLM）+ `/me/subscription` 三档占位（Free/Pro/Pro+ 卡片 + feature bullets，无定价数字、无支付；计价策略仍待 Opus 讨论）；`ai.*`/`subscription.*` i18n en+zh；`/ai` 注册进 root stack。typecheck 6/6 ✅ · test 58(mobile) 全绿 ✅ · lint 0err · lint:copy clean。**验证方式**：单测 + typecheck + 三态审计（**未启动模拟器**，纯显示层改动）。**剩**：BoyangJiao 统一 UAT + push。**⚠️ 2 个旧 stash 未动**：`stash@{0}` wip akshare P1 + session-state（疑似前序未完成工作，需用户确认）/ `stash@{1}` lint-staged 自动备份。**P2 延后**：价格异动检测后台 job→Inbox（需 Edge Function+migration+cron+阈值算法，与阿里云迁移前不建新 Vercel 的纪律绑定）。
>
> **Last updated**: 2026-05-31 by Opus 4.8 — **Stage 3 Block E P1 启动**（spec `block-e-experience-polish-stage-3.md` 起草）。实测推翻 roadmap「脱敏待建」假设：`formatMoneyMasked`+`useAmountRedacted`（已 Supabase `user_preferences.redacted` 持久化）+ Hero 眼睛切换 + ~13 屏 **早已落地**；Block E 收敛为「收口+补缺口」。本轮 2 commit on `dev/stage-3`（**未 push**）：(C1 `465ef68`→prettier 后 `c759869`) **份额/数量脱敏收口** — 新增 `formatShares()`（mirror `formatMoney` redact），4 处 share render（Portfolio Tab/组合详情/Asset 详情/交易历史）接 `amountsHidden`（份额×公开净值可反推 → BoyangJiao 确认须脱；百分比+颜色不变 ADR 003 §决策六）。(C2 `c2da7c0`) **`/me/inbox` 空态** + Me 入口（Settings 上方）+ `inbox.*` i18n（en+zh）；roadmap §七 决策4 先空态、不建表、不接数据源。typecheck 6/6 ✅ · tests 92+40+52 ✅ · lint 0err · lint:copy 0。**Commit 3（empty/loading/error 三态审计）✅**：抽查 5 条主 journey（Portfolio/Markets/Insights/Asset/PnL）三态**已全部合规**（无白屏/裸 spinner/不可读错误）→ **无需改码**（审计表见 spec §体验闭环审计结论）。follow-up（非阻塞）：Insights/PnL 上游 query error 以落空态兜底，Stage 4 可加显式 error+retry。**决策**：脱敏单一控制点 = Hero 眼睛（全局 `redacted`），**不加 Settings 镜像开关**（同一份状态，双入口无价值，已与 BoyangJiao 核对）。**剩**：BoyangJiao UAT（份额脱敏 S3-AC-E.1/E.3 + Inbox S3-AC-E.4）+ push（沿 Block C/D 节奏，UAT 后评估并入 PR #10）。Block E P2（AI/订阅占位 + 价格异动后台 job）显式延后。
>
> **Last updated**: 2026-05-30 by Opus 4.8 — **P1 #4 盈亏分析 Insights 模块全栈落地**。本轮 6 commit（`295e0b5`→`3eab00e` on `dev/stage-3`，**未 push**）实现 `pnl-analysis-insights.md` 全部 commit 链：(C2 `295e0b5`) **core 算法** `@arc/core/returns/period-pnl.ts` — `computePeriodPnl`（时段市值变化 §决策4 / cost-basis 累计回报率曲线 §决策3 / 已实现盈亏 §决策5 / per-asset 排行 §决策6+AC.1.7 含分红 / MWR via XIRR §决策1）+ `computeRealizedPnlInPeriod`；chronological replay 复刻 `computeHoldings` 累加器语义保证与持仓行闭环（AC.1.1）；**MWR 拆成 `mwrPeriod`（去年化）+ `mwrAnnualized`（原始 XIRR）** 解决 spec 单 `mwr` 字段的 period/annualized 二义性；sign-change guard 防 XIRR 同号假收敛；退化→null 不出 NaN。18 测试（12 unit + 6 property），`@arc/core` 180/180 ✅。(spec sync `dac1273`) 契约同步实现真实形状。(C3 `b594d21`) **mobile hooks** `usePnlAnalysis`（snapshots → `computeFullValuationAtDate` bootstrap + 预解析同步历史 FX map 喂纯算法）+ `pnl-presenter.buildCumulativePnlSummary`（时间范围无关，复用 holdings-presenter 公式闭环 AC.2.2）。(C4 `f28af79`) **`CumulativeReturnChart`** + `chart-percent-axis`（曲线锚定 0% AC.1.5，复用 AreaChart 涨跌色 AC.3.3，无 scrub §决策10）。(C5 `c2534b5`) **3 张卡 + RankingRow**（presentational，screen 传 PnlSign）。(C7 `2d6f0df`) **i18n `insights.pnl.*`** zh+en。(C6 `3eab00e`) **`/insights/pnl-analysis` route + Insights Tab 入口卡 + Hero「本期市值变化」chip → 透传 range**（PortfolioHeroSection 加 optional `onPeriodChangePress`）。typecheck 6/6 ✅ · 全测试 51 文件 ✅ · lint 0 error。**⚠️ 待 BoyangJiao Real Env UAT 对账（AC.5：累计盈亏 vs 持仓行 sum / MWR vs 支付宝）**。注：C7 i18n 顺手带入工作区已有的 transaction-history 文案（非本特性）；另有未 commit 的工作区文件（AssetTransactionHistorySection.tsx / asset [symbol].tsx / Screen.tsx）仍属前序 WIP，未动。
>
> **2026-05-30 by Opus 4.8（前一轮）** — **CI 绿了 + Sonnet P1 #1–#3 收尾**。本轮 7 commit（`38e4268`→`7521b59`）：(1) **P0 CI fix** — 把 Cursor 留下的 ~10 untracked files 按主题拆 2 commit（`38e4268` Asset Detail chart 重构 / `fa2410e` 隐私 mask + 持仓排序）落地；(2) **ADR 016 v3**（`46577da`）持有收益含分红语义入文档 + costBasis tooltip i18n；(3) **Feature ① 单标的交易历史**（`8ffa688` hooks + `5ad152b` swipe-to-delete section）；(3) **Block D Phase 2 TWR layout polish**（`dc589f9`）ADR 016 §决策 4 视觉层次 — TWR 大字 prominent + 持有收益 小字 + 双 ⓘ tooltip（抽出共享 `InfoTooltipButton` + 新 `HoldingReturnInlineLabel`）；(4) **CI 二次修绿**（`7521b59`）— typecheck 转绿后 lint step 才跑到，暴露两个 pre-existing lint error（`asset-avatar-utils.ts` 6 hex → 移到 `tokens/avatar-gradients.ts`；`sign-in.tsx` 失效的 react-hooks eslint-disable → 删）。**CI ✅ green**（run `26676119184` success）。**P1 剩 #4 盈亏分析 Insights 模块**（独立 stream，需先写 spec）。
>
> **2026-05-30 by Opus 4.7** — **Real Env P0 dogfooding 全部通过**（cost-basis / Hero / 持仓行 / 美股 filter / 506002 分红 +¥45,125 全对齐支付宝）。9 commit（`07f9c5d`→`9ee81d5`）。⛔ 当时遗留 untracked-files CI blocker → 已由 Opus 4.8 本轮解决。
>
> **2026-05-29 by Opus 4.7** — Real Env dogfooding 反馈 4 bug：(1) 506002 收益率 137% vs 支付宝 150%（root cause = 3 现金分红 ¥3,920 未算入）→ 修复 commit `07f9c5d`（持仓行）+ `9ee81d5`（Asset Detail parity）；(2) 默认 1M（Hero）vs 1Y（Asset Detail）不一致 → 统一 3M；(3) 美股 finnhub 网络抖动 → A retry + backoff 落地（`d487b21`），C Vercel proxy **延后到阿里云迁移那一轮**（避免重复 port 成本）；(4) filter 切换 range 跳 1Y → revert filter→smart-default 耦合 → range 跨 filter 持久化。同时 i18n 派息 → 分红 + 自选 star button 在 Asset Detail header 落地。
>
> **2026-05-28 by Opus 4.7** — **ADR 016 v2 修订定稿**（BoyangJiao confirm）：完全移除 `OPENING_SNAPSHOT` + AV `outputsize=full` hotfix。
>
> **2026-05-27 by Composer (Cursor)** — **ADR 016 v1 主线 commit #1–#8 已落地**（`4cc4a77`…`66cfa53` on `dev/stage-3`）。`pnpm typecheck` 6/6 ✅ · `@arc/core` 155 tests ✅ · `@arc/mobile` 31 tests ✅。**v1 OPENING_SNAPSHOT 部分将由 v2 全面清除**（钱往实证不需要分流；用户认知成本 > 价值）。
>
> **2026-05-26 by Sonnet 4.6 (Cursor)** — Dogfooding 发现 ALL 视图持仓收益率算法漏洞（对照支付宝实测 000216 黄金 ETF 联接 A 显示 +23.99% vs 支付宝 +18.66%，差 5.33pp，含算法侧 +800% 极端反例 + 录入摩擦 ¥2,574 量级双重根因）。讨论产物：[`.specify/handoffs/opus-review-holdings-return-algorithm.md`](handoffs/opus-review-holdings-return-algorithm.md)（已被 ADR 016 解决）。
>
> **2026-05-25 by Composer (Cursor)**: Real / Clean 双环境 J-RE.1 ✅ 用户 UAT 跑通；Resend `auth.boyangjiao.xyz` Verified；Supabase Custom SMTP `noreply@auth.boyangjiao.xyz`。代码链 `2a81c6b`…`53d9034` on `dev/stage-3`（ahead 7+，含未 commit 的 ADR 014/015 + holdings-presenter / portfolio-chart-bootstrap / use-portfolio-chart-series 等改动）。

---

## You are here

| Field                 | Value                                                                                                                                                                                                                                                                          |
| :-------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Active stage**      | **Stage 3 — Block F CSV 导出 ✅ + CSV 导入代码完成 ✅**（导入 6 commits `3491e91`→`2b13fe5`，`dev/stage-3`，未 push）→ **下一步 = BoyangJiao UAT S3-AC-FI.1–FI.12 + push + PR**                                                                                                |
| **Step (Block C)**    | **UAT ✅ all S3-AC-C.1–C.12 passed**. Pending: 已 push 至 PR #10，待 review                                                                                                                                                                                                    |
| **Step (Block D)**    | **Phase 1 ✅ algorithm** + **Phase 2 ✅ UI 接入**：Asset Detail TWR 大字 prominent + 持有收益 小字 + 双 ⓘ tooltip（ADR 016 §决策 4 layout，commit `dc589f9`）。**Next** = Phase 3 雪球对标（需 ≥6 月真实数据）+ PA/Drawdown specs（Opus）                                      |
| **Step (Real Env)**   | **dogfooding P0 通过**：cost-basis 含手续费 + 含分红、Hero scrub、市场 filter、新建仓 daily delta、Asset Detail parity 全 OK；Finnhub C 延后；Expo Go 扫码失败为 SDK 55 商店版本不兼容（非本仓 bug）                                                                           |
| **Branch**            | `dev/stage-3` (**ahead 6** vs `origin/dev/stage-3`；P1 #4 盈亏分析 6 commit 未 push)                                                                                                                                                                                           |
| **Last commit**       | `2b13fe5` `feat(mobile): /me/import 3-step screen + Me entry + i18n (S3-AC-FI.1–FI.11)`                                                                                                                                                                                        |
| **Context slug**      | `holdings-and-transactions`                                                                                                                                                                                                                                                    |
| **Context bundle**    | `.specify/codectx/holdings-and-transactions.xml`                                                                                                                                                                                                                               |
| **PR**                | **#10 opened**: https://github.com/BoyangJiao/arc/pull/10 (`dev/stage-3 → main`)；**CI ✅ green**                                                                                                                                                                              |
| **CI status**         | **✅ Pre-push Quality Gate GREEN on `7521b59`**（run `26676119184` success）。lint 6/6 + typecheck 6/6 + tests 全绿。根因复盘：CI gate lint step 排在 typecheck 之后，之前 typecheck 一直 fail 所以 lint 从没跑到 → typecheck 修绿后才暴露两个 pre-existing lint error（已修） |
| **Mobile dev server** | `pnpm mobile` → 8081；改 `.env` / migration 后 **Metro `--clear`**                                                                                                                                                                                                             |
| **Out of scope**      | Block E 价格异动后台 job（阿里云迁移绑定）、大陆 Auth (ADR 012 P1) 实现；**Finnhub C Vercel proxy 延后到阿里云迁移那一轮**；多平台 CSV profile（支付宝/IBKR/雪球 — 按真实模板逐个加，架构 seam 已就位）                                                                        |

## Sonnet P1 handoff（2026-05-30 by BoyangJiao）— **P0 + #1–#3 ✅ DONE（Opus 4.8）**

**Real Env P0 全过** → Opus 4.7 修 dogfooding bug → Sonnet 收 P1 → **Opus 4.8 接管收尾 P0 CI + P1 #1–#3，全部落地 + CI 绿**。剩 P1 #4。

### 🔥 P0 — ✅ DONE（commit `38e4268` + `fa2410e`，CI 二修 `7521b59`）

untracked-files CI blocker 已用方案 (c) 解决：按主题拆 2 commit（Asset Detail chart 重构 / 隐私 mask + 持仓排序），全部 untracked + modified 文件 review 后落地。**二次 CI fail**（lint，非 typecheck）已修：见下方 §"Critical mental model" 新增 gotcha「CI gate step 顺序」。

### 🟡 P1 — #1–#3 ✅ DONE，#4 待启动

1. **ADR 016 文档 v3 更新** — ✅ DONE（`46577da`）。§决策 2/4 持有收益含分红语义 + costBasis tooltip i18n（en+zh）+ v3 摘要 block。i18n label 已是「持有收益 / Holding return」。
2. **Feature ① 单标的交易历史** — ✅ DONE（`8ffa688` `useDeleteTransaction`+`useAssetTransactions` hooks / `5ad152b` `AssetTransactionHistorySection` swipe-to-delete）。
3. **Block D Phase 2 TWR layout polish** — ✅ DONE（`dc589f9`）。TWR 大字 prominent（`TwrInlineLabel size="prominent"`）+ 持有收益 小字（新 `HoldingReturnInlineLabel`）+ 双 ⓘ tooltip（抽出共享 `InfoTooltipButton`）。`use-asset-detail` 新增 `unrealizedPnLPercent`。i18n `assetDetail.unrealizedPnL` → `assetDetail.holdingReturn.{label,tooltipTitle}`。

4. **Insights 盈亏分析模块** — ✅ **DONE（代码完成，`295e0b5`→`3eab00e`，6 commit）**。spec `pnl-analysis-insights.md` 全 commit 链落地：core `period-pnl.ts`（含 18 测试）/ `usePnlAnalysis` hook + `pnl-presenter` / `CumulativeReturnChart` / 3 卡 + RankingRow / i18n / `/insights/pnl-analysis` route + 2 入口（Insights Tab 卡 + Hero chip）。typecheck 6/6 + 全测试 + lint 0err 全绿。**剩：BoyangJiao Real Env UAT 对账（AC.5.1 累计盈亏 == 持仓行 sum / AC.5.2 MWR vs 支付宝 ≤0.5pp / AC.5.3 已实现 ¥0）+ push + 评估并入 PR #10。** 实现关键点见 §"Last updated" 顶部 block。
   - ADR 016 §决策 7 + §六 已规划，feature spec 未写
   - 仿 IBKR 业绩 tab + 钱往 详情页：MWR 曲线 + cost-basis 累计回报 + 已实现/未实现盈亏 + 盈亏排行
   - **建议先写 spec** `.specify/feature-specs/stage-3/pnl-analysis-insights.md`（架构/设计 = Opus 主场）再分拆 commit
   - 可复用：Block D `xirr`（MWR）、`computeAssetTwr`、`HoldingReturnInlineLabel`、`InfoTooltipButton`、charts L2

### 阿里云迁移上下文（P3 — 不在本次 P1 范围）

BoyangJiao 提到 Vercel + Supabase → 阿里云 (国内后端) 的长期迁移。**Sonnet 在 P1 期间不要建新 Vercel 项目**（如 Finnhub proxy）—— Finnhub A 已经 retry + backoff，剩余抖动可接受；Finnhub C 等迁移那一轮一起在 阿里云 函数计算 上做。完整分析见 Opus 2026-05-30 conversation §"阿里云 迁移".

### Real Env 数据现状

BoyangJiao 已经在 Real Env 录入了 7 个 CN 基金（000216 / 506002 / 003015 / 007346 / 012831 / 014344 / 018078）+ 2 个 US stock（IEF / UBER）。Cost-basis 数字全部跟支付宝对得上：

| 资产                           | 支付宝 持有收益率 | Arc 显示 |           差           |
| :----------------------------- | :---------------- | :------- | :--------------------: |
| 000216（华安黄金 ETF 联接 A）  | +18.66%           | +18.66%  |          0 ✅          |
| 506002（易方达科创板两年定开） | +150.14%          | +150.14% | 0 ✅（修 P0 含分红后） |
| 其他 5 个基金 + 2 个美股       | 各自支付宝数      | 全部对齐 |           ✅           |

## Stage 2 — J7 Daily Snapshot progress

| Item                                                                  | Status                                             |
| :-------------------------------------------------------------------- | :------------------------------------------------- |
| DB migration `0003` (`portfolio_value_snapshots` + `per_asset` + RLS) | ✅ applied on dev Supabase                         |
| `computeDailyDelta` + property tests                                  | ✅ committed                                       |
| `DailySnapshotCard` + Portfolio Tab integration                       | ✅ committed                                       |
| `daily-snapshot` Edge Function + GH Actions cron                      | ✅ committed (ADR 009)                             |
| `seed:dev` + `--scenario` (6 UI states)                               | ✅ committed                                       |
| **S2-AC-1.1–1.5 UAT**                                                 | ✅ user verified 2026-05-17                        |
| S2-AC-1.6 / 1.7 (cron idempotent, no external API)                    | ⏳ not formally signed off                         |
| S1-AC-5 (red-up/green-down via card)                                  | ✅ `daily-snapshot:mixed-movers` + Settings toggle |

## Stage 2 — J8 Watchlist progress (started 2026-05-18)

| Item                                                                       | Status                                                 |
| :------------------------------------------------------------------------- | :----------------------------------------------------- |
| Feature spec (`watchlist-stage-2.md`) Accepted                             | ✅ `70bd38e`                                           |
| Commit plan **#1–#8** (schema → core → adapter → UI → hooks → seed → docs) | ✅ `0b2c1fd` … `082ab0e`                               |
| Migration **0004** applied on dev Supabase                                 | ✅ **user confirmed** (SQL Editor)                     |
| **UAT S2-AC-2.1–2.3, 2.6, 2.7**                                            | ✅ user verified 2026-05-18                            |
| **UAT** quote error banner + **DEV「模拟自选限流」**                       | ✅ sim + real `RateLimitError` path                    |
| **UAT S2-AC-2.4 / 2.5 / 2.8**                                              | ⏳ optional before merge (AV + logs / tests)           |
| **Migration `0005`** (`change_percent` on `price_snapshots`)               | ✅ **user confirmed applied** (SQL Editor, 2026-05-18) |
| **J8 polish + cache correctness**                                          | ✅ 与本 session UI polish 一并入库（见最新 commit）    |

### J8 wrap-up commits (2026-05-18 — three slices)

1. `feat(db): migration 0005 …` — `0005_price_snapshots_change_percent.sql` + Drizzle schema
2. `feat(data-sources+mobile): …` — quote cache `changePercent`, watchlist pull/banner lifecycle, `markets` + `search`
3. `feat(mobile+seed): …` — DEV rate-limit sim, client/Edge seed `change_percent`, dev panel + i18n + `seed-core` prettier fix + this `session-state` bump

_(Prior “uncommitted work” table superseded by the above.)_

## Stage 2 — J9 Rebalance progress (started 2026-05-18)

| Item                                                                                                                       | Status                                                                   |
| :------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------- |
| Feature spec (`rebalance-stage-2.md`) Accepted — 4 structural + 6 tactical decisions locked                                | ✅ `b5e662e`                                                             |
| **Commit plan #1** migration 0006/0007/0008 + `target_allocations` Drizzle schema + CASH market                            | ✅ `e1caaf7` + `10d656d` (split for PG `ALTER TYPE` gotcha)              |
| Migration 0006 / 0007 / 0008 applied on dev Supabase                                                                       | ✅ **user confirmed**                                                    |
| **Commit plan #4** CASH price adapter (`createCashPriceAdapter`) + registry + tests                                        | ✅ `85301fe`                                                             |
| **Commit plan #2** `rebalance/rounding.ts` (per-market step-size + truncate toward zero)                                   | ✅ `3752491`                                                             |
| **Commit plan #3** `rebalance/index.ts` fill in + property tests (26 tests, all green)                                     | ✅ `3752491`                                                             |
| **Commit plan #5** `TargetAllocationForm` + `DeviationDonut` + `DeviationBar` + `RebalanceActionList` in `@arc/ui/finance` | ✅ `23b2eb7`                                                             |
| **Commit plan #6** `use-target-allocations` + `use-rebalance` hooks + Insights Tab integration                             | ✅ `8c0936f`                                                             |
| **Commit plan #7** `/insights/rebalance/setup` modal + `/insights/rebalance/actions` screen                                | ✅ `5cf545a`                                                             |
| **Commit plan #8** `/me/cash-balances` form (writes BUY/SELL on CASH:\* assets)                                            | ✅ `fa9caab`                                                             |
| **Commit plan #9** 4 seed scenarios + Dev panel feature group registration                                                 | ✅ `57b4380`                                                             |
| **Commit plan #10** `pnpm lint:copy` script + `user-journeys.md` J9 sync                                                   | ✅ `dbe4807`                                                             |
| **UAT bugfix** DeviationBar RN 高度撑满屏（`h-2` 失效 → 固定 8px + 按 \|deviation\| 画条）                                 | ✅ 代码已改，**未 commit**                                               |
| **UAT bugfix** rebalance DEV 三场景 targets 相同 + fixture 忽略 DB 报价 → 场景无差异                                       | ✅ `rebalance-seed-plans.ts` + `warmRebalanceMarketCache`，**未 commit** |
| **Migration 0009** `assets` RLS 允许 authenticated INSERT `CASH`（DEV seed 写 CASH 资产）                                  | ⏳ SQL 文件已写，**用户需在 Supabase 执行**                              |

## Stage 2 — J6 Welcome progress (2026-05-19)

| Item                                                           | Status                                                                                                                           |
| :------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------- |
| Feature spec (`welcome-stage-2.md`) Accepted 2026-05-19        | ✅                                                                                                                               |
| Commit **#1** `/welcome` route + i18n                          | ✅ `4ae3da6`                                                                                                                     |
| Commit **#2** `useMarkWelcomeSeen` + `_layout` gate            | ✅ `416148d`                                                                                                                     |
| Commit **#3** `welcome:fresh` / `welcome:seen` DEV client seed | ✅ `56de855`                                                                                                                     |
| Commit **#4** `user-journeys.md` J6 + session-state            | ✅ this checkpoint                                                                                                               |
| **UAT S2-AC-4.1–4.6**                                          | ✅ user verified 2026-05-19 (4.1–4.3 CTA/skip; 4.4 via restart; 4.5 lint:copy + disclaimer; 4.6 Mac 断网替代 Simulator 飞行模式) |

**Stage 2 DoD (four features)**：Daily Snapshot ✅ · Watchlist ✅ · Rebalance ✅ · Welcome ✅ — **可开 Stage 2 → `main` PR**。

**Core algorithm contract** (locked):

- `computeRebalance(holdings, valuations, targets) → ReadonlyArray<DeviationItem>` (Stage 2 ignores holdings param; reserved for Stage 3)
- `validateTargetAllocations(targets) → ReadonlyArray<TargetAllocationError>` — structured error codes (`empty` / `duplicate_asset` / `percent_out_of_range` / `sum_not_100`)
- `roundShares(raw, market, currency)` truncates **toward zero** (positive: floor, negative: ceil-toward-zero); decimals per market+currency table

## Testing harness (canonical docs)

| Layer           | Arc artifact                                                                                                               |
| :-------------- | :------------------------------------------------------------------------------------------------------------------------- |
| Strategy        | [`docs/testing-strategy.md`](../docs/testing-strategy.md)                                                                  |
| UAT spec        | [`.specify/feature-specs/stage-2/watchlist-stage-2.md`](../.specify/feature-specs/stage-2/watchlist-stage-2.md) §S2-AC-2.x |
| UAT commands    | [`docs/dev-seed-cheatsheet.md`](../docs/dev-seed-cheatsheet.md)                                                            |
| CLI watchlist   | `pnpm seed:wl:empty` / `pnpm seed:wl:3` / `pnpm seed:wl:stale`                                                             |
| **App DEV FAB** | **功能 → 场景** — 自选场景走 App 内种子；每日快照仍要 Edge `dev-seed` deploy                                               |
| Edge deploy     | `pnpm functions:deploy:dev-seed` + `pnpm functions:secrets:dev-tools` (Daily Snapshot scenarios only)                      |

## Stage 3 — roadmap Accepted (2026-05-19)

完整路线图见 `.specify/feature-specs/stage-3/stage-3-roadmap.md`。6 个 Block 依赖排序 + 14 个决策锁定。

**Block 顺序**：A（多市场 adapters）→ B（多组合管理）→ C（详情页+图表）→ D（算法 Opus 主场）→ E（polish）→ F（CSV+P2）

**14 个决策摘要**（路线图 §七）：

| #      | 决策                                         | 影响                                                                                                                        |
| :----- | :------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------- |
| 1      | Block D 在 C 之后                            | property test 基于真实 UI 形态                                                                                              |
| 2      | 订阅 Stage 3 仅占位                          | Stage 4 接 IAP/Stripe                                                                                                       |
| 3      | AI 图标 chip preset                          | LLM 接入 V1.0+                                                                                                              |
| 4      | Inbox 空态先做                               | 价格异动后续填数据                                                                                                          |
| 5      | Offline 仅 MMKV 本地缓存读                   | 完整双向同步 → Stage 4                                                                                                      |
| **6**  | **Block C 全部走 HeroUI Pro chart 组件**     | line-chart / area-chart / bar-chart / chart-crosshair / chart-indicator —— 去掉双实现负担；donut 保留 react-native-svg 自绘 |
| **7**  | **CN/HK/FUND 主源 Tushare Pro 免费版**       | 付费版评估推后                                                                                                              |
| **8**  | **AKShare 作为候补**，推迟到 ADR 011         | 需自建 HTTP wrapper service / serverless + 法务地图复审                                                                     |
| **9**  | **天天基金 NAV adapter 放弃**                | Tushare Pro FUND 主供，AKShare 候补                                                                                         |
| **10** | **每 portfolio 独立现金 + 跨组合转账动作**   | J9 数据模型零改动；转账 = 两笔 transaction (SELL + BUY)                                                                     |
| **11** | **币种保持不自动换汇**                       | $5000 USD 转过去还是 USD 5000；换汇分两步用户主动                                                                           |
| **12** | **不允许做空现金**                           | 表单 inline validation：转出 ≤ 源 portfolio 余额                                                                            |
| **13** | **`notes` 字段标记 transfer**                | `transfer-out-to-{id}` / `transfer-in-from-{id}`                                                                            |
| **14** | **UI 落点 `/me/cash-balances` 加"转账"按钮** | 不开新路由                                                                                                                  |

## Stage 3 — Block A progress (started 2026-05-19；reshape 2026-05-20)

**Reshape 触发**：用户 2026-05-20 注册 Tushare 时实证免费版（20 积分）仅 A 股 daily 可访问 → spec / ADR 011 重写为 Phase 1A + Phase 2。

### Spec / ADR 状态

| Item                                                                                                   | Status                                                      |
| :----------------------------------------------------------------------------------------------------- | :---------------------------------------------------------- |
| `tushare-adapter-stage-3.md` Accepted — 15 决策（含 #14 HK=b + #15 QuotaError extends AdapterError）   | ✅ reshape 2026-05-20                                       |
| `docs/adr/011-multi-source-fallback-and-akshare.md` **Accepted** — Phase 2 升级为 Stage 3 Block A 必启 | ✅ 2026-05-20                                               |
| Cursor handoff prompt reshape（commit chain Phase 1A + Phase 2 全重写）                                | ✅ —— `.specify/handoffs/cursor-stage-3-block-a-kickoff.md` |

### Phase 1A — Tushare CN baseline

| Commit                                                                                                           | Status                              |
| :--------------------------------------------------------------------------------------------------------------- | :---------------------------------- |
| **#1–#9** Tushare client / resolver / CN adapter / registry / mobile env / CN+HK+FUND seeds + migration 0010 RLS | ✅ committed + **UAT CN 真实价** ✅ |
| **── Phase 1A DoD** ──                                                                                           | ✅                                  |

### Phase 2 — AKShare wrapper（ADR 011 §决策五 必启）

| Commit                                                                                                                                   | Status                                                                   |
| :--------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------- |
| **#10–#14** akshare-wrapper (Vercel `builds`+`routes`, `lib/`, ETF `fund_etf_hist_em`) + adapters + withFallback + registry + mobile env | ✅ deployed `arc-akshare-wrapper.vercel.app` + **UAT HK/FUND/510300** ✅ |
| **#15** docs(spec+adr+handoff) + session-state + valuation cache-miss fix                                                                | ✅ this checkpoint commit                                                |
| **── Phase 2 DoD** ──                                                                                                                    | ✅                                                                       |

## Stage 3 — Block B progress (multi-portfolio + transfer)

| Commit  | Item                                          | Status              |
| :------ | :-------------------------------------------- | :------------------ |
| **#1**  | migration 0011 `archived_at`                  | ✅ user applied SQL |
| **#2**  | `validateTransfer` + property tests           | ✅                  |
| **#3**  | Zustand/AsyncStorage + `useActivePortfolio`   | ✅                  |
| **#4**  | portfolios CRUD hooks                         | ✅                  |
| **#5**  | `/me/portfolios` + HardDeleteConfirmDialog    | ✅                  |
| **#6**  | PortfolioSwitcher (Portfolio Tab only)        | ✅                  |
| **#7**  | `useTransferBetweenPortfolios` + sheet        | ✅                  |
| **#8**  | cash-balances 转账入口                        | ✅                  |
| **#9**  | `useActivePortfolio` rewire + `?portfolioId=` | ✅ grep 零匹配      |
| **#10** | Insights 卡片仪表盘 + empty state             | ✅                  |
| **#11** | seed `portfolios:*` + DEV panel               | ✅                  |
| **#12** | session-state bump                            | ✅                  |

### Deferred to Stage 3 末 / Stage 4

| Item                                                              | 阻塞条件                                                         |
| :---------------------------------------------------------------- | :--------------------------------------------------------------- |
| commit #3 `tools/refresh-tushare-basics.ts` 抓 stock_basic 等     | 用户升 ¥200 / 2000 积分                                          |
| commit #5 Tushare HK adapter                                      | 决策 14 锁定 Stage 3 不实施；Stage 4 评估                        |
| commit #6 Tushare FUND adapter (`fund_nav` OF / `fund_daily` ETF) | OF：用户升 2000 积分；ETF：评估 ¥500 / 5000 积分 vs AKShare 持续 |
| Live smoke：`HK:00700` / `FUND:*` via Tushare                     | 不发生 Stage 3                                                   |

**给下一个会话的 hand-off**：

- **Opus（用户已交接）**: review `dev/stage-3` Block A commit 链 → 起草 Block B `multi-portfolio-stage-3.md`
- **Cursor/Sonnet**: Block B spec Accepted 后按 commit 链实现（多组合 / 转账 — 见 roadmap Block B）
- **TWR/PA/Drawdown property tests** Block D Opus 主场（至少 20 个 property test）—— Stage 3 第 6-7 周启动
- **用户外部 todo**：
  1. Tushare token（commit #8 真实拉价依赖；commit #1-7 不需要）
  2. Vercel 账号 + `vercel login`（commit #10 必需）
  3. `docs/legal-risk-map.md` L3/L6/§六.6 复读（commit #10 前）
  4. **可选**：Stage 3 末决定是否升 ¥200/2000 积分（commit #3 + commit #6 OF 解锁）

## Stage 3 — Block C planning (2 specs Accepted 2026-05-20，串行 i)

**Reshape**: 原 Block C 仅"持仓表 + 详情页 + 图表"；扩展加入 (a) Block A 漏单 CoinGecko adapter；(b) 跨市场 transaction entry UI；(c) AKShare wrapper `/api/search` endpoint。原因：没有这些 Stage 3 DoD"自用 ≥ 4 周"无法启动。

### Specs Accepted

| Spec                                                                                      | 决策                                        | Commits | 估时    |
| :---------------------------------------------------------------------------------------- | :------------------------------------------ | :------ | :------ |
| `.specify/feature-specs/stage-3/coingecko-adapter-stage-3.md`（Block A 漏单）             | 6                                           | 6       | ~3-5h   |
| `.specify/feature-specs/stage-3/holdings-and-transactions-stage-3.md`（Block C expanded） | 13（8 architecture + 5 UX-level A/A/A/A/A） | 13      | ~17-22h |

### Phase 1 — CoinGecko (preflight to Block C)

| Commit                                                                                         | Status                                              |
| :--------------------------------------------------------------------------------------------- | :-------------------------------------------------- |
| #1–#6 (client / coin-id resolver + bundled top200 / adapter / registry / seed / session-state) | ✅ committed locally (`b0a913c` … `fd614c6`)        |
| Live smoke: DEV `default:crypto-only` → 真实 USD 价 + 24h 变动 + CNY 换算                      | ⏳ user UAT after `pnpm seed:crypto-only` once      |
| Phase 1 DoD                                                                                    | ✅ code complete — pending Opus review + live smoke |

### Phase 2 — Block C 主链（13 commits — 执行记录）

| #   | Git (short) | Commit message (摘要)                                    | Status                           |
| :-- | :---------- | :------------------------------------------------------- | :------------------------------- |
| 1   | `dc27321`   | `feat(db): migration 0013 assets CRYPTO insert RLS`      | ✅ code                          |
| 2   | `9ffcaf7`   | `feat(ui): @arc/ui/charts wrapper layer`                 | ✅ Opus review ⏳                |
| 3   | `5a92de3`   | `feat(ui): MarketChip, AllocationDonut, HoldingsTable…`  | ✅                               |
| 4   | `08e86f3`   | `feat(data-sources): NotImplementedError → withFallback` | ✅ Opus review ⏳                |
| 5   | `691b430`   | `feat(akshare-wrapper): /api/search`                     | ✅ code; **Vercel prod** ⏳ user |
| 6   | `6e0050f`   | `feat(data-sources): AKShare searchSymbols + wires`      | ✅                               |
| 7   | `924e89c`   | `feat(mobile): Block C query hooks + rangeToWindow`      | ✅                               |
| 8   | `6f49e4f`   | `feat(mobile): last-used-market AsyncStorage`            | ✅                               |
| 9   | `80a1cb1`   | `feat(mobile): asset detail page`                        | ✅                               |
| 10  | `afceffd`   | `feat(mobile): holdings table + NAV over-time card`      | ✅                               |
| 11  | `251fc11`   | `feat(mobile): cross-market tx entry`                    | ✅ Opus review ⏳                |
| 12  | `9a7e6ee`   | `feat(seed): multi-market-full + 30-days-history`        | ✅                               |
| 13  | `b2b6474`   | `docs(spec+session-state): Block C main chain complete`  | ✅                               |

**Block B UAT prep（同链，非 Block C 编号）**: `36b24bc` Portfolio tab header + migration **0012** `portfolio_value_snapshots_user_insert_manual`.

### Block C UAT — 前置（新会话第一件事）

| Step | 动作                                                                                                                         | 验证                                                            |
| :--- | :--------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------- |
| 0    | `apps/mobile/.env` 的 `EXPO_PUBLIC_SUPABASE_URL` ref = **`jdvlzkictwinkgcvgwew`**（与 SQL Editor 同一 project）              | Dashboard URL 一致                                              |
| 1    | Supabase SQL Editor 跑 **0012** + **0013**（文件含 `DROP POLICY IF EXISTS` 幂等；0013 可能有 destructive 警告 → dev 可 Run） | 0012 若报 policy exists → 已应用可跳过                          |
| 2    | `cd services/akshare-wrapper && vercel --prod`（commit #5 后）                                                               | `curl` `/api/search?market=CN&q=茅台` + token                   |
| 3    | `pnpm mobile -- --clear`；DEV 登录（邮箱 OTP）                                                                               | 冷启动无 Metro 旧 bundle 错                                     |
| 4    | DEV FAB → **组合** → **`portfolios:30-days-history`**（首选）或 `portfolios:multi-3` / `daily-snapshot:*`                    | Portfolio Tab Hero + 730 天曲线 / 多组合切换 / 日涨跌 edge case |

### Block C — Portfolio Hero UI/UX polish（2026-05-21，commit `7c7755b`）

**范围**：`PortfolioHeroSection`（L3 组合）+ `@arc/ui/charts/*` L2 polish（点阵 area fill、scrub 遮罩/日期、Segment 周期条）。**非**仅多组合 —— 凡 **Portfolio Tab + 当前 active portfolio** 均走新 Hero（单组合 / 多组合切换同样 UI）。

| 组件                    | 层           | 说明                                                              |
| :---------------------- | :----------- | :---------------------------------------------------------------- |
| `PortfolioHeroSection`  | L3 finance   | 总市值 + 变动行 + `AreaChart` + `TimeRangeSelector` + mover chips |
| `AreaChart` + L2 子模块 | L3/L2 charts | 点阵、scrub、涨跌色；HeroUI Pro 仅 L1 挂载                        |
| `DailySnapshotCard`     | L2（保留）   | Portfolio Tab **已不再渲染**；delta 类型仍复用                    |
| ADR 013                 | docs         | wrapper 所有权纪律                                                |

**DEV 场景（Hero UAT 首选）**：

| 场景                               | 覆盖                                                                                                  |
| :--------------------------------- | :---------------------------------------------------------------------------------------------------- |
| **`portfolios:30-days-history`**   | ✅ **最全**：多市场持仓 + 730 天 `portfolio_value_snapshots` + Hero chart/scrub                       |
| `portfolios:multi-3`               | 多组合 ▼ 切换（非全市场）                                                                             |
| `daily-snapshot:*`                 | 日涨跌 edge case（first-day / mixed-movers 等）；仍进 Portfolio Tab                                   |
| `default:cross-market` 等          | 单市场报价 smoke；**不**替代 30-days-history                                                          |
| ~~`portfolios:multi-market-full`~~ | 已从 DEV FAB 移除（被 30-days-history 严格覆盖）；CLI `pnpm seed:portfolios:multi-market-full` 仍可用 |

**UI polish 单独提交纪律（Opus Block C review 前必读）**：

1. Block C **L2/L3 UI/UX polish**（`packages/ui` charts/finance、`PortfolioHeroSection`）与 Opus 审查的 **adapter / RLS / hooks / core** 层 **正交** —— 可先 commit polish slice（已验证 `7c7755b`、`2c20863`、`8adf16f`）。
2. **提交前自检**：改动是否仅 UI + 薄 wiring（`index.tsx` props、`time-range.ts` UTC、`snapshotsToChartPoints.asOf`）？是 → 可提交。
3. **若触及** `data-sources`、`packages/core` 估值、`migration`、snapshot cron/query 契约 → **先通知用户**，由用户决定是否与 Opus review 并行或等 review 后再合。
4. Opus review 后若只改数据层，Hero 组件 **通常无需回滚**；最多同步 `ChartPoint` / hook 字段。

### Block C — Portfolio Tab polish（2026-05-22，commits `2c20863` + `8adf16f`）

| 项                                      | commit    | 说明                                                                                                                 |
| :-------------------------------------- | :-------- | :------------------------------------------------------------------------------------------------------------------- |
| Holdings 表 + typography + theme toggle | `2c20863` | HoldingRow 涨跌格式、`HoldingsMarketFilter`、Settings `setColorMode` 修 dark 拨两次                                  |
| soft-foreground 桥接 + 市场筛选 Hero    | `8adf16f` | `@theme inline` 整族 4 个 `*-soft-foreground` → Foundation；`portfolio-market-filter.ts` 同步 hero 总值/日涨跌/chart |

**Token 根因（必读）**：HeroUI `theme.css` 的 `--color-*-soft-foreground` 不读 Arc `@layer theme` 的 `--*-soft-foreground`；className 走 `--color-*`。见 ADR 003 §双命名空间 + `DESIGN-TOKENS.md` §Tailwind 桥接清单。

**工作区未 commit（UAT / Opus 仍待）**：US adapter、Finnhub/AV 历史价、migration 0012/0013 补丁、seed 扩展、`asset/[symbol]` 等 —— 见 `git status`。

### Block C UAT — S3-AC-C 清单 ✅ (user verified 2026-05-24)

所有 C.1–C.12 通过签 off。无回归 bug。详细 AC 契约见 `holdings-and-transactions-stage-3.md §S3-AC-C`。

| AC       | 测什么                                 | 状态 |
| :------- | :------------------------------------- | :--- |
| **C.1**  | 持仓表 market 分组 + 双币种            | ✅   |
| **C.2**  | tap 行 → `/asset/CN/600519`            | ✅   |
| **C.3**  | 详情 1M→1Y 重拉 historical             | ✅   |
| **C.4**  | tx entry CN 搜「茅台」→ AKShare search | ✅   |
| **C.5**  | CRYPTO BUY → ensureAsset + tx          | ✅   |
| **C.6**  | trade_date 可 back-date ≠ created_at   | ✅   |
| **C.7**  | per-portfolio last-used market         | ✅   |
| **C.8**  | Insights donut 按 asset 权重           | ✅   |
| **C.9**  | Portfolio area-chart + Hero scrub      | ✅   |
| **C.10** | search 503 限流 UI 保留旧结果          | ✅   |
| **C.11** | Tushare CN NotImpl → AKShare fallback  | ✅   |
| **C.12** | 详情「我的持仓」盈亏色                 | ✅   |

**Next on Block C track**: user push the 34 ahead commits → 起 Opus 会话 review `9ffcaf7` (#2 charts) / `08e86f3` (#4 fallback) / `251fc11` (#11 tx entry).

### 关键路径（修 bug 时）

| 领域              | 路径                                                                                                                                        |
| :---------------- | :------------------------------------------------------------------------------------------------------------------------------------------ |
| Spec / AC         | `.specify/feature-specs/stage-3/holdings-and-transactions-stage-3.md`                                                                       |
| Kickoff           | `.specify/handoffs/cursor-stage-3-block-c-kickoff.md`                                                                                       |
| Portfolio Tab     | `apps/mobile/app/(tabs)/index.tsx`, **`PortfolioHeroSection`**, `HoldingsTable`                                                             |
| Asset 详情        | `apps/mobile/app/asset/[market]/[symbol].tsx`, hooks `use-asset-detail`, `use-historical-quotes`                                            |
| Tx 录入           | `apps/mobile/app/portfolio/...` tx entry 路由, `use-transactions`, `use-symbol-search-cross-market`                                         |
| Charts            | `packages/ui/src/charts/*`                                                                                                                  |
| Search / fallback | `with-fallback.ts`, `services/akshare-wrapper/api/search.py`                                                                                |
| Seed              | `run-portfolios-seed-client.ts`, DEV panel **`portfolios:30-days-history`**（CLI 仍可用 `pnpm seed:portfolios:multi-market-full` 轻量种子） |
| Migrations        | `0012_portfolio_value_snapshots_user_insert_manual.sql`, `0013_assets_authenticated_insert_crypto.sql`                                      |

## Stage 3 — Block D Phase 1 progress (2026-05-24) ✅

TWR algorithm layer 全栈落地，纯 `@arc/core`，未碰 UI / hooks / adapters。

| Commit    | Title (摘要)                                                      | Files | Tests added              |
| :-------- | :---------------------------------------------------------------- | :---- | :----------------------- |
| `1da6437` | `feat(core): returns/cash-flow.ts + types.ts + errors.ts`         | 5     | 19 (cash-flow detection) |
| `e2399c4` | `feat(core): returns/twr.ts (Modified Dietz simplified)`          | 4     | 10 (twr unit)            |
| `3b71170` | `feat(core): returns/xirr.ts (Newton-Raphson MWR)`                | 3     | 5 (xirr unit)            |
| `d467b6e` | `test(core): twr.property.spec.ts (21 properties) + xirr damping` | 2     | 21 (property) + 1 sanity |

**Total**: 14 files / +2083 / -28 ; `pnpm --filter @arc/core test` **149/149 ✅** ; `pnpm typecheck` **6/6 ✅**.

### Algorithm contract (locked — Phase 2 hooks consume these signatures)

- `computePortfolioTwr(input: PortfolioTwrInput): TwrResult` — `valueAt(date)` returns EOD-after-CF; chain strips CF from intermediate sub-period ends; same-currency CF filter via `reportingCurrency`
- `computeAssetTwr(input: AssetTwrInput): TwrResult` — every BUY/SELL of asset is a CF; `valueAt` derived from `computeSharesAt × priceAt`
- `computeMwr(cashFlows, options?): MwrResult` — Newton-Raphson with damping (next-r ≤ -1 → step halfway to -0.999); throws `ConvergenceError` on empty / zero-spread / iteration-cap / zero-derivative
- `computeSharesAt(transactions, assetId, date)` + `getAssetFirstBuyDate(transactions, assetId)` — exported for PA spec reuse
- `Decimal.set({ precision: 28 })` declared in `returns/index.ts` (spec §决策 7); existing 113 prior tests pass at 28-digit precision

### 雪球对标准备清单 (Phase 3 — user 配合)

- 3 标的 ≥ 6 个月真实持仓（建议 1 CN + 1 US + 1 ETF/FUND 覆盖跨币种）
- 真实 transactions 在 Arc 录入（Block C tx entry 已支持）
- Arc TWR vs 雪球 TWR 截图存档 `docs/dod-verification/twr-snowball-{ticker}-{date}.png`
- 误差 ≤ 1.0% per 标的 (Stage 3 DoD-hard)
- **Prereq**: Real Env ✅ Implemented (`.specify/feature-specs/cross-stage/real-env-dev-tools.md` 6 commits 落地)；等待用户 J-RE.1 首次填 `.env` + Switch to Real + 录入 6 个月数据

### Phase 2 follow-ups (Opus review of commits #5+#6, 2026-05-25)

P0/P1 fixes folded into the review pass (commit #5 FX historical-rate violation + missing `twr-window.spec.ts`; commit #6 B1 Insights TWR hidden in no-targets branch). Remaining follow-ups (non-blocking, see `twr-stage-3.md §Known limitations`):

- **FU-1** Batch fallback adapter fetches when ≥ 10 holdings × ≥ 5 fallback days
- **FU-2** Reroute `console.warn` → Sentry (Stage 4 observability)
- **FU-3** Clamp non-ALL `from` to `earliestPortfolioTradeDate`; surface evaluated period in UI label
- **FU-4** Revisit `FX_LOOKBACK_DAYS=7` if long bank-holiday stretches start triggering "—" in practice
- **FU-5** Unify `useAssetTwr` price fetch with `useHistoricalQuotes` via a `lookbackDays` option (currently two parallel adapter calls per Asset detail mount)

### Phase 2 hand-off prompt (复制到新 Sonnet/Cursor Chat)

```
接力 Arc Stage 3 Block D TWR Phase 2（mobile hooks + UI 接入）。

必读：CLAUDE.md → .specify/session-state.md §Block D Phase 1 → twr-stage-3.md §"Implementation plan Phase 2".

Phase 1 已落地 4 commits（cash-flow/twr/xirr/property tests，149/149 ✅）；
本会话不动 @arc/core，只在 apps/mobile + packages/ui/finance 加 2 hooks + 1 内嵌组件 + 3 处页面挂数字。

commit chain：
  #5 feat(mobile): use-asset-twr + use-portfolio-twr (TanStack hooks，wrap snapshot + computeValuationAtDate fallback；valueAt 按 spec §决策 3 优先读 portfolio_value_snapshots)
  #6 feat(ui+mobile): TwrInlineLabel 组件 + Portfolio Tab Hero 接入 + Asset detail 接入 + Insights 卡接入 + i18n 6 strings

按 spec §UI contract J15a/b/c 三处接入位置；时段联动复用 Block C `rangeToWindow` helper。
不 push；每 commit 末 pnpm typecheck 6/6 + pnpm test 全绿。
```

## Stage 3 — Block F progress (CSV 导出 + 导入，2026-06-01) ✅ code complete

### CSV 导出（Block F 第 1 项）✅

| Commit    | Title                                                               | Status      |
| :-------- | :------------------------------------------------------------------ | :---------- |
| `f45e3bc` | `chore(mobile): add expo-file-system + expo-sharing (SDK 55)`       | ✅          |
| `9695152` | `feat(mobile): transactions-to-csv pure fn + tests (AC.6/AC.8)`     | ✅ 17 tests |
| `9db2726` | `feat(mobile): useAllTransactions + use-csv-export hook`            | ✅          |
| `31b5bb2` | `feat(mobile): /me/export screen + Me entry + i18n (S3-AC-F.1–F.7)` | ✅          |

**导出 UAT 清单**（BoyangJiao 真机验证）：

| AC            | 测什么                                                                       |
| :------------ | :--------------------------------------------------------------------------- |
| **S3-AC-F.1** | Me →「导出数据」→ `/me/export`，显示交易/组合计数；返回正常                  |
| **S3-AC-F.2** | tap 导出 → 系统分享面板弹出；存文件后 CSV 可在 Excel/Numbers 打开            |
| **S3-AC-F.3** | CSV 表头 = 10 列；行数 = 交易总数（全 portfolio）                            |
| **S3-AC-F.4** | `shares`/`price_per_share`/`fee` 为全精度 Decimal 字符串（非格式化、非脱敏） |
| **S3-AC-F.5** | 原始币种保留（`currency` 列 = 交易币种，未换算报告币种）                     |
| **S3-AC-F.6** | `notes` 含逗号/引号/换行 → RFC 4180 转义正确（Excel 打开不错列）             |
| **S3-AC-F.7** | 无交易 → 按钮禁用 + 空态；i18n en+zh + lint:copy 无禁忌词                    |
| **S3-AC-F.8** | 单测：`transactionsToCsv` 17 tests 全绿（`pnpm --filter @arc/mobile test`）  |

### CSV 导入（Block F 第 2 项）✅ code complete

| Commit    | Title                                                                          | Status      |
| :-------- | :----------------------------------------------------------------------------- | :---------- |
| `3491e91` | `chore(mobile): add expo-document-picker (SDK 55)`                             | ✅          |
| `4caafcd` | `feat(mobile): csv import — L1 raw parse + L3 validator + tests (AC.FI.10)`    | ✅ 34 tests |
| `7f0e851` | `feat(mobile): import format profiles — arc-native + registry (AC.FI.12)`      | ✅ 15 tests |
| `a1c64ba` | `feat(mobile): use-csv-import hook — pick + parse + write to target portfolio` | ✅          |
| `2b13fe5` | `feat(mobile): /me/import 3-step screen + Me entry + i18n (S3-AC-FI.1–FI.11)`  | ✅          |

**导入 UAT 清单**（BoyangJiao 真机验证）：

| AC              | 测什么                                                                                                  |
| :-------------- | :------------------------------------------------------------------------------------------------------ |
| **S3-AC-FI.1**  | Me →「导入数据」→ `/me/import` → 选 .csv → 进预览；返回正常                                             |
| **S3-AC-FI.2**  | 合法文件：预览显示正确「可导入 N 行」+ 目标组合选择器（默认 active）                                    |
| **S3-AC-FI.3**  | 缺必需列 → 整文件拒绝 + 提示缺哪列；不写入任何行                                                        |
| **S3-AC-FI.4**  | 含坏行（type 非法 / shares 非数 / asset_id 格式错 / 日期非法）→ 逐行报错 + 行号；坏行不阻塞好行         |
| **S3-AC-FI.5**  | 确认导入 → 仅有效行写入目标组合；结果页成功/失败计数准确                                                |
| **S3-AC-FI.6**  | 导入后 Portfolio 持仓 = 原持仓 + 导入交易（法则 2 闭环；估值/图表刷新）                                 |
| **S3-AC-FI.7**  | **Round-trip**：导出 A 组合 → 导入到空 B 组合 → B 持仓 == A 持仓                                        |
| **S3-AC-FI.8**  | 重复导入同一文件 → 交易翻倍（无去重）+ UI 事前提示；符合预期非 bug                                      |
| **S3-AC-FI.9**  | RFC 4180 反解析：notes 含逗号/引号/换行的行正确还原                                                     |
| **S3-AC-FI.10** | 单测：`csvToTransactions` 34 tests + `csvRawParse` 18 tests 全绿                                        |
| **S3-AC-FI.11** | i18n en+zh 齐全 + `lint:copy` 无禁忌词；导入走真实写库（ADR 007，无 mock 短路）                         |
| **S3-AC-FI.12** | Profile 架构：`detectProfile(导出 header)` = arc-native；未知 header → undefined；15 profile tests 全绿 |

## Active blockers / waiting on user

- **Migration `0010`** `assets` CN/HK/FUND INSERT RLS — ✅ user applied (SQL Editor)
- **`EXPO_PUBLIC_TUSHARE_TOKEN` + `EXPO_PUBLIC_AKSHARE_WRAPPER_*`** — ✅ `apps/mobile/.env`（改 env 须保存 + 重启 Metro）
- **AKShare wrapper** — ✅ Vercel prod + token；Stage 4 前评估迁国内云（阿里云/火山）降延迟
- **¥200 / 2000 Tushare 积分** — 可选；解锁 commit #3 `stock_basic` + commit #6 FUND OF
- **`EXPO_PUBLIC_FINNHUB_API_KEY`** — ✅
- **Daily Snapshot cron** ✅（`verify_jwt=false` + secrets 对齐；GH `26095476933`）
- **Dev 行情** — Settings「拉取真实行情」开关已移除；dev/prod 均 Finnhub + Frankfurter（dev = cache-first）
- **`brew install deno`** — optional, before `pnpm test:functions` locally (J8 dev-seed handler tests)

## Immediate next actions (next session)

**⭐ 下一步 — Block F 导入 UAT（BoyangJiao 真机，见 §Block F progress 导入 UAT 清单）**：S3-AC-FI.1–FI.12 通过后 push + 并入 PR #10。Block F 导出 + 导入代码全部完成（11 commits），无需 code change，仅 UAT。

**⭐ 历史 P1 — Insights 盈亏分析模块（见 §"Sonnet P1 handoff" #4）**：代码已完成，待 BoyangJiao Real Env UAT 对账（AC.5）+ push + PR。其余 Track A–G 为历史/并行支线，按需取用。

**Track F — Real Env dogfooding 问题修复（持续 — 用户主导带入 bug 列表）**

1. 用户在 Real Env（`cyberjby+arc-real@gmail.com`）录入真实持仓后继续日常使用，**逐条记录**与 Delta / 支付宝 / 预期行为的偏差。
2. 下一会话：带 repro 步骤 + 截图/数值 → Sonnet/Cursor 修 mobile/core/data-sources（不动 schema 除非 Opus 签 off）。
3. Clean Env（`+arc-clean`）仍用于场景 seed / 单点功能回归；Real Env **禁止** seed 按钮（§S3-AC-RE.4）。
4. 可选自验：**S3-AC-RE.2** Metro `--clear` 重启后仍登 Real；**S3-AC-RE.5** Real ↔ Clean 来回数据隔离。

**Track A — Block C 收尾（用户主导）**

1. `git push origin dev/stage-3`（34 ahead；含 Block C 主链 + Hero polish + Block D Phase 1）
2. 起 Opus 会话 review Block C 三个 deferred commits（`9ffcaf7` charts wrapper / `08e86f3` `NotImplementedError → withFallback` / `251fc11` cross-market tx entry）+ ADR 012 提议复审
3. 评估开 `dev/stage-3 → main` Stage 3 partial PR（Block A/B/C + Block D algorithm，Phase 2/3 后续 PR）

**Track G — 标的收益率口径 + 录入分级 Opus review（2026-05-26 dogfooding 起点）**

1. **Opus 必读**：[`.specify/handoffs/opus-review-holdings-return-algorithm.md`](handoffs/opus-review-holdings-return-algorithm.md) → [ADR 014](../docs/adr/014-portfolio-chart-algorithm.md) → [ADR 015](../docs/adr/015-holdings-row-period-change.md)
2. **决策点**：
   - Q1 算法方案（A 全 cost-basis / B 持仓级 TWR / **C 混合 — 会话倾向** / D 双数 / E 现状）
   - Q2 快照录入字段集（最少 / **+ 可选累计投入金额 — 会话倾向** / 反向推算）
   - Q3 `OPENING_SNAPSHOT` 新增 type vs 复用 `ADJUSTMENT + metadata`
   - Q4 CSV 导入是否插队 Stage 3 排期
3. **产出预期**：ADR 016 草案 + spec 增补（`holdings-and-transactions-stage-3.md` 加快照录入子契约）+ commit 链拆分（migration / algorithm / UI / docs）
4. **不动代码**：本议题等 Opus 决策后再交 Sonnet/Cursor 实施；当前工作区 `holdings-presenter.ts` 等改动仍是 ADR 015 v4 实现

**Track B — Block D Phase 2（Sonnet/Cursor，新会话）**

1. 用 §Phase 2 hand-off prompt 起 Sonnet/Cursor 会话
2. 实施 commit #5/#6（hooks + UI 挂数字）
3. UAT：Asset detail "1Y TWR：+X.XX%" 联动 / Portfolio Tab Hero "YTD TWR" 显示 / Insights 卡 "1月 TWR"

**Track C — Real Env DEV 双环境 ✅ Implemented + J-RE.1 ✅ 2026-05-25**

cross-stage spec [`real-env-dev-tools.md`](feature-specs/cross-stage/real-env-dev-tools.md) **Implemented** — 解锁 Phase 3 雪球对标 prereq + 长期 dogfooding。

| #   | Commit (short) | Title                                                                                          |
| :-- | :------------- | :--------------------------------------------------------------------------------------------- |
| 1   | `2a81c6b`      | feat(mobile): env-mode detection + .env DEV_REAL_EMAIL / DEV_CLEAN_EMAIL                       |
| 2   | `3e86e7c`      | feat(mobile): run-reset-clean.ts + RLS-mediated user-scoped delete script                      |
| 3   | `b697f1b`      | feat(mobile): DEV FAB Environment section + env switcher + reset button                        |
| 4   | `5b7cd0c`      | feat(mobile): gate scenarios.ts entries by envMode === 'clean'                                 |
| 5   | `c0c05e8`      | test(mobile): reset-clean smoke + envMode unit + S3-AC-RE.4 button-guard (12 new, 28 total ✅) |
| 6   | `53d9034`      | docs(spec+state): real-env feature ready, Phase 3 dependency unblocked                         |

**User infra (one-off, not in repo)**：

| Item                 | Value                                                                                                 |
| :------------------- | :---------------------------------------------------------------------------------------------------- |
| Resend domain        | `auth.boyangjiao.xyz` **Verified**（DNS via Vercel auto-config；registrar Squarespace，NS 在 Vercel） |
| Supabase SMTP sender | `Arc <noreply@auth.boyangjiao.xyz>` · `smtp.resend.com:465`                                           |
| Dev emails (`.env`)  | `DEV_REAL_EMAIL=cyberjby+arc-real@gmail.com` · `DEV_CLEAN_EMAIL=cyberjby+arc-clean@gmail.com`         |
| Email templates      | **Confirm signup** + **Magic Link** 均含 `{{ .Token }}`；dev OTP 主路径，勿依赖 confirm link          |

**J-RE.1 ✅ user verified 2026-05-25**：FAB Switch Real ↔ Clean + OTP 登录 + Clean 场景恢复；Resend 550 sandbox 问题已通过 verify 自有子域解决。

UAT 验收：

- **S3-AC-RE.1** ✅ 用户：Switch to Real → OTP → onboarding 路径跑通
- **S3-AC-RE.2** ⏳ 用户可选自验（Metro `--clear` 后 session 持久）
- **S3-AC-RE.3** ✅ vitest `run-reset-clean.spec.ts` 4/4；Reset 手测待需要时做
- **S3-AC-RE.4** ✅ vitest `scenarios.spec.ts` 4/4 + 用户确认 Real 无 seed 按钮
- **S3-AC-RE.5** ✅ 用户：双环境均跑通（来回切换 OK）

**Track D — Block D Phase 3 雪球对标（用户 + Opus，依赖 Track C ≥6 月数据）**

1. 用户选 3 标的 ≥ 6 月真实持仓（建议 1 CN + 1 US + 1 ETF/FUND）
2. 雪球 TWR 截图 + Arc 录入相同 transactions（已在 Track C Real Env 完成录入）
3. 截图存档 `docs/dod-verification/twr-snowball-{ticker}-{date}.png` + 误差 ≤ 1.0%

**Track E — Block D specs 余下两条（Opus）**

1. PA spec implementation Phase 1 — 复用 `computeSharesAt` + sub-period contribution
2. Drawdown spec implementation Phase 1 — 基于 `portfolio_value_snapshots` 时序

**暂缓**：ADR 012 接受、大陆 Auth 实现。

**Switch-back-to-Opus triggers** (Stage 3):

- TWR / MWR 算法（property tests 强需求）
- Performance Attribution 算法
- 任何动到 @arc/core 的迁移或不变性条款

## Open decisions / questions

- **Resolved 2026-05-18**: Watchlist DEV seed in App uses **client JWT path** for `watchlist:*` only; portfolio reset scenarios still need Edge Function.
- **Resolved 2026-05-18**: Dev tools UI = **two-level** (feature picker → scenarios), not flat list.
- **Resolved 2026-05-18 (J9 UAT)**: Rebalance DEV 场景漂移应靠 **不同 `target_allocations`**（在 fixture 固定价下算出 ±7% / ±15%），不能只改 DB NVDA 价；seed 后须 **`warmRebalanceMarketCache()`**（fixture 模式不读 Supabase `price_snapshots`）。
- **Resolved 2026-05-19 (UI polish)**: `/me` 拆 **嵌套 Stack**（`app/me/_layout.tsx`）— 根仅 `slide_from_left` + `animationMatchesGesture` + `fullScreenGestureEnabled`；子页自右 push。`InScreenHeader` 增加 `density: comfortable` 用于 modal（如自选搜索）。Tab 滚动底缘 `TabScrollShadow`（`ScrollShadow` + `LinearGradient`）。`@arc/eslint-plugin-token-discipline` + ADR 008 / DESIGN-TOKENS 同步。
- **Resolved 2026-05-19 (ADR 010 dev cache trust)**: 四条 cache-first 读路径（`use-watchlist-quotes` / `use-portfolio-valuation` / `use-price` / `validate-us-symbol`）统一使用 `apps/mobile/src/lib/stale-quote.ts` 的 `isStaleQuoteSource`。`STALE_SOURCES = {seed-dev, fixture, alphavantage}` 或 `changePercent == null` → 不信任缓存、触发 Finnhub。`CACHE_FIRST_READ_FRESHNESS_MS` 保留 `Infinity`（24h freshness 与 dev 永不自动网络的设计冲突，收回）。DEV watchlist seed 假数据 **保留**（stale-quote 场景需要），仅加注释说明。
- **Resolved 2026-05-20 (Block A)**: Tushare 免费版仅 A 股 daily；HK/FUND 主源 AKShare Vercel wrapper；场内 ETF（510300）用 `fund_etf_hist_em` 非 `stock_zh_a_hist`；`apps/mobile/.env` AKShare 行须落盘否则 Metro 不加载；cache-first 组合估值对 **cache miss** 自动补网拉价。
- **Resolved 2026-05-21 (Block C Hero)**: Portfolio Tab 用 **`PortfolioHeroSection`** 替代 `DailySnapshotCard` + `PortfolioValueOverTimeCard` 叠 Card；chart polish 在 `@arc/ui/charts` L2（ADR 013）。**全局**：active portfolio 不论单/多组合均同一 Hero UI。
- **Resolved 2026-05-22 (Token dual-namespace)**: HeroUI `@theme inline static` 的 `--color-*` 与 Arc `@layer theme` 的 `--*` 是两条通道；`*-soft-foreground` 等 Calculated Variables 须 `global.css` `@theme inline` 桥接。整族 accent/success/danger/warning 已桥接；接新组件见 DESIGN-TOKENS §Tailwind 桥接清单。
- **Resolved 2026-05-21 (UI commit discipline)**: Block C UI/UX polish 可单独 commit，若仅 L2/L3 + 薄 wiring；触及 data-sources/core/migration 先问用户再 commit。
- **Resolved 2026-05-25 (Real Env email infra)**: Resend **`noreply@resend.dev` = sandbox**，仅发往 Resend 账号邮箱；`+alias` 被当作不同收件人 → 550。Fix = verify 自有子域（`auth.boyangjiao.xyz`）+ Supabase sender 改 `@auth.boyangjiao.xyz`。`boyangjiao.xyz` 作品集在 Vercel → Resend auto-config 走 Vercel DNS，不必 Squarespace 手填。
- **Resolved 2026-05-25 (OTP vs confirm link)**: `signInWithOtp` API 名是 OTP，**邮件内容由模板决定**。新用户走 **Confirm signup** 模板（非 Magic Link）；两模板都须 `{{ .Token }}` 且 dev 勿留 `{{ .ConfirmationURL }}` 为主 CTA。
- **Resolved 2026-05-27 (Holdings return algorithm + entry tiers)**: Opus 4.7 多轮 review（钱往 / Delta / IBKR / 钱迹 / 支付宝 横向对标）+ BoyangJiao confirm，定稿 **[ADR 016](../docs/adr/016-holdings-return-and-entry-tiers.md)**。核心：(1) Portfolio Tab Hero 保留 True Historical balance 曲线 + 「本期市值变化」label，default/scrub 共享 first-non-zero baseline（杜绝 Delta scrub +1358% 翻车）；(2) **持仓行 % = cost-basis since-open 固定值**，不随时间范围切换，跟支付宝/钱往 100% 对账；(3) 新增 `OPENING_SNAPSHOT` transaction type + 统一录入表单（mode 入口分流，「数量 / 金额」toggle，snapshot 走「累计投入金额」根除录入摩擦 A）；(4) 业绩 / TWR / MWR / 收益率曲线 = 独立 **Insights/盈亏分析** 模块（仿 IBKR 业绩 tab + 钱往 详情页），独立 feature spec，**不阻塞**主链。ADR 014/015 部分被 supersede（详见各自顶部注释）。Commit 链 #1-8 主线（~2 周）+ #9+ 独立 stream（盈亏分析模块）。下一步：Sonnet/Cursor 按 commit chain 实施。

## Critical mental model (gotchas easy to forget)

- **Decimal.js everywhere** — see `packages/core/__tests__/`.
- **`assets` upsert**: RLS allows INSERT only → use `{ onConflict: "id", ignoreDuplicates: true }` or UPDATE fails on seeded symbols (AAPL/NVDA).
- **Watchlist dev seed**: purple DEV **自选** scenarios = `run-watchlist-seed-client.ts` (user JWT); does **not** reset portfolio. Daily Snapshot scenarios = Edge `dev-seed`.
- **Dev seed**: `service_role` only in CLI / Edge — never in app bundle.
- **iOS Simulator refresh**: **⌘D → Reload** (⌘R = screenshot).
- **Migration 0004** required for watchlist table + DEV watchlist seed.
- **Migration 0005** optional until client deploys `change_percent` read/write; apply before shipping watchlist quote cache to shared dev DB.
- **`/me` 导航**：根栈 `name="me"` + `animation: slide_from_left` + `animationMatchesGesture: true` + `fullScreenGestureEnabled: true` → LTR 下**右缘向左滑**关闭整个 Me；`app/me/_layout.tsx` 子栈内子页（设置等）默认 **自右 push**，左缘右滑返回上一层。
- **`use-watchlist-quotes`**: `catch` + `return null` = TanStack **success** → no `isError` → **no pull banner**. **`AdapterError` 子类必须 rethrow**（限流/网络/404 等）才能统计失败 + 显示横幅。
- **Markets 下拉**: `forceRefresh` 在 **`isFetching` 结束** 后关闭，勿用短 `setTimeout`，否则 `queryKey` 切回会只吃缓存并丢涨跌展示路径。
- **Rebalance DEV seed**: `rebalance:aligned|mild-drift|heavy-drift` 共用同一组 holdings；fixture 当前配置 ≈ **11.85 / 13.14 / 43.76 / 31.25**（见 `rebalance-seed-plans.ts`）。切换场景后 invalidate queries + 预热 `priceCache`/`fxCache`。
- **缓存信任 (ADR 010)**: dev `cache-first` 不再无条件信任 cache。`source ∈ {seed-dev, fixture, alphavantage}` 或 `changePercent == null` → 走 Finnhub。新写一个 cache-first 读路径必须 `import { isStaleQuoteSource } from "../stale-quote"` 并在 `priceCache.get` 之后过滤，否则 HOOD/AAPL/MSFT/NVDA 类 bug 会复发。
- **`DeviationBar` (RN)**: 勿用 `h-2` + `h-full` 撑条高 — 用固定 `8px`；条宽按 `|deviationPercent|` 而非 `currentPercent`。
- **CI gate step 顺序（2026-05-30 踩坑）**: "Pre-push Quality Gate" 把 typecheck → lint → test 当**顺序 step**。typecheck fail 时 lint **从不执行**，会**掩盖** pre-existing lint error。本地 `git commit` 的 husky hook **只跑 prettier**（不跑 eslint）→ 本地 typecheck 6/6 ≠ CI 绿。**推前先本地 `pnpm lint` + `pnpm typecheck` + `pnpm test` 三件套**对齐 CI，别只信 typecheck。
- **硬编码颜色 lint**: 业务/组件代码禁止 hex/oklch/rgb 字面量（`eslint.config.mjs` §决策七）。装饰性原始色（avatar 渐变等）放 `packages/ui/src/tokens/**`（lint 豁免目录，见 `avatar-gradients.ts` / `navigation-colors.ts`），勿留在 `finance/` 等业务层。
- **失效 eslint-disable**: flat config **没注册** `react-hooks` 插件 → 任何 `// eslint-disable react-hooks/exhaustive-deps` 会报 "rule not found" **error**（非 warning）。要么注册插件，要么删 disable 行（当前选删，因规则本就没启用）。
- All prior Stage 1 gotchas still apply (FixtureAdapter, @arc/ui imports, OTP 8-digit, etc.).
- **Expo SDK 55** (2026-05-19): `expo@~55`, RN **0.83.6**, React **19.2**; `app.json` 已移除 `newArchEnabled` / `edgeToEdgeEnabled`（SDK 55 默认）；monorepo 启用 `experiments.autolinkingModuleResolution`；根 `pnpm.overrides` 钉住 `react@19.2.0`。勿扫 **8082** 等非 Arc Metro 二维码（会报 SDK 54 不兼容）。
- **AKShare wrapper (Vercel)**: 纯 Python 子项目须 `vercel.json` **`builds` + `routes`**（勿仅用 `functions` glob）；共享代码放 `lib/` 勿放 `api/_shared/`。Hobby 冷启动慢；跨市场 4 标的串行拉价 UI 全表「加载中」直到最慢一只返回。
- **Portfolio Hero**: `import { PortfolioHeroSection } from '@arc/ui'` — 业务页不拼 chart 子组件。DEV 全量 UAT → **`portfolios:30-days-history`**（FAB **组合** → 落地 Portfolio Tab）。
- **Market filter hero**: `selectedMarketFilters` 非空时 hero 总值/日涨跌/chart 经 `portfolio-market-filter.ts` 重算（与 holdings 表一致）。
- **Tailwind soft-foreground**: 改 `@layer theme` 的 `--accent-soft-foreground` 不够；须 `global.css` `@theme inline` 桥接 `--color-*-soft-foreground`（见 ADR 003）。
- **Cross-market DEV seed**: `default:cn-only|hk-only|fund-only|cross-market|crypto-only` 走 **App 内 JWT**（`run-cross-market-seed-client.ts`），非 Edge `dev-seed`。CRYPTO 资产行首次需 `pnpm seed:crypto-only`（service_role）或 Block C migration 0013。
- **Real/Clean env**: `DEV_*_EMAIL` 经 `app.config.ts` → `Constants.expoConfig.extra`；改 `.env` **必须** `pnpm mobile -- --clear`。`envMode=unknown`（如 `cyberjby@gmail.com` 无 alias）→ **全部 seed 场景隐藏**（by design）。
- **Auth email (dev)**: 新 alias 首次注册 → **Confirm signup** 模板；Returning → **Magic Link** 模板。两模板都要有 `{{ .Token }}`。

## Active env / config snapshot

| File               | Status                                                                                                  |
| :----------------- | :------------------------------------------------------------------------------------------------------ |
| `apps/mobile/.env` | Supabase + Finnhub + Tushare + AKShare + **`DEV_REAL_EMAIL` / `DEV_CLEAN_EMAIL`**（+alias，gitignored） |
| `.env.dev.local`   | `SUPABASE_DEV_*`, `DEV_SEED_EMAIL`（建议 = Clean alias）                                                |
| Resend / Supabase  | `auth.boyangjiao.xyz` Verified · SMTP `noreply@auth.boyangjiao.xyz`（Dashboard 配置，非 repo）          |
| Migrations         | `0001`–`0010` ✅；**0012** manual snapshot insert、**0013** CRYPTO assets — **UAT 前用户 SQL** ⏳       |
| AKShare wrapper    | `https://arc-akshare-wrapper.vercel.app` + `AKSHARE_WRAPPER_TOKEN` on Vercel                            |
| Supabase project   | `jdvlzkictwinkgcvgwew`                                                                                  |
| Git branch         | `dev/stage-3`                                                                                           |

## Recent ADRs (most relevant first)

| ADR     | Topic                                                                                             |
| :------ | :------------------------------------------------------------------------------------------------ |
| **013** | `@arc/ui` wrapper 所有权 + chart L2 polish（Portfolio Hero 落地）— **已接受**                     |
| **012** | 双区域 Auth + 数据驻留（大陆微信/手机/邮箱，P1 BFF + Supabase session）— **提议，待 Opus review** |
| **011** | 多源 fallback + AKShare wrapper（Stage 3 HK/FUND primary）— **已接受 + Phase 2 已实施**           |
| 010     | Dev cache trust strategy (`isStaleQuoteSource` 共享 helper；Infinity freshness)                   |
| 009     | Daily Snapshot timing (23:00 UTC) + cron + cache-only snapshot                                    |
| 008     | FixtureAdapter + Settings market-data toggle（fixture 路径已退役）                                |
| 007     | Dev auth + seed SQL injection                                                                     |
| 006     | `@arc/ui` layering                                                                                |

## How to use this file

1. **Block C UAT 会话**: CLAUDE.md → this file §Block C UAT → `holdings-and-transactions-stage-3.md` §S3-AC-C.
2. DEV FAB: **组合** → **`portfolios:30-days-history`**（Hero 全量 UAT）；日涨跌 edge → **每日快照** 组。
3. End session: `/checkpoint`.
