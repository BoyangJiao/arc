# Arc — 测试策略（Layered Testing Playbook）

> **目的**：未来开发任何新功能（Daily Snapshot / Watchlist / Rebalance / CSV / TWR …）都按本文件分层选工具。**避免每次重新讨论「这个怎么测」**。
>
> **原则**：把测试拉到「尽可能上游」的层。能在纯函数测的，不进组件；能在组件测的，不进 App；能在 App 之外测的，不进 E2E。
>
> **金融产品特有铁律**：金额必须用 `Decimal`，时间必须可注入（不硬编码 `new Date()`），合规文案必须有 lint。

---

## 一、测试金字塔（套到 Arc）

```
                          /\
                         /  \
                        / E2E\           Layer 6 — Maestro：3-5 条 happy path
                       /──────\
                      /集成测试\          Layer 7 — DB+RLS / Edge Function / Adapter
                     /────────\
                    /组件 UI    \         Layer 2 — Storybook（每个状态 1 story）
                   /────────────\
                  /场景数据 fixtures\     Layer 4 — seed:dev --scenario
                 /──────────────\
                / 单元 + property \      Layer 1 — vitest + fast-check
               /──────────────────\
```

**口径**：写一次 = 覆盖 N 个用例的能力，N 越大越靠下层。

---

## 二、按场景选层（决策表）

| 你要测什么                                             | 用哪层          | 工具                                | 是否需要登录 App                |
| :----------------------------------------------------- | :-------------- | :---------------------------------- | :------------------------------ |
| 纯函数：金额加减、币种换算、ID 解析、排序、Top-K       | **Layer 1**     | vitest + fast-check                 | 否                              |
| 数据模型不变性（资产 ID 不变、`holdings = Σtx`）       | **Layer 1**     | property-based test                 | 否                              |
| UI 组件的 N 种状态（happy / loading / error / empty）  | **Layer 2**     | Storybook                           | 否                              |
| UI 在不同 props 下的视觉回归                           | **Layer 2 + 8** | Storybook + Chromatic               | 否                              |
| 网络层 happy/edge（API 5xx / schema drift / 限额）     | **Layer 3**     | FixtureAdapter（现有）+ MSW（未来） | 否                              |
| 不同**数据形态**（首日 / 满仓 / 空仓 / 部分行情缺失）  | **Layer 4**     | `seed:dev --scenario`               | 是（看 UI），但**一个邮箱即可** |
| 运行时态切换（红涨绿跌 toggle 后立即变色，无 remount） | **Layer 5**     | in-app dev menu（仅 `__DEV__`）     | 是                              |
| 端到端 happy path（J1 登录 → J2 加交易 → J7 看卡片）   | **Layer 6**     | Maestro                             | 是                              |
| DB schema / RLS / migration                            | **Layer 7**     | 临时 Postgres + 断言                | 否                              |
| Edge Function（idempotent / 无外部 API 调用）          | **Layer 7**     | Deno test + supabase start          | 否                              |
| 视觉像素回归                                           | **Layer 8**     | Chromatic                           | 否                              |

**反向决策**：

- ❌ 不要用 E2E 测 edge case（慢、脆，维护成本高）
- ❌ 不要在产品代码里加"测试模式开关"去模拟数据形态——那是 Layer 4 的活
- ❌ 不要用多账号去切场景（验收一个功能不该准备 N 个邮箱）

---

## 三、每一层的现状 + 下一步

### Layer 1 — 单元 + property test ✅ 已就绪

- **已有**：`packages/core/__tests__/*.spec.ts`（`compute-daily-delta`、`decimal`、`portfolio-valuation`）
- **节奏**：每次发现 bug → **加一条 property**（而不是只加一个 hard-coded case）
- **金额纪律**：任何 `Decimal` 函数 PR 必须配 property test，否则不合并

### Layer 2 — Storybook ⏳ 未起步（P1）

- **目标**：`@arc/ui/finance` 每个组件至少 4 个 story（happy / empty / error / extreme）
- **首批落地**：`DailySnapshotCard`（4 个 state）、`PortfolioCard`、未来 `RebalanceActionRow`
- **技术选型**：`@storybook/react-native` + Web 输出（一份 story 跑两端）
- **接 Chromatic**：等 Storybook 跑起来再上视觉回归

### Layer 3 — 网络层 fixture ✅ 部分

- **已有**：`packages/data-sources/` adapter 接口 + `apps/mobile/src/lib/dev-fixtures/quotes.json`
- **下一步**：fixture 扩成 `fixtures/{happy,partial-quotes,stale,error}.json`，FixtureAdapter 按 dev menu 选择
- **MSW**：仅 web 输出 / Layer 7 集成测试时加，RN 端继续用 FixtureAdapter

### Layer 4 — Scenario seed ✅ 已就绪（v1）

- **入口**：`pnpm seed:dev --email <你> --scenario <name>`
- **命令速查（持久化）**：[`docs/dev-seed-cheatsheet.md`](./dev-seed-cheatsheet.md) — UAT 时只查这一份，不翻聊天
- **默认场景**：省略 `--scenario` → `default`（今天 = Daily Snapshot happy；未来会组合多 feature）
- **支持的 scenario**：见 cheatsheet + `pnpm seed:dev --help`
- **新增 scenario 的规则**：
  1. 命名 `<feature>:<state>`，如 `daily-snapshot:big-loss`、`rebalance:big-drift`
  2. 必须 idempotent（reset 模式重跑产出一致）
  3. 在 feature spec 的 Acceptance Criteria 表里写明"对应 scenario"
