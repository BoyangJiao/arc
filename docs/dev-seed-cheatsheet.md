# Dev Seed Cheatsheet — `pnpm seed:dev`

> **用途**：UAT / 手测时快速查命令，不依赖聊天历史。  
> **策略背景**：见 [`testing-strategy.md`](./testing-strategy.md)（Layer 4 = 数据形态；不是唯一测试手段）。  
> **实现**：[`tools/seed-dev-data.ts`](../tools/seed-dev-data.ts)

---

## 一次性配置邮箱

在 **`.env.dev.local`**（repo 根目录）增加一行（见 `.env.dev.example`）：

```bash
DEV_SEED_EMAIL=cyberjby@gmail.com
```

之后所有短命令**不用再写 `--email`**。

---

## 四种便捷入口（推荐）

### A. 短 pnpm 命令（最快）

```bash
pnpm seed:default       # 日常默认（≈ +2% Daily Snapshot）
pnpm seed:ds:gain       # 大涨 +10%
pnpm seed:ds:loss       # 大跌 -5%
pnpm seed:ds:mixed       # Top-3 + 红绿混合
pnpm seed:ds:first-day  # 首日占位
pnpm seed:ds:empty      # 空仓，卡片隐藏
```

命名规则：**`seed:<feature-缩写>:<state>`** — 今天 Daily Snapshot 用 `ds`；未来例如 `seed:wl:add`（Watchlist）、`seed:rb:drift`（Rebalance）。

### B. IDE Run Task（点选、不记命令）

**Cmd+Shift+P** → `Tasks: Run Task` → 选例如 **Seed: Daily Snapshot — first day**

任务定义在 [`.vscode/tasks.json`](../.vscode/tasks.json)。

### C. Cursor 斜杠命令

聊天输入 **`/seed-dev`**，再说场景（如 `first-day`、`大涨`、`mixed`）— Agent 会跑对应 `pnpm seed:ds:*`。

定义在 [`.cursor/commands/seed-dev.md`](../.cursor/commands/seed-dev.md)。

### D. App 内开发工具（产品 / 设计 UAT）✅ 推荐

**紫色 DEV 悬浮钮**（任意已登录页面右下角，可拖动、可贴边隐藏）→ 点场景。

设置里仍保留「开发工具」全屏入口。部署见下文 **§App 内开发工具面板**。

---

## 完整命令（仍可用）

```bash
pnpm seed:dev --email YOUR_EMAIL --scenario daily-snapshot:big-gain
pnpm seed:dev --help
```

**跑完后在 App 里**：模拟器 **⌘D** → **Reload** 重新加载 JS（多数情况足够）。

---

## 默认场景是什么？

| 名称                                  | 含义                                                                    |
| :------------------------------------ | :---------------------------------------------------------------------- |
| **`default`**（省略 `--scenario` 时） | 项目约定的 **日常开发默认态**：3 只美股 + 昨日快照约 -2% → 卡片约 +2%。 |

**未来**：`default` 会随 Stage 2/3 功能增长，自动组合各模块的 happy 子场景（例如 Welcome 已看过、Watchlist 有 3 条、Rebalance 已设目标）。各功能的 edge case 仍用 `feature:state` 单独 seed。

**命名约定**：

- `default` — 全 App 日常一眼正常的组合态（**只应有一个**）
- `<feature>:<state>` — 单功能验收，如 `daily-snapshot:first-day`、`rebalance:big-drift`（未来）

---

## App 刷新：⌘D → Reload / 下拉 / 杀进程

| 操作                  | 是什么                                             | seed 后够不够用                                        |
| :-------------------- | :------------------------------------------------- | :----------------------------------------------------- |
| **⌘D → Reload**       | 打开 Expo 开发者菜单，点 **Reload** 重载 JS bundle | ✅ **推荐**（iOS 模拟器上 ⌘R 常常是截图，不是 Reload） |
| 组合 Tab **下拉刷新** | 重新拉 React Query 数据                            | 开发工具切场景后通常会自动 invalidate；可再拉一次      |
| 模拟器划掉 App 再开   | **真·冷启动**（原生进程 + 内存全清）               | 仅 Reload 后界面仍不对时用                             |

