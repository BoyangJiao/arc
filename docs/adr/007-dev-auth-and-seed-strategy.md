# ADR 007 — 开发期 Auth 持久化与种子数据策略

- **状态**: 已接受
- **日期**: 2026-05-15
- **作者**: BoyangJiao + Claude (Opus 4.7)
- **相关 ADR**: 001（Tech Stack — Supabase Auth），CLAUDE.md §三（工程铁律）
- **触发**: Stage 1 step 4 审计发现 `EXPO_PUBLIC_DEV_BYPASS_AUTH` + 前端 `dev-seed.ts` 注入 mock 数据的组合，**绕过了 auth + hooks + adapter 三层真实链路**，直接导致 `usePrice` / `useFxRate` / `computeMarketValue` 在 step 4 完全未被调用，Stage 1 DoD S1-AC-2/3 被 mock 数据掩盖未达成而长期未被发现。

---

## 背景

Step 4 开发期间，为了避开"每次冷启动都要收 OTP 验证码 → 复制粘贴"的摩擦，Qoder 引入了两个机制：

1. **`EXPO_PUBLIC_DEV_BYPASS_AUTH=true`**：在 [auth.tsx](../../apps/mobile/src/lib/auth.tsx) 中直接注入 `DEV_MOCK_SESSION` + `DEV_MOCK_USER`（`id: "dev-user-bypass"`，不是 UUID），所有 `signInWith*` / `signOut` / `getSession` 短路返回 null error。
2. **前端 hooks 内 `if (DEV_BYPASS) return DEV_PORTFOLIOS`**：在 [dev-seed.ts](../../apps/mobile/src/lib/queries/dev-seed.ts) 写死 1 个 mock portfolio + 3 笔交易（AAPL/MSFT/NVDA），在 `usePortfolios` / `useTransactions` 里短路返回 mock。

**实际后果**（step 4 审计发现）：

- 数据流被劫持在 hook 入口，**根本没机会走到** `usePrice` / `useFxRate` / `computeMarketValue`
- Portfolio Tab / Portfolio Detail 直接拿 mock 的 `averageCost` 当"市值"展示，**报告货币切换只换符号不换数字**，但因为 mock 数据本身就是 USD 计价、用户也是切 USD↔CNY，肉眼难以察觉错误
- ESLint / typecheck 都不会捕获这种"链路断开" — 这是 mock 在掩盖真实问题
- 真实 Supabase RLS / token refresh / adapter cache / API 限额行为在 dev 期间从未被验证

**Supabase 默认行为重新评估**：

- access_token 默认 1h，自动 refresh
- refresh_token 默认 7 天（dashboard 可调到最长 60 天）
- [supabase.ts](../../apps/mobile/src/lib/supabase.ts) 已正确配置 `storage: AsyncStorage` + `autoRefreshToken: true` + `persistSession: true` + `flowType: "pkce"`
- **即真实 auth 登录一次后，dev 期间冷启动 SDK 会自动从 AsyncStorage 恢复 session，不需要重新输验证码**

也就是说"每次都要收验证码"这个痛点的真实根因不是 Supabase 太严格，**是 DEV_BYPASS_AUTH 让真实持久化路径根本没被走过**。

---

## 决策

### 决策一：删除一切"链路绕过"型 dev 开关

`EXPO_PUBLIC_DEV_BYPASS_AUTH` 及其在以下文件中的所有引用全部删除：

- `apps/mobile/src/lib/auth.tsx` — `DEV_BYPASS_AUTH` / `DEV_MOCK_USER` / `DEV_MOCK_SESSION` 及所有 `if (DEV_BYPASS_AUTH)` 短路分支
- `apps/mobile/src/lib/queries/use-portfolios.ts` — `if (DEV_BYPASS)` 分支 + `DEV_PORTFOLIOS` import
- `apps/mobile/src/lib/queries/use-transactions.ts` — `if (DEV_BYPASS)` 分支 + `DEV_TRANSACTIONS` import
- `apps/mobile/src/lib/queries/dev-seed.ts` — **整个文件删除**

理由：DEV 开关本身不是问题，问题是这一类**跳过业务链路环节**的开关——`auth` / `hooks` / `adapter` / `compute*` 任何一段被短路，问题就被掩盖。区别于"减少步骤"的开关（自动填邮箱、加长 token 寿命），后者只优化交互不绕过业务，是允许的。