- **未来 feature 上线时**：把新 scenario 加进种子脚本（不是去 Supabase 后台改数据）

### Layer 5 — In-app dev menu 🟡 局部存在

- ~~Me → 设置 → "拉取真实行情" toggle（ADR 008a, retired by ADR 010 — dev 一律走 Finnhub）~~
- **原则**：**只为运行时态切换**而存在（颜色切换、语言切换、报告货币切换）
- **不要扩成**：数据形态选择器（首日 / 空仓 …）—— 那是 Layer 4

### Layer 6 — Maestro E2E ⏳ 未起步（P1）

- **目标**：3-5 条脚本，覆盖核心 user journey
  - `j1-first-login.yaml`（J1）
  - `j2-add-transaction.yaml`（J2）
  - `j7-daily-snapshot.yaml`（J7）
- **不要写**：edge case、错误态、不同语言（Layer 1-3 已经覆盖）
- **CI**：iOS sim only，每 PR 跑一次

### Layer 7 — 后端集成测试 ⏳ 未起步（P2）

- **RLS test**：`supabase start` 起本地 → 用两个 service role JWT 模拟 user A / user B，断言「A 看不到 B 的 portfolio」
- **Edge Function**：本地 `supabase functions serve daily-snapshot`，断言 idempotent + 无外部调用
- **Adapter contract test**：保存真实 Alpha Vantage / Frankfurter 响应 JSON 入仓，每月手动 refresh

### Layer 8 — Chromatic ⏳ 等 Storybook（P2）

---

## 四、新功能开发的标配测试清单

每次开新 feature spec 时，在 spec 末尾的 "Acceptance criteria" 后**强制**加一节：

```markdown
## Test plan

| AC          | 用哪一层 | 工件                                                   |
| :---------- | :------- | :----------------------------------------------------- |
| AC-1 主路径 | Layer 1  | `packages/core/__tests__/<feature>.spec.ts` 主路径用例 |
| AC-1 主路径 | Layer 2  | `<Component>.stories.tsx` 的 Happy story               |
| AC-1 主路径 | Layer 4  | `seed:dev --scenario <feature>:happy`                  |
| AC-1 主路径 | Layer 6  | `.maestro/<feature>-happy.yaml`                        |
| AC-2 首日   | Layer 2  | `.stories.tsx` 的 FirstDay story                       |
| AC-2 首日   | Layer 4  | `seed:dev --scenario <feature>:first-day`              |
| AC-3 空态   | Layer 2  | `.stories.tsx` 的 Empty story                          |
| AC-4 排序   | Layer 1  | property test（随机 N 持仓断言 Top-K）                 |
| AC-5 切换   | Layer 2  | story `args` 切换 + Layer 5 in-app 验证                |
| AC-6 后端   | Layer 7  | 集成测试                                               |
```

**没填 Test plan 的 spec 不进入开发**。

---

## 五、Daily Snapshot 作为示范（J7）

| AC                        | 用哪一层             | 工件                                                                                    |
| :------------------------ | :------------------- | :-------------------------------------------------------------------------------------- |
| S2-AC-1.1 主路径          | L1 + L2 + L4         | `compute-daily-delta.spec.ts` + `DailySnapshotCard.stories.Happy` + `pnpm seed:default` |
| S2-AC-1.2 首日            | L2 + L4              | `Stories.FirstDay` + `--scenario daily-snapshot:first-day`                              |
| S2-AC-1.3 空组合          | L2 + L4              | `Stories.Empty` + `--scenario daily-snapshot:empty`                                     |
| S2-AC-1.4 Top 3 排序      | **L1 property test** | "随机 N 持仓，断言 movers 数组按 \|deltaPercent\| 降序前 3"                             |
| S2-AC-1.5 红涨绿跌        | L2 + L5              | story 切 `mode`；在 App 实际切 Settings 验无 remount                                    |
| S2-AC-1.6 cron idempotent | L7                   | 调两次断言行数不变                                                                      |
| S2-AC-1.7 无外部 API      | L7                   | 函数运行期间断言 outbound HTTP = 0                                                      |

**结果**：7 条 AC 里 **6 条不需要登录 App**。

---

## 六、金融产品 8 条额外纪律

1. **Decimal 是金额唯一类型**——ESLint + property test 双守。
2. **时间可注入**——所有 `new Date()` 走 `getNow()`，测试里冻结。
3. **合规文案 lint**——禁忌词（"建议买入"…）由 ESLint 自定义 rule 扫，**不靠人肉记**。
4. **Adapter 契约 fixtures 入仓**——真实 API 响应 JSON 存 git，发现 schema drift。
5. **RLS 必须有测试**——每张表新增 policy 时跑 `as user A` / `as user B` 双断言。
6. **黄金数据集**——TWR / MWR / Rebalance 这类算法保留人工算出的 expected 数组。
7. **跨日时区**——任何"今日 vs 昨日"逻辑必有"23:59 → 00:01 滚动"property test。
8. **API quota 测试在 Layer 3**——不要为了"测限额"在真生产里打满 25 次。

---

## 七、参考

- ADR 007：Dev Auth + 种子数据策略
- ADR 008a：Dev 行情数据策略（FixtureAdapter — retired by ADR 010）
- ADR 010：Dev 缓存信任策略（source 兜底 + Infinity freshness）
- ADR 009：Daily Snapshot 时点
- `.specify/feature-specs/stage-2/daily-snapshot-stage-2.md` — Test plan 模板的参考实现
- `tools/seed-dev-data.ts` — Layer 4 scenario 实现