`seed:dev --mode reset` 会**删掉旧组合并新建**（portfolio id 会变）。Reload 一般会拿到新 id；若还看到旧数字，再冷启动一次。

---

## 前置条件（一次性）

1. 仓库根目录 `.env.dev.local`（见 `.env.dev.example`）
2. 该邮箱已在 App 里 **OTP 登录过一次**
3. Migration **0003** 已应用到 dev Supabase（`portfolio_value_snapshots.per_asset` 等列）— 见 [`0003_….sql`](../packages/db/drizzle/migrations/0003_portfolio_value_snapshots_daily_snapshot.sql)

---

## Daily Snapshot（J7）— 全部场景

邮箱占位：`YOUR_EMAIL`

| Scenario         | 命令                                                                      | App 里应看到                                                           |
| :--------------- | :------------------------------------------------------------------------ | :--------------------------------------------------------------------- |
| **日常默认**     | `pnpm seed:dev --email YOUR_EMAIL`                                        | 今日变动完整卡，约 **+2%**，3 个 mover chip                            |
| 大涨             | `pnpm seed:dev --email YOUR_EMAIL --scenario daily-snapshot:big-gain`     | 约 **+10%**，涨色                                                      |
| 大跌             | `pnpm seed:dev --email YOUR_EMAIL --scenario daily-snapshot:big-loss`     | 约 **-5%**，跌色                                                       |
| Top-3 + 红绿混合 | `pnpm seed:dev --email YOUR_EMAIL --scenario daily-snapshot:mixed-movers` | NVDA / MSFT / AAPL 排序 + 红绿 chip；配合 **设置 → 涨跌色** 验 S1-AC-5 |
| 首日占位         | `pnpm seed:dev --email YOUR_EMAIL --scenario daily-snapshot:first-day`    | 「首次启动，明日开始追踪…」，无大数字                                  |
| 空仓             | `pnpm seed:dev --email YOUR_EMAIL --scenario daily-snapshot:empty`        | **无**今日变动卡，空持仓引导                                           |

验收后对照： [`.specify/feature-specs/daily-snapshot-stage-2.md`](../.specify/feature-specs/daily-snapshot-stage-2.md) §Test plan

```bash
pnpm seed:dev --help   # 终端里列出所有 scenario
```

---

## `seed:dev` 现在还种了什么？（不只 Daily Snapshot）

每次成功执行都会写入 dev Supabase（**真实表 + 真实 RLS 下的 service role 写入**）：

| 数据                        | 说明                                               |
| :-------------------------- | :------------------------------------------------- |
| `assets`                    | AAPL / MSFT / NVDA 元数据                          |
| `portfolios`                | 一个 "My Portfolio"，报告货币 CNY                  |
| `transactions`              | 3 笔 BUY（跨 3 个月）— `empty` scenario 会跳过     |
| `price_snapshots`           | 当前价缓存（免 AV 配额）                           |
| `fx_rates`                  | USD→CNY 7.20                                       |
| `portfolio_value_snapshots` | 昨日 23:00 UTC 基线 — `first-day` / `empty` 会跳过 |

因此：**组合 Tab 总资产、持仓列表、行情换算** 也会一起被 seed 好，不只是 Daily Snapshot 卡片。

---

## 未来功能：新 scenario 怎么加？

1. 在 `tools/seed-dev-data.ts` 增加 `SCENARIO_PLANS` 条目（命名 `feature:state`）
2. **在本文件** 加一行到对应 feature 表格
3. 在 feature spec 的 **Test plan** 表写上 scenario 名
4. 若属于「日常一眼正常」，考虑是否并入 `default` 组合逻辑

**模板（复制到下方「待建」区）**：

```markdown
### Watchlist（J8）— 待建

| Scenario    | 命令                                                          | App 里应看到          |
| :---------- | :------------------------------------------------------------ | :-------------------- |
| 有 3 只自选 | `pnpm seed:dev --email YOUR_EMAIL --scenario watchlist:happy` | Markets Tab 列表 3 行 |
```

---

## 待建 scenario 区（新功能开发时往下填）

