# Feature: Auth — Magic Link (Stage 1 step 2)

- **Status**: Done (code) / Pending user action (Supabase Dashboard URL config)
- **Author**: BoyangJiao + Claude
- **Created**: 2026-05-14
- **Implements**: user-journeys J1（首次注册并登录）、IA v2.2 §四 `/sign-in` & `/me`
- **Conforms to**: `.specify/constitution.md`、ADR 003 v3.1（业务消费 Foundation 名）

---

## Why

Stage 1 J1 验收要求：用户首次打开 Arc → 输入邮箱 → 收链接 → 点链接 → 进入 Portfolio Tab，**全程无密码**。Supabase Auth 的 `signInWithOtp` + PKCE flow 是这套流程的最简实现。

Stage 1 J3 / J4 / J5 都依赖"已登录用户"才能展示 / 切换 user_preferences。所以 J1 是 J3-J5 的硬前置。

---

## 设计

### Auth flow（PKCE + Deep link）

```
1. /sign-in (email input)
       │
       │ signInWithOtp({ email, emailRedirectTo: arc://auth/callback })
       ▼
2. Supabase 邮件包含一个长 URL：
   https://<project>.supabase.co/auth/v1/verify?token=...&redirect_to=arc://auth/callback
       │
       │ 用户点击 → 服务端验证 token → 302 redirect to arc://auth/callback?code=xyz
       ▼
3. iOS / Android 注册了 scheme `arc`（app.json），系统调起 Arc app
       │
       ▼
4. /auth/callback 解析 ?code=xyz
       │
       │ supabase.auth.exchangeCodeForSession(code)
       ▼
5. supabase JS SDK 写 session 到 AsyncStorage + 触发 onAuthStateChange
       │
       ▼
6. AuthProvider state.session 由 null → Session
       │
       ▼
7. _layout.tsx 守卫看到 session → router.replace("/")
       │
       │ + 后端 trigger on_auth_user_created 自动建：
       │   - user_preferences 默认行
       │   - portfolios "My Portfolio"
       ▼
8. Portfolio Tab 出现，列表已含默认组合（J1 验收完成）
```

### Provider 嵌套（\_layout.tsx）

```
GestureHandlerRootView
  SafeAreaProvider
    HeroUINativeProvider
      AuthProvider                           ← 注入 Supabase session
        AppShell（useAuth + useUserPreferences）
          BusinessTokensProvider mode={prefs.financeColorMode ?? default}
            <Stack />
```

`AppShell` 内部 useEffect 跑 redirect 逻辑：未登录 + 不在 auth 子树 → `/sign-in`；已登录 + 在 auth 子树 → `/`。

### Expo Go vs 真机的 deep link 差异

| 环境             | redirectTo                             |
| :--------------- | :------------------------------------- |
| Expo Go（开发）  | `exp://<lan-ip>:8081/--/auth/callback` |
| Standalone build | `arc://auth/callback`                  |

`expo-linking` 的 `Linking.createURL("/auth/callback")` 自动按环境产生正确 URL，业务代码无需判断。

---

## 已完成

### 代码

| 文件                                      | 角色                                                                                    |
| :---------------------------------------- | :-------------------------------------------------------------------------------------- |
| `apps/mobile/src/lib/supabase.ts`         | Singleton SupabaseClient — AsyncStorage adapter + PKCE flow                             |
| `apps/mobile/src/lib/auth.tsx`            | `AuthProvider` + `useAuth()` (session / user / loading / signInWithMagicLink / signOut) |
| `apps/mobile/src/lib/user-preferences.ts` | `useUserPreferences()` 读 + 增量 update（snake_case → camelCase 转换）                  |
| `apps/mobile/app/sign-in.tsx`             | 邮箱输入 + 状态机（idle / sending / sent / error）+ resend                              |
| `apps/mobile/app/auth/callback.tsx`       | PKCE code → session 交换 + 错误反馈                                                     |
| `apps/mobile/app/_layout.tsx`             | Provider 嵌套 + 路由守卫 + Business token mode 接入                                     |
| `apps/mobile/app/index.tsx`               | 临时 Home：邮箱显示 + PnL token 视觉验证 + 退出登录                                     |
| `packages/i18n/src/locales/{zh,en}.ts`    | `auth.*` 文案 keys                                                                      |

### 依赖

- `@react-native-async-storage/async-storage@2.2.0` — Supabase JS 在 RN 的 session 存储
- `@supabase/supabase-js@^2.105.2` — 直接 dep（虽然 @arc/db 有，但 mobile 自己 import 类型也需直接）
- `@arc/db` workspace dep — 后续业务查询用
- `@arc/core` workspace dep — 类型（Currency / Locale / FinanceColorMode）

### 验证

- `pnpm typecheck`：6/6 workspaces clean
- typed-routes 缓存 `.expo/types/router.d.ts` 删除（expo dev server 启动时会重生）

---

## ⚠️ 你需要做的 2 件事

### 1. 创建 `apps/mobile/.env`（必做）

`.env.example` 已就位，复制并填值：