### 决策二：dev 期间登录持久化靠 Supabase 默认行为 + 拉长 refresh token

工作流：

1. 第一次启动 dev 环境，用真实邮箱走 OTP 流程登录（30 秒）
2. 之后冷启动 / Metro 重启 / 切分支 / 重启 Expo Go：**SDK 从 AsyncStorage 恢复 session，直接进 app，不需要重新输验证码**
3. refresh token 在到期前自动续。只要至少每隔 N 天打开一次 app，session 永不过期

**Supabase dev project 配置调整**（一次性，仅 dev project，prod 保持默认）：

- Dashboard → Authentication → Sessions → `Refresh Token Reuse Interval`: 保持默认（10s）
- Dashboard → Authentication → Sessions → `JWT expiry`: access_token 维持 1h
- Dashboard → Authentication → Policies → `Refresh token absolute lifetime`: **dev project 拉到 60 天**（默认 7 天，最大 60 天）

### 决策三：dev 种子数据从"前端 mock"改为"后端 SQL 注入"，且**可在任意环境重建**

新增 [`tools/seed-dev-data.ts`](../../tools/seed-dev-data.ts)（待建），通过 Supabase **service role key** 直接向真实 Supabase dev project 写入：

- 当前 dev user（命令行参数指定邮箱）名下一个 `My Portfolio`
- 3 笔历史 transaction（AAPL/MSFT/NVDA），日期跨 3 个月（确保历史价格 + 历史汇率链可被真实验证）
- 模式：`--mode reset`（清空后重写，幂等）/ `--mode append`（增量）

执行：`pnpm seed:dev --email dev@arc.local --mode reset`

**可移植性设计**（应对未来换开发机 / 云端开发环境）：

1. **配置不依赖本机 keychain / macOS-only 路径** —— service role key 读取自 `apps/mobile/.env.dev.local`（gitignored），同时提供 `apps/mobile/.env.dev.example` 作为模板入仓，写明每个变量从 Supabase Dashboard 的哪条路径取
2. **配置过程文档化** —— 在 [docs/development-plan.md](../development-plan.md) 末增「Dev 环境自举（任意机器/任意时刻）」章节，按 8 步可复现：
   1. clone repo
   2. `pnpm install`
   3. `cp apps/mobile/.env.example apps/mobile/.env` + 填 anon key
   4. `cp apps/mobile/.env.dev.example apps/mobile/.env.dev.local` + 填 service role key
   5. `pnpm --filter @arc/db push`（同步 schema）
   6. `pnpm dev`（启 Metro / Expo）
   7. 用真实邮箱 OTP 登录一次
   8. `pnpm seed:dev --email <自己的邮箱>` 注入种子数据
3. **种子脚本本身是声明式的** —— 写在 TS 而非 SQL，便于在云端 dev container / GitHub Codespaces / 别人电脑上都能 run。**禁止**依赖本机 fixture 文件、剪贴板、本地数据库 dump
4. **service role key 安全防线**：
   - `.env.dev.example` 列出变量名 + 来源路径，不含 value
   - 种子脚本启动时校验 `SUPABASE_URL` 不含 `prod`/`production` 字符串；任何 prod-like URL 直接 abort
   - pre-commit hook 增加正则检测：`service_role.*=.*eyJ`（JWT 头）— 防止 service role key 误入仓

**关键差异 vs 旧 dev-seed**：

- 数据真实进入 Supabase `transactions` 表，受 RLS 约束
- 业务 hooks（`useTransactions` 等）走真实 Supabase 查询，触发真实 React Query 缓存行为
- `computeHoldings` → `usePrice`（Alpha Vantage 真请求）→ `useFxRate`（Frankfurter 真请求）→ `computeMarketValue` 全链路真实跑通
- 任何一段没接通都会立刻显示错数据，**不会再被 mock 帮忙掩盖**
- 换开发环境时**总成本 < 5 分钟**：填两个 env file + 跑两条命令

### 决策三补 — 防止 Supabase Free Tier 项目不活跃回收

**问题**：Supabase 免费层在项目无任何活动 **7 天**后自动 pause（保留 90 天数据，可手动 unpause）；连续不活跃 90 天后**可能被回收**。Dev 阶段 6-12h/周开发节奏 + 偶尔休假，触发风险真实存在。

