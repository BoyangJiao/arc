# ADR 012 — 双区域认证与数据驻留（大陆优先、海外兼容）

- **状态**: 已接受（Opus 2026-05-25 review 完成 — 方案 A + 附录 C 6 项判定见状态变更记录）
- **日期**: 2026-05-21
- **作者**: BoyangJiao + Cursor（初稿）
- **相关 ADR**: 001（技术栈 — Supabase + RLS），007（Dev Auth 真实链路），009（Daily Snapshot — Edge Function / service_role）
- **触发**: 核心客群为中国大陆用户；当前 J1 使用 Supabase Auth（邮箱 OTP + Magic Link 备路径）出于 AI/开发友好，**不是**大陆正式上架的终态登录方式。需在 Stage 3 末、Stage 4 前冻结认证与数据驻留方向，避免账号模型与 `auth.users` 强绑定后再迁移。

---

## 背景

### 产品与用户

- **主客群**：中国大陆，跨 A股/港股/美股/基金/加密，需稳定登录与可接受的延迟。
- **次客群**：海外（亚洲、东南亚、中东等），需保持邮箱/国际化登录的顺畅体验。
- **当前 Auth**：`apps/mobile/src/lib/auth.tsx` → `supabase.auth`（OTP 主、Magic Link 备）；session 驱动全 app RLS 查询。
- **当前数据**：PostgreSQL + RLS，`user_id` 引用 `auth.users.id`；`on_auth_user_created` 触发器自动建 `portfolios` + `user_preferences`（见 `data-model-stage-1.md`，触发器在 Supabase 侧 migration，非 Drizzle 仓库内文件）。

### 为何在 Stage 3 末澄清「不晚」

| 已具备（可复用）                                   | 尚未固化（好改）                 |
| :------------------------------------------------- | :------------------------------- |
| `AuthProvider` 单点；业务 Query 只依赖 JWT session | 无微信 openid / 手机号散落业务表 |
| RLS 统一 `auth.uid()` = `user_id`                  | 无支付/会员与 auth 绑定          |
| `@arc/core` / `@arc/data-sources` 与 Auth 无关     | 未上架，无大规模账号迁移         |

若再晚 6–12 个月：账号与 Supabase `auth.users` 强绑定、境外存量用户、迁移需账号合并与 session 失效公告。

### 基础设施与合规约束（摘要，非法律意见）

- **Supabase**：境外托管（常见为 AWS 区域）；大陆访问 REST **不稳定、官方不保证**；合规关注点在 **个人信息出境 / App 备案 / 数据处理者披露**，而非「Supabase 品牌是否合法」。
- **大陆终态登录**：微信 + 手机号 + 邮箱组合；Supabase **无**原生微信登录，需自建 **Auth BFF** 或换 IdP。
- **ADR 007**：禁止 `DEV_BYPASS_AUTH` 类短路；任何新 Auth 路径必须走真实 session + RLS。

---

## 决策（提议 — 待 Opus review）

### 决策一：内部用户主键与 RLS 不变

- Arc 继续使用 **UUID `user_id`** 作为全库 owner 键（`portfolios`、`user_preferences`、`watchlist_items` 等）。
- RLS 继续 `(select auth.uid()) = user_id`（或经 `portfolios` 关联）；**JWT 的 `sub` 必须等于该 UUID**，与签发方无关。
- **不在**业务表直接存微信 openid / 手机号明文；身份绑定走独立表（决策二）。

### 决策二：分三期实施，避免一步到位迁国内云

| 阶段                               | 大陆体验                           | 基础设施                                                                                              | 目标工作量                            |
| :--------------------------------- | :--------------------------------- | :---------------------------------------------------------------------------------------------------- | :------------------------------------ |
| **P0**（当前–Stage 4 开发）        | 继续邮箱 OTP；抽 **AuthPort** 接口 | 单 Supabase dev/prod project                                                                          | 小：接口 + 本 ADR                     |
| **P1**（大陆 TestFlight / 备案前） | 微信 + 短信手机号 + 邮箱           | **Auth BFF**（国内可访问）+ BFF 用 Admin API 创建/关联 `auth.users` → 客户端仍持 **Supabase session** | 中：BFF + 登录 UI + `user_identities` |
| **P2**（监管明确要求境内落库）     | 同 P1 登录 UX                      | 阿里云 PolarDB/RDS + 函数计算等；复制 schema + RLS                                                    | 大                                    |
| **P3**（可选，用户规模驱动）       | 同 P1                              | 分库 / 同步                                                                                           | 很大                                  |

**P1 为默认推荐路径**：最小化改动现有 15+ 处 `supabase.from(...)` Query；海外用户仍可用邮箱（及后续 Apple/Google）经同一或分轨 BFF。

### 决策三：P1 新增 `user_identities` 表

```text
user_identities
  user_id          uuid  → 逻辑 FK 至 auth.users.id / Arc 主键
  provider         enum/text: wechat | phone | email | apple | ...
  provider_subject text  → openid / E.164 手机 / 邮箱等
  UNIQUE (provider, provider_subject)
```

