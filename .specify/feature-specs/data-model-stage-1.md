# Feature: Stage 1 数据模型（packages/db schema）

- **Status**: Done
- **Author**: BoyangJiao + Claude
- **Created**: 2026-05-14
- **Implements**: development-plan §五 数据模型设计、IA v2.2 §四、user-journeys J1-J5
- **Conforms to**: `.specify/data-model-invariants.md`
- **Supabase Project**: `jdvlzkictwinkgcvgwew` (BoyangJiao's Project, Tokyo)

---

## Why

User Journey J1-J5（Stage 1 DoD）需要后端数据：

| Journey                     | 依赖表                                                                          |
| :-------------------------- | :------------------------------------------------------------------------------ |
| J1 注册登录                 | `auth.users`（Supabase 自带）+ trigger 自动建 `portfolios` + `user_preferences` |
| J2 录入第一笔交易           | `assets`、`portfolios`、`transactions`                                          |
| J3 切换报告货币（看到换算） | `user_preferences`、`fx_rates`（adapter 写入）                                  |
| J4 切换语言                 | `user_preferences.locale`                                                       |
| J5 切红涨绿跌               | `user_preferences.finance_color_mode`                                           |

Stage 2+ 前瞻预留：

- `price_snapshots`（J7 Daily Snapshot 需要"昨日价格"对比）
- `portfolio_value_snapshots`（J7 Daily Snapshot + J13 多时间段图表 + J14 TWR 需要历史总市值序列）

---

## Schema 总览

7 张 public 表 + 5 个 enum + 3 个 trigger + 18 个 RLS policies。

```
auth.users (Supabase 内置)
  │
  ├─→ portfolios (user_id FK, ON DELETE CASCADE)
  │     │
  │     └─→ transactions (portfolio_id FK)
  │              │
  │              └─→ assets (asset_id FK, ON DELETE RESTRICT)
  │     │
  │     └─→ portfolio_value_snapshots (portfolio_id FK, Stage 2+)
  │
  └─→ user_preferences (user_id PK = auth.users.id)

assets (公开读，service_role 写)
  └─→ price_snapshots (asset_id FK, 公开读)

fx_rates (公开读，无 FK)
```

详细字段规约见 `packages/db/src/schema/*.ts`（每个文件含完整 JSDoc）。

---

## 关键决策

### 1. Decimal 字段精度：`numeric(28, 12)`

- 28 位总精度覆盖加密货币的 satoshi 精度（0.00000001 BTC ≈ $0.0007）
- 12 位小数足以表达任何主流市场最小份额单位
- 应用层用 `decimal.js` 包装；Drizzle/Supabase JS 返回 string，禁止 `parseFloat`

### 2. Asset ID 不可变 + 格式 check 约束

- Primary key `text`，格式 `{market}:{symbol}`（如 `US:AAPL`、`CN:600519`）
- 数据库层 CHECK 约束：`id ~ '^[A-Z]+:.+$'` 且 `id = market || ':' || symbol`
- 任何"修正"通过新增 `transaction_type='ADJUSTMENT'` 抵消，不动 asset 表

### 3. 触发器自动创建用户态记录

- `on_auth_user_created`（auth.users INSERT after）→ 自动建：
  - `user_preferences` 默认行（CNY/zh/greenUpRedDown/redacted=false）
  - `portfolios` 默认 "My Portfolio"（CNY 报告币种）
- 用户 J1 完成 magic link 即看到空组合，无需 UI 显式建立

### 4. RLS 三档可见性

- **Owner-only** (`portfolios`、`transactions`、`user_preferences`、`portfolio_value_snapshots`)：`(select auth.uid()) = user_id` 或经 portfolio 关联
- **公开读 + service_role 写** (`assets`、`price_snapshots`、`fx_rates`)：所有 authenticated/anon 可读，仅 cron / adapter 后端写入
- 关键：`(select auth.uid())` 写法（`SELECT` 子查询）让 PostgreSQL planner 可以缓存 uid，比 `auth.uid() = user_id` 在 row-by-row 评估时快得多（[Supabase RLS 性能指南](https://supabase.com/docs/guides/database/postgres/row-level-security#use-select-subqueries)）

### 5. SECURITY DEFINER 函数加锁

- `handle_new_user()` 是 SECURITY DEFINER（需要绕过 RLS 写 user_preferences/portfolios）
- 必须 `REVOKE EXECUTE FROM anon, authenticated, public`，否则 PostgREST `/rpc/handle_new_user` 暴露给外部 = 提权漏洞

### 6. 索引策略

- 复合索引覆盖最常见 query：`(portfolio_id, trade_date)`（按组合查交易历史）、`(portfolio_id, asset_id)`（按资产聚合）
- FK 单列索引：`asset_id` 单独索引（覆盖 ON DELETE RESTRICT 验证 + 资产详情聚合）
- 时间倒序索引：`as_of DESC`（拉"最新价"）
- Stage 1 空表时 advisor 报 unused-index INFO（预期，有数据后消失）

---

## 已经做的（Done）

- [x] 7 张表 schema TypeScript 定义（`packages/db/src/schema/*.ts`）
- [x] Drizzle migration 生成（`packages/db/drizzle/migrations/0000_steep_human_torch.sql`）
- [x] 3 个 Supabase migration 应用：
  - `init_core_tables` — 7 张表 + 5 enum + 索引 + CHECK 约束
  - `add_auth_fks_rls_and_triggers` — auth.users FK + RLS policies + updated_at + handle_new_user trigger
  - `harden_security_and_perf` — REVOKE handle_new_user + asset_id 单列索引
- [x] `@supabase/supabase-js` client 工厂（`packages/db/src/client.ts`）
- [x] `.env.example` 模板（含 publishable key + DATABASE_URL 模板）
- [x] Advisors check：security 0 issues、performance 仅空表 unused-index INFO
- [x] `pnpm --filter @arc/db typecheck` 通过

---

## TODO（依赖此 spec 的下游工作）

- [ ] **首次连接验证**：apps/mobile 引入 `@arc/db`，用真实 anon key 完成一次 `client.from('user_preferences').select()` 调用，确认 RLS 返回空数组（未登录态）→ 返回自己行（登录后）
- [ ] **Trigger 验收**：用 magic link 注册一个测试账号 → 验证 `portfolios` + `user_preferences` 自动出现 1 行
- [ ] **JS 与 Decimal 边界**：写一个 utility 把 supabase-js 返回的 string `numeric` 字段自动包装为 `Decimal`（避免业务代码忘记 → P0 bug）
- [ ] **Drizzle 二次校验**：当 schema 变化时，先 `pnpm --filter @arc/db generate` 出新 migration，再用 MCP `apply_migration` 应用（不直接 `drizzle-kit push`）

---

## 验证（如何测端到端）

```bash
# 1. typecheck schema
pnpm --filter @arc/db typecheck

# 2. 重新生成 migration（确认无 schema 漂移）
pnpm --filter @arc/db generate
# 预期：no changes detected

# 3. 在 mobile app 中用真实 anon key 测查询
# apps/mobile/app/_layout.tsx 临时加：
# const sb = createSupabaseClient({ url, anonKey });
# console.log(await sb.from('assets').select('*'));
# 预期：返回 []（assets 是空的，公开可读）+ 无 RLS 错误

# 4. trigger 测试（在 Supabase Dashboard 或 SQL Editor）
# INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'test@arc.dev');
# 预期：portfolios + user_preferences 各自出现 1 行
```

---

## 不在本 spec 范围

- Auth UI 流程（J1 magic link 实现）→ 见后续 `auth-magic-link.md` spec
- 数据源 adapter（写 price_snapshots / fx_rates 的实现）→ 见后续 `data-source-adapters-stage-1.md` spec
- 业务页面（J2-J5 UI）→ 见后续各页面 spec
