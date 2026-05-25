# ADR 009 — Daily Snapshot 时点策略与外部触发器

- **状态**: 已接受
- **日期**: 2026-05-18
- **作者**: BoyangJiao + Claude (Opus 4.7)
- **相关 ADR**: 001（Tech Stack — Supabase），007（Dev Auth + Heartbeat 外部触发模式），008（Dev 行情策略）
- **关联 spec**: `.specify/feature-specs/stage-2/daily-snapshot-stage-2.md`（J7 实施合同）
- **触发**: Stage 2 J7 Daily Snapshot 实施期间需要冻结 3 个跨阶段决策——快照时点、触发机制、复用 vs 新拉取报价——否则 Stage 3+ 会反复回头讨论。

---

## 背景

Daily Snapshot（user-journey J7）需要每天对每个 portfolio 做一次估值快照，作为"今日变动"卡片的对比基线。三个相互独立的决策点出现在 Stage 2 实施期间，每一个都会影响后续 Stage：

1. **快照时点** — 一天 24h 哪一刻算"昨日收盘"？跨时区怎么对齐？
2. **触发机制** — Supabase pg_cron / Edge Function 自调 / 外部 cron 哪一个？
3. **报价来源** — 快照时是用缓存（保 quota）还是强拉一次最新值（保新鲜度）？

每个决策都有"短期最便宜"和"长期最正确"两个明显方向。Stage 2 选短期方便很正常，但**不写下来的话，Stage 3/4 接 A 股 / 港股 / 加密 / TWR 历史曲线时会重新争论一遍**——所以本 ADR 把当前选择锚定 + 明确"未来什么情况触发重新评估"。

---

## 决策

### 决策一：快照时点固定为 **23:00 UTC**（= 北京次日 07:00）

```
00 UTC ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 24 UTC
       01:30                   13:30  21:00  23:00 ← 快照时点
       CN open                 CN close US close
                                              (= 北京 07:00)
```

理由：

- **US 收盘后 2h** — 21:00 UTC US 市场关；2h 缓冲让用户日常活动（北京晚上）把收盘价写进 `price_snapshots` 缓存；快照拿到的是 day-end 价
- **CN 开盘前 2.5h** — 不污染 CN intraday 状态
- **北京 07:00** — 用户早上打开 app 看到的是"昨日收盘"的对比，符合心智模型
- **单全局时点**（不按用户时区） — Stage 2 不引入用户 TZ 数据；多 TZ 用户暂时接受"一天前 23:00 UTC"作为基线

**何时重新评估**：

- 出现 >5 名美国西海岸用户抱怨"周一早上看到的是周日的卡片"（实际是 7am 西海岸 = 周日 23:00 UTC + 偏移）
- Stage 3 引入用户时区字段（如为 TWR 历史曲线需要）
- App Store 上架后用户分布报告显示中国时区占比 <60%

### 决策二：外部触发器（GitHub Actions cron → POST Edge Function），不用 pg_cron

```
                ┌────────────────────────────────┐
                │ GitHub Actions cron 23:00 UTC  │
                └────────────────┬───────────────┘
                                 │ POST + shared secret
                                 ▼
                ┌────────────────────────────────┐
                │ Supabase Edge Function         │
                │   daily-snapshot               │
                │   (Deno runtime, service_role) │
                └────────────────┬───────────────┘
                                 │ upsert
                                 ▼
                ┌────────────────────────────────┐
                │ portfolio_value_snapshots      │
                └────────────────────────────────┘
```

考量过的方案：

| 方案                                                     | 优                                                                                                                                 | 劣                                                                    | 决策 |
| :------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------- | :--: |
| **A. GitHub Actions cron → Edge Function HTTPS**（采用） | 与 ADR 007 supabase-heartbeat 同模式；Free tier 项目被 pause 时心跳能唤醒；故障可见（GH Actions 红 X）；workflow_dispatch 手动重跑 | 多一层 hop；需要管 2 个 secret（URL + secret）                        |  ✅  |
| B. Supabase pg_cron                                      | 全部留在 Supabase 内部；无 GH 依赖                                                                                                 | **项目被 pause 时不跑** — 跟 heartbeat 同样的死锁；故障埋在 DB log 里 | 拒绝 |
| C. Supabase Edge Function 自我循环（setInterval）        | 简单                                                                                                                               | Edge Function 是 stateless，没有"持续运行"概念；伪需求                | 拒绝 |

外部触发器 + Edge Function 已经是 Arc 第二次使用此模式（第一次是 supabase-heartbeat.yml）。**确认为长期模式：所有定时任务都走 GitHub Actions cron → Supabase Edge Function**。Stage 3+ 如有需要（如夜间价格预热、Watchlist 异动检查）沿用同模板。

### 决策三：Snapshot 时**复用现有缓存**，不强拉新报价

Edge Function 只读 `price_snapshots` + `fx_rates` 表里的最新行；**永远不调** Alpha Vantage / Frankfurter。

理由：