- 注册/绑定在 **BFF** 完成（持微信/短信密钥，**不进客户端**）。
- 同一 `user_id` 可有多条 identity；**禁止**同一手机号/微信对应两个 `user_id`（BFF 负责 merge 策略，细则留给终版 spec）。

### 决策四：登录方式按区域分叉，业务 Query 不分叉

- **大陆客户端**：`AuthPort` 实现为 `CnBffAuthAdapter`（微信 SDK / 短信 UI → BFF → Supabase session）。
- **海外客户端**：`SupabaseAuthAdapter`（邮箱 OTP / Magic Link / 未来 Apple）。
- **禁止**在 `use-portfolios` 等 Query 内 `if (isChina)`；仅 **Auth + API base URL** 按 `EXPO_PUBLIC_API_REGION`（或 store 区域）分叉。

### 决策五：数据架构 — 大陆优先、海外兼容

- **P0–P1**：可共用一套 Postgres（Supabase，区域选离大陆较近者如新加坡/东京）；大陆用户经 **国内 BFF 域名** 降低 Auth 握手失败率。
- **P2 触发条件**（满足任一即启动 re-evaluate，不写死时间）：
  - 监管/备案明确要求 **核心业务数据境内存储**；
  - 大陆用户规模或个人信息出境触发 **安全评估 / 标准合同**（律师确认）；
  - Supabase 大陆可用性持续不满足 SLO（登录成功率、P95 延迟）。
- **P2 原则**：Drizzle migrations + RLS SQL **可移植**；`@arc/core` / `@arc/data-sources` **不依赖** Supabase Auth 实现。

### 决策六：P1 明确不做的范围

- 不在 P1 替换全部 `supabase-js` 为自建 REST（除非 Opus review 否决决策二、改选「自定义 JWT」方案 B）。
- 不在 P1 迁移 Edge Functions（`daily-snapshot`、`dev-seed`）到国内云（仅改 secrets/URL 若 DB 迁移）。
- 不实现 DEV 微信登录短路（ADR 007）。

---

## 方案对比（供 Opus review 拍板）

| 方案                    | 描述                                                 | 改动面           | 大陆合规       | 备注                         |
| :---------------------- | :--------------------------------------------------- | :--------------- | :------------- | :--------------------------- |
| **A（本 ADR 推荐 P1）** | BFF + Admin 建 Supabase 用户 + 标准 Supabase session | Query 层几乎不动 | 数据仍可能出境 | 最快上架                     |
| **B**                   | 自签 JWT，Postgres 配置 JWT secret                   | 中               | 同 A           | 与 Supabase Dashboard 耦合深 |
| **C（P2）**             | 国内 RDS + 去 Supabase Auth                          | 大               | 最强           | 2–3 月级                     |

Opus review 应重点裁定：**A vs B**、**P2 触发条件**、**账号合并/注销**策略是否需同步写 spec。

---

## 后果

### 正面

- Stage 4 登录与备案有明确路线图；海外路径不被大陆特例污染。
- P1 保留 RLS 与现有 TanStack Query 投资；微信/手机号可迭代上线。
- Schema 预留 `user_identities`，避免 openid 散落。

### 负面 / 成本

- P1 增加 **Auth BFF** 运维（微信开放平台、短信模板、域名备案）。
- 短期内 **双跳**（客户端 → 国内 BFF → Supabase）延迟与故障点增加。
- P2 若启动，需数据迁移与可能的双环境运维。

### 对现有文档/代码的后续动作（接受本 ADR 后）

1. 新增 `.specify/feature-specs/auth-cn-wechat-phone-email.md`（J1 验收、序列图）— **不在本 ADR 接受前写终版 spec**。
2. 实现 `AuthPort` + `SupabaseAuthAdapter`（行为与现网一致）。
3. Migration `0014_user_identities` + Drizzle schema。
4. Spike：微信测试号 → BFF `code2session` → `auth.admin.createUser` → `setSession`。

---

## 附录 A — 大陆正式上线时需调整的文件清单（P1 粒度）

### A.1 Auth 与登录 UX（必改）

| 路径                                                                   | 动作                                 |
| :--------------------------------------------------------------------- | :----------------------------------- |
| `apps/mobile/src/lib/auth.tsx`                                         | 抽 `AuthPort`；实现分轨 adapter      |
| `apps/mobile/src/lib/supabase.ts`                                      | 区域化 base URL；session 注入不变    |
| `apps/mobile/app/sign-in.tsx`                                          | 微信 / 手机号 / 邮箱多方式 UI        |
| `apps/mobile/app/auth/callback.tsx`                                    | 扩展微信等 deep link（或新路由）     |
| `apps/mobile/app/_layout.tsx`                                          | 守卫仅改 session 来源                |
| `apps/mobile/app.json`                                                 | 微信 URL Scheme、`associatedDomains` |
| **新建** `apps/mobile/src/lib/auth/*`                                  | wechat / phone-otp / session-bridge  |
| **新建** `supabase/functions/auth-bridge/` 或独立 `services/auth-bff/` | 验证 + Admin 建用户 + 下发 session   |
| `packages/i18n/src/locales/{zh,en}.ts`                                 | 登录/绑定/授权文案（遵守宪法禁忌词） |