```bash
cd apps/mobile
cp ../../.env.example .env
```

然后编辑 `apps/mobile/.env`，至少填这两条（其它先留空）：

```
EXPO_PUBLIC_SUPABASE_URL=https://jdvlzkictwinkgcvgwew.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_cG746MCNKBNw715WdnBSrg_lz8J5R2F
```

> 注意：`.env` 在 `.gitignore` 中。**EXPO*PUBLIC*** 前缀的变量会被打进客户端 bundle —— 这两个 key 都是「公开」的（Supabase RLS 保护），不是 secret，可以放 EXPO*PUBLIC*。
> service*role key 绝对不能用 EXPO_PUBLIC* 前缀，那是 server-only 用，目前 Stage 1 不需要。

### 2. 在 Supabase Dashboard 配置 Redirect URLs（必做）

打开 https://supabase.com/dashboard/project/jdvlzkictwinkgcvgwew/auth/url-configuration

**Site URL**：保持默认（或填 `http://localhost:8081`）

**Redirect URLs**（点 Add URL，**逐条**加）：

```
arc://auth/callback                                   ← 真机 / standalone build
arc://**                                              ← 兜底通配，避免 deep link path 调整时漏配
exp://**/--/auth/callback                             ← Expo Go 本地开发（IP 会变）
exp://**/auth/callback                                ← Expo Go 备用格式
http://localhost:8081/auth/callback                   ← Web 开发
https://localhost:8081/auth/callback                  ← Web 开发（HTTPS）
```

通配 `**` 在 Supabase 的 redirect URL 校验里支持 path-segment 匹配；这样不用每次 LAN IP 变了就改配置。

不配的话：用户点邮件链接，Supabase 会拒绝 redirect_to 参数 → 返回错误页 → 没法回到 app。

### 3. （可选）邮件模板本地化

默认英文模板对中国用户不友好。建议在 https://supabase.com/dashboard/project/jdvlzkictwinkgcvgwew/auth/templates 改 "Magic Link" 模板：

```html
<h2>登录循迹</h2>
<p>点击下方链接完成登录：</p>
<p><a href="{{ .ConfirmationURL }}">登录 Arc</a></p>
<p>如果你没有请求登录链接，可以忽略此邮件。</p>
```

这条不必要，Stage 1 自用阶段英文也行。

---

## 验证步骤（端到端）

完成上面"你需要做的 2 件事"之后：

```bash
# 1. 确保 mobile 重启吃到新 env
cd apps/mobile
pnpm start --clear

# 2. Expo Go 中：
#   - 进入 app → 应自动重定向到 /sign-in（你目前的视觉验证 home 会被替换）
#   - 输入邮箱 → tap "发送登录链接"
#   - UI flip 到 "请检查邮箱"
#   - 邮箱客户端打开 → 点链接
#   - 系统提示"在 Expo Go 中打开"→ 同意
#   - app 进入 /auth/callback → "正在验证登录…"
#   - 几百 ms 后 → 自动回到 / (Portfolio Tab)
#   - 顶部 PnL Preview 卡片 → 验证 Business token 颜色（gain 绿、loss 红，默认 mode）
#   - tap 底部 "退出登录" → 自动回 /sign-in

# 3. 数据库验证（Supabase Dashboard SQL editor 或 MCP）
SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC LIMIT 1;
SELECT * FROM portfolios WHERE user_id = '<your-user-id>';
SELECT * FROM user_preferences WHERE user_id = '<your-user-id>';
# 预期：
#   - auth.users 多一行你刚才登录的邮箱
#   - portfolios 自动有一行 "My Portfolio" / CNY
#   - user_preferences 自动有一行（CNY / zh / greenUpRedDown / redacted=false）
```

---

## 已知问题 / 限制

1. **TextInput 是裸 RN 控件，不是 HeroUI 的 `<TextField>` —— Stage 1 step 4 替换**
   - 当前 placeholder 颜色靠系统默认（无 token），样式略简陋
   - 不影响功能；只是视觉粗糙

2. **`.expo/types/router.d.ts` 的 typed routes 缓存陷阱**
   - 删了一次让 expo 重生
   - 如果未来加新路由后 typecheck 报 `'/foo'` not assignable to Href，再删一次就好

3. **首次启动 → 强制 sign-in，不能"先看 demo"**
   - 这是 Stage 1 自用阶段的合理选择；Stage 2 加欢迎屏后会缓和这个体验

4. **没接 deep link 错误处理边界态**
   - 用户在不同设备打开邮件链接（如桌面浏览器 → 没装 app）会失败
   - Stage 4 上架前 polish

---

## 不在本 step 范围

- 真实"5 个 Stage 1 页面"实现 → Stage 1 step 4
- HeroUI `<TextField>` 替换裸 TextInput → Stage 1 step 4
- Settings 页 J3-J5 切换 UI → Stage 1 step 4（hooks 已就位，UI 待画）
- Web 端 deep link（universal links / app links）→ Stage 4
- 多端会话同步 / 多设备登出 → 用 Supabase 默认行为，无定制