**防护方案 — 双重 heartbeat**：

1. **GitHub Actions 周 cron**（推荐主方案）—— `.github/workflows/supabase-heartbeat.yml`：

   ```yaml
   on:
     schedule:
       - cron: "0 9 * * 1" # 每周一 09:00 UTC
     workflow_dispatch: # 手动触发
   jobs:
     ping:
       runs-on: ubuntu-latest
       steps:
         - name: Heartbeat query
           env:
             URL: ${{ secrets.SUPABASE_DEV_URL }}
             KEY: ${{ secrets.SUPABASE_DEV_ANON_KEY }}
           run: |
             curl -fsS -H "apikey: $KEY" "$URL/rest/v1/portfolios?select=id&limit=1" > /dev/null
             echo "Heartbeat OK at $(date -u)"
   ```

   - 用 anon key 而非 service role（最小权限；ping 一行就够触发 Supabase 的活跃计数）
   - 周一早 9 点 UTC = 北京周一傍晚，每周第一个工作日前续活
   - 同样配置一个**月度 self-test workflow**：跑 `pnpm seed:dev --mode reset` + 一组 smoke test 验证 seed 链路本身没坏

2. **后备方案 — 手动 unpause 流程文档化**：万一 heartbeat workflow 自身挂了 / repo 转私不再 free tier 触发 GH Actions / Supabase 真把项目 pause 了，[docs/development-plan.md](../development-plan.md) 新增「Supabase 项目复活」章节说明：去 Dashboard → Project → Restore，等 1-3 分钟即可。**不会丢数据**（90 天内）

**为什么不依赖 pg_cron**：pg_cron 是 Supabase 内部的 scheduled job，**项目本身被 pause 后就不会执行** —— 用它续活 = 死锁。**必须是外部 ping**。

**Prod project 不受此限制**：prod 是付费 tier，无 inactivity reclaim。本节策略仅 dev project。

### 决策四：减少 OTP 摩擦的允许手段（不绕过链路）

以下"减步骤"型优化允许加，互不冲突：

| 手段                                                  | 实现位置                                   | 收益                          |
| :---------------------------------------------------- | :----------------------------------------- | :---------------------------- |
| 上次登录邮箱自动填                                    | sign-in.tsx + AsyncStorage `lastUsedEmail` | 省 1 次输入                   |
| 邮箱输入自动聚焦 + autoComplete                       | sign-in.tsx                                | 省 1 次点击                   |
| 验证码 `autoComplete="one-time-code"` 已就位          | sign-in.tsx:268                            | iOS 自动从邮件读取 OTP 自动填 |
| dev project refresh token 拉到 60 天                  | Supabase Dashboard                         | 一次登录顶 60 天              |
| sign-in 页加 "Open Mail" 一键打开邮件 app（dev only） | sign-in.tsx + Linking                      | 省切 app                      |

### 决策五：将"不允许绕过业务链路"升级为工程铁律

写入 `.specify/constitution.md` 工程铁律（与"严禁 number 处理金融数值"同级）：

> **铁律 N — 真实链路不可绕过**
>
> Dev / test / preview 提效手段允许减少**操作步骤**（自动填、缓存、缩短确认弹窗），但**严禁跳过**任何业务链路环节：
>
> - Auth（认证 / 会话 / RLS）
> - Hooks（React Query / Zustand 等真实数据获取层）
> - Adapter（外部 API 调用 / cache / rate limit）
> - Compute（领域计算 — TWR / 再平衡 / FX / valuation）
>
> 一旦发现"if (DEV\_\*) return mock" 类短路代码，按违反铁律处理，必须改造为真实链路 + 真数据。
> 唯一例外：单元测试 / property-based test 内部，per-test 注入 mock 是允许的（且应在测试隔离下）。

---

## 后果

### 正面

- Stage 1 DoD S1-AC-2/3 终于能被真实验证（mock 不再掩盖 hooks 未接通）
- Supabase RLS / token refresh / adapter cache / API 限额行为在 dev 期间全程被验证
- 任何"以为接通了实际没接通"的链路缺陷在 dev 第一次手测就会暴露
- 删除了一类"看起来贴心实际埋雷"的便利开关 — 项目原则更纯粹
- 新模型/新贡献者接手时，看不到 "DEV_BYPASS 类后门" 心智成本