### A.2 数据层（P1 建议）

| 路径                                                               | 动作                                                                   |
| :----------------------------------------------------------------- | :--------------------------------------------------------------------- |
| **新建** `packages/db/drizzle/migrations/0014_user_identities.sql` | 表 + RLS                                                               |
| **新建** `packages/db/src/schema/user-identities.ts`               | Drizzle                                                                |
| Supabase 侧 SQL                                                    | `handle_new_user` 与 BFF 建用户顺序对齐（或 BFF 显式初始化 portfolio） |

### A.3 直接调用 `supabase.auth`（必查）

| 路径                                               | 动作                           |
| :------------------------------------------------- | :----------------------------- |
| `apps/mobile/src/lib/dev-tools/invoke-dev-seed.ts` | 保持 `getUser()`；dev 邮箱登录 |
| `tools/seed-dev-data.ts`                           | `auth.admin.*` 仅 dev          |
| `supabase/functions/dev-seed/*`                    | prod 禁用策略保持              |

### A.4 仅依赖 session JWT、P1 通常不改

- `apps/mobile/src/lib/queries/use-*.ts`
- `apps/mobile/src/lib/user-preferences.ts`
- `apps/mobile/src/lib/dev-tools/run-*-seed-client.ts`
- `packages/data-sources/src/cache/*-cache.ts`
- `supabase/functions/daily-snapshot/index.ts`（配置级）

### A.5 文档（接受 ADR 后，非本 ADR 范围）

- `.specify/feature-specs/auth-cn-*.md`
- `docs/information-architecture.md`、`development-plan.md` J1 DoD
- 隐私政策 / ICP / 微信开放平台 / 短信服务商

### A.6 明确 P1 不改

- `packages/core/**`、`packages/data-sources/**`（adapter 层）
- `packages/ui/**`、Block C 持仓/图表 UI
- 持仓 = Σ(transactions) 等数据模型不变性

---

## 附录 B — 与「仅切换 Supabase project URL」的关系

| 场景            | 操作                                                                                                   |
| :-------------- | :----------------------------------------------------------------------------------------------------- |
| dev → prod 环境 | 仍只需 `EXPO_PUBLIC_SUPABASE_*` + EAS secrets（见 `development-plan.md` §11.1）                        |
| 大陆 P1 上线    | **额外** BFF URL、微信/短信密钥、登录 UI；Supabase 可能仍在境外                                        |
| 大陆 P2 境内库  | 换 DB 连接 + 数据迁移；若 P1 已用 BFF，客户端主要换 API base                                           |
| Local dev       | `EXPO_PUBLIC_BFF_URL` 缺省 empty → 走纯 Supabase 邮箱 OTP（P0 行为；不阻塞 P1 实施前的 dev iteration） |

---

## 附录 C — Opus review 检查清单

- [x] **P1 选方案 A（Supabase session + BFF Admin createUser）**。B 自签 JWT 与 Supabase Dashboard 耦合更深，P2 迁移难度更高
- [x] **`handle_new_user` 足够** —— `auth.admin.createUser` 触发 INSERT → trigger 仍生效；BFF 不需要显式 RPC。**Spike 必做**（附录 A 已列）
- [x] **一号多绑 / 注销策略 → 超 ADR 范围**。`auth-cn-spec.md`（A.5 列出）写：(a) 一号一绑（UNIQUE 约束已锁），(b) 注销 = soft `users.deleted_at` + 30 天后 hard delete
- [x] **弱网 BFF↔Supabase 双跳 SLO**：BFF 本地 cache 5 min + retry 3x exp backoff + batch token refresh；Implementation detail，spec 起手细化
- [x] **P2 迁移 → dual-write 共存 6-12 周过渡 → cutover**。Big-bang 风险大；JWT secret 与 `user_id` UUID 在两端保持一致，客户端短期双 endpoint 容错
- [x] **与 `constitution.md` 文案铁律交叉审查 → 通过**：登录 / 绑定 / 注销文案无投资建议禁词

---

## 状态变更记录

| 日期       | 状态   | 说明                                                                                                                                                                               |
| :--------- | :----- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-21 | 提议   | 初稿落盘，待 Opus review                                                                                                                                                           |
| 2026-05-25 | 已接受 | Opus review 完成 — 方案 A 锁，附录 C 6 项全部判定（见附录 C inline）；附录 B 加 Local dev 行；下一步 = 用户启动 BFF spike 时新立 `auth-cn-spec.md`（在本 ADR 接受后才写终版 spec） |