| Feature           | Scenario 前缀      | 状态      |
| :---------------- | :----------------- | :-------- |
| Daily Snapshot J7 | `daily-snapshot:*` | ✅ 见上表 |
| Welcome J6        | `welcome:*`        | ⏳        |
| Watchlist J8      | `watchlist:*`      | ⏳        |
| Rebalance J9      | `rebalance:*`      | ⏳        |
| CSV J10           | `csv-import:*`     | ⏳        |

---

## 不是所有测试都走 `seed:dev`

| 测什么                   | 用什么                             |
| :----------------------- | :--------------------------------- |
| 金额/排序/不变性         | `pnpm test`（Layer 1）             |
| 组件 4 态 / 红涨绿跌静态 | Storybook（Layer 2，待建）         |
| API 5xx / 限额           | Fixture 文件 / MSW（Layer 3）      |
| **数据形态、UAT 走查**   | **`seed:dev`（Layer 4）** ← 本文件 |
| 设置里 toggle 即时生效   | Me → 设置（Layer 5）               |
| 登录→加交易主路径        | Maestro（Layer 6，待建）           |
| Cron / RLS               | curl + SQL / 集成测试（Layer 7）   |

---

## D. App 内开发工具面板（GUI）✅

**路径**：我 → 设置 → **开发工具**（仅 `__DEV__` 构建可见）

点选一个场景 → 调用 `dev-seed` Edge Function → 自动刷新缓存 → 打开组合页验收。

**一次性部署**（dev Supabase 项目）：

```bash
# CLI via repo (pnpm install 后): pnpm supabase …
# 或一次性: npx supabase …
pnpm supabase login
# Replace <your-dev-project-ref> with the ref from your Supabase Dashboard
# (Project Settings → General → Reference ID). Each dev should use their
# own dev project — don't paste another teammate's ref.
pnpm supabase link --project-ref <your-dev-project-ref>
pnpm functions:secrets:dev-tools
pnpm functions:deploy:dev-seed
```

详见 [`supabase/functions/dev-seed/README.md`](../supabase/functions/dev-seed/README.md)。

若报错 “function unreachable”，说明 Edge Function 尚未部署或未设 `DEV_TOOLS_ENABLED`。

---

## 未来：扩展 Dev Tools（更多 feature scenario）

> **状态**：Daily Snapshot 六态已接入；Watchlist / Rebalance 等随功能增加按钮即可。

**目标**：在 Dev Client 的 Dev Menu 或 App 内「开发工具」里**点按钮**切换 scenario，适合产品/设计 UAT，不必记终端命令。

**可行架构**（service_role **永不进 App bundle**）：

```
App Dev Menu「切到：首日占位」
    → POST /functions/v1/dev-seed  { scenario: "daily-snapshot:first-day" }
    → Edge Function（dev project only，校验 DEV_SEED_SECRET）
    → 与 tools/seed-dev-data.ts 共用同一套 SCENARIO_PLANS 逻辑
    → 返回 OK → App invalidateQueries + 提示 ⌘R
```

**能覆盖什么**：

| 类型                               | Dev GUI + Edge Function | 仅终端 seed |
| :--------------------------------- | :---------------------: | :---------: |
| 换持仓 / 快照 / 多表数据形态       |           ✅            |     ✅      |
| 真·RLS / cron / Edge Function 行为 |           ✅            |     ✅      |
| 纯 UI 态（涨跌色 toggle）          |       用设置即可        |      —      |
| 离线、无 dev 后端                  |           ❌            |     ✅      |

**不能指望 GUI 单独覆盖的**：Layer 1 property test、Layer 2 Storybook、Layer 6 Maestro — 那些仍走各自工具链。

落地前需：dev-only Edge Function、`EXPO_PUBLIC_DEV_TOOLS=1` 门控、与 `seed-dev-data.ts` 抽共享 scenario 模块避免双份逻辑。

---

## 相关链接

- [测试策略总览](./testing-strategy.md)
- [ADR 007 — Dev 种子数据](./adr/007-dev-auth-and-seed-strategy.md)
- [ADR 008a — Fixture 行情 (Retired by ADR 010)](./adr/008a-dev-market-data-strategy-retired.md)
- [ADR 010 — Dev 缓存信任策略](./adr/010-dev-cache-trust-strategy.md)