### 负面

- 第一次配置 dev 环境多 30s（邮箱 OTP 登录一次）
- 需要 dev 期间偶尔打开 app 续 refresh token（>60 天不开会被踢，但 dev 不开 60 天本身就反常）
- `tools/seed-dev-data.ts` 是新代码需要维护

### 风险

- service role key 若误入仓 → 任何人可绕 RLS 操作 dev DB
  - 缓解 1：放在 `.env.dev.local`（`.gitignore` 已覆盖 `.env*`），并在 pre-commit hook 增加 `service_role_key` 字面量检测
  - 缓解 2：seed 脚本读取 env var 时校验非空 + 非生产 URL；任何指向 prod URL 的 seed 调用直接 abort
- Alpha Vantage 免费层 25 calls/day — dev 反复刷可能用尽
  - 缓解：[packages/data-sources](../../packages/data-sources) 的 cache 层已就位（开盘中 60s，闭市后 24h），正常 dev 不会触顶。真到瓶颈再考虑 mock adapter（mock 在 adapter 注入点，**仍然走完整链路**，不违反决策五）

---

## 实施清单

按顺序：

1. [ ] **Supabase dev project 配置**：Dashboard 把 refresh token absolute lifetime 调到 60 天
2. [ ] **删 DEV_BYPASS 链路**：
   - `apps/mobile/src/lib/auth.tsx` 删 `DEV_BYPASS_AUTH` / mock session / mock user / 短路分支
   - `apps/mobile/src/lib/queries/use-portfolios.ts` 删 `if (DEV_BYPASS)`
   - `apps/mobile/src/lib/queries/use-transactions.ts` 删 `if (DEV_BYPASS)`
   - `apps/mobile/src/lib/queries/dev-seed.ts` **整文件删除**
3. [ ] **环境变量清理**：从 `.env.example` 删除 `EXPO_PUBLIC_DEV_BYPASS_AUTH`，从 README/AGENTS.md 删除相关说明
4. [ ] **建 seed 脚本** `tools/seed-dev-data.ts`：
   - 读取 `SUPABASE_DEV_URL` + `SUPABASE_DEV_SERVICE_ROLE_KEY`（abort if URL 含 "prod"）
   - 通过 `--email` 参数定位 dev user（Supabase Admin API `listUsers` + 邮箱过滤）
   - 写入 1 portfolio + 3 transactions（覆盖 / 增量模式由 `--mode` 控制）
   - 配套 `apps/mobile/.env.dev.example`（模板入仓）+ `apps/mobile/.env.dev.local`（gitignored）
5. [ ] **package.json 加 scripts**：`pnpm seed:dev`
6. [ ] **GitHub Actions Supabase heartbeat**（决策三补）：
   - 新增 `.github/workflows/supabase-heartbeat.yml`（周 cron + workflow_dispatch）
   - 仓库 Secrets 配置 `SUPABASE_DEV_URL` + `SUPABASE_DEV_ANON_KEY`
   - 月度 self-test workflow 跑 `pnpm seed:dev` + smoke test
7. [ ] **sign-in 减摩擦**（决策四）：
   - 上次邮箱缓存到 AsyncStorage（key `lastUsedEmail`），打开 sign-in 自动填
   - 默认聚焦邮箱输入框
8. [ ] **constitution.md 加铁律「真实链路不可绕过」**（决策五，已就位）
9. [ ] **pre-commit hook 加 service_role_key 字面量检测**：grep `service_role.*=.*eyJ`
10. [ ] **docs/development-plan.md 新增「Dev 环境自举」+「Supabase 项目复活」章节**（决策三的可移植性 + 后备方案）

---

## 关联文档更新

- `.specify/constitution.md` — 加铁律"真实链路不可绕过"
- `CLAUDE.md` §三（工程铁律）— 同步增列
- `apps/mobile/.env.example` — 删 `EXPO_PUBLIC_DEV_BYPASS_AUTH`
- `package.json` — 加 `seed:dev` script
- `docs/development-plan.md` Stage 1 / Stage 4 推荐 Skills 表 — 若引用 dev-bypass 字眼则一并清理