- **API quota** — Alpha Vantage 免费档 25/day 全系统共享。100 用户 × 10 持仓 = 1000 次/day = 立即爆配额
- **缓存覆盖率** — 用户日常活动（开 app、pull-to-refresh）已经在白天把缓存填好。23:00 UTC 时缓存通常 fresh enough
- **降级行为可接受** — 周末 / 用户不活跃期，缓存可能 stale。但卡片显示 "对比昨日" 仍然有信息量；spec §UI contract 已规定 "对比自 N 天前" 的 stale 状态

**何时重新评估**：

- Stage 4 升级到 Polygon / Alpha Vantage Premium（quota 不再是瓶颈）
- 用户报告："周一打开看到的卡片明显跟周五收盘对不上"
- Stage 5 引入 push 通知 "Today's big moves" → 需要更准的实时基准

那时 Edge Function 改为"先看缓存，缓存 stale 才拉新"即可，签名不变。

### 决策四：Snapshot 表的所有权与 RLS

- **写入**：仅 service_role（Edge Function）。`portfolio_value_snapshots` 表无 client INSERT/UPDATE/DELETE policy。
- **读取**：用户读自己 portfolio 的快照（policy 通过 `portfolios.user_id = auth.uid()` JOIN 推导）
- **理由**：与 `price_snapshots` / `fx_rates` 一致（ADR 007 §决策三 相同的 service_role-write、public-read 模式）。dev 期间种子脚本同样用 service_role 写。

### 决策五：跨阶段稳定承诺

下列字段 / 行为**不会**在 Stage 3-5 改动（哪怕重写 Edge Function 内部）：

- `portfolio_value_snapshots` 表 schema：`(portfolio_id, as_of)` 主键 + `total_value` / `total_cost_basis` / `per_asset` JSONB / `reporting_currency` / `source`
- `as_of` 始终是 ISO 8601 UTC timestamp（不退化为 date-only）
- `per_asset` 永远是 `{ assetId, shares, valueNative, currency, valueReporting }` 数组（Stage 3 加字段只增不删）
- `source` 永远是 `"edge-function" | "manual"`（Stage 3 可加新值，旧值不删）
- 上层 `computeDailyDelta` 的 status union `"ok" | "no-baseline" | "empty-portfolio"` 不删项（可加）

**可以**变动的：

- 时点（决策一的 23:00 UTC）
- 触发器实现细节（决策二的 GitHub Actions）
- 缓存策略（决策三）
- 排序规则（mover 按百分比 vs 金额；当前百分比，spec §决策二）

---

## 后果

### 正面

- 三处跨阶段决策一次冻结，Stage 3+ 不需要重新讨论除非触发条件出现
- 外部 cron 模式已被 ADR 007 + 008 + 009 三处使用，新人接手时模式识别度高
- API quota 不再是 daily snapshot 的瓶颈，对应 25/day 用 1 次/day 都嫌多
- 表 schema 稳定承诺让 Stage 3 charts / TWR 实现可以放心 query 而不担心 schema 漂移

### 负面

- 多时区用户体验非最优（北京用户最舒服，洛杉矶用户接受 "一天前 23:00 UTC"）
- 周末 / 长假期间快照报价可能 stale（决策三的 known tradeoff）
- pg_cron 路径被关闭后，若未来发现 Edge Function 冷启动延迟有问题，需要二次评估

### 中性

- 决策二让 Arc 与 GH Actions 强耦合。Repo 转私 / GH 价格变动会影响。Stage 5 上架后如出问题，迁到 cloud cron service（Fly / Render / 自建 K8s CronJob）成本可控。

---

## 实施清单（Stage 2 J7 实现状态）

- [x] `packages/db/drizzle/migrations/0003_portfolio_value_snapshots_daily_snapshot.sql` — schema + RLS（决策四）
- [x] `packages/core/src/snapshot/compute-daily-delta.ts` — pure function（决策五承诺的 status union）
- [x] `packages/ui/src/finance/DailySnapshotCard.tsx` — 4 状态卡片
- [x] `apps/mobile/src/lib/queries/use-daily-{snapshot,delta}.ts` — 读 + 复合
- [x] `apps/mobile/app/(tabs)/index.tsx` — Portfolio Tab 集成
- [x] `supabase/functions/daily-snapshot/index.ts` — Edge Function（决策二 + 三）
- [x] `.github/workflows/daily-snapshot.yml` — cron 23:00 UTC（决策一 + 二）
- [x] `tools/seed-dev-data.ts` — yesterday snapshot 让 dev 立即看到卡片
- [x] 16 个 property tests 守护 computeDailyDelta（决策五承诺的契约）

## 后续

- 决策一/三的"何时重新评估"信号出现时 → 写 ADR 010 / 011 修订
- Stage 3 历史曲线实施前回头检查 `per_asset` JSONB 是否仍是合适的存储（若需要 per-asset-per-date 高频查询，可能改为 child table — 但表的主 schema 不变，只是加一个派生表）
