# Arc 信息架构（Information Architecture）

- **状态**: 初稿（待 review）
- **更新日期**: 2026-05-07
- **作者**: BoyangJiao + Claude
- **范围**: Stage 1（MVP-0 端到端骨架）的完整页面树 + Stage 2 规划展望
- **配套**: `docs/user-journeys.md`（流程视角），`docs/adr/002-ui-library-decision.md`（UI 实现），`docs/adr/003-design-tokens.md`（视觉语言）

---

## 一、设计原则

1. **金融工具不是社交 app** — "首页"= 数据视图（持仓 / 配置），不是 dashboard 卡片墙
2. **数据流优先于 UI 美观** — 所有跳转都基于"我现在要看什么数据 / 录什么数据"
3. **最少跳转触达核心数据** — 任何持仓数字 ≤ 2 次点击可见
4. **Tab + Stack 模式** — 三个底部 Tab 是稳定锚点；详情/编辑用 Stack 入栈
5. **写入操作用 Modal/Sheet** — 录入、编辑表单不污染主导航栈

---

## 二、Stage 1 页面树（MVP-0）

```
Public（未登录）
└─ /sign-in                              ← 邮箱 + magic link

Authenticated（登录后）
├─ /(tabs)/index                         ← Portfolio list（也是首页）
│  └─ → /portfolio/[id]                   ← Portfolio detail（持仓表 + 总市值）
│        └─ → /portfolio/[id]/transactions/new  ← Add transaction（Modal/Sheet）
│
└─ /(tabs)/settings                      ← Settings（语言 / 报告货币）
```

**Stage 1 总计：5 个页面 + 1 个 Modal**，与 `docs/development-plan.md` Stage 1 任务清单一一对应。

### 路由规范

| 路径 | 文件（Expo Router） | 类型 | 说明 |
|:---|:---|:---|:---|
| `/sign-in` | `app/sign-in.tsx` | Screen | 公开，登录前唯一入口 |
| `/(tabs)/index` | `app/(tabs)/index.tsx` | Tab Screen | 默认首页 = Portfolio list |
| `/(tabs)/settings` | `app/(tabs)/settings.tsx` | Tab Screen | 语言 / 报告货币 / 主题 |
| `/portfolio/[id]` | `app/portfolio/[id]/index.tsx` | Stack Screen | 单个组合详情 |
| `/portfolio/[id]/transactions/new` | `app/portfolio/[id]/transactions/new.tsx` | Modal | 录入交易 |

### 导航约束

- **底部 Tab 始终可见**（除 `/sign-in` 外）：`Portfolio`（首页）, `Settings`
- **Portfolio detail 入栈**，不切 Tab 高亮
- **Add transaction** 为 Modal（iOS sheet / Android bottom sheet），关闭返回 Portfolio detail
- **未登录访问 Authenticated 路由** → 自动重定向到 `/sign-in`

---

## 三、Stage 1 各页面数据契约

### 3.1 `/sign-in`
- **输入**：用户邮箱
- **写入**：触发 Supabase Auth magic link 发送
- **跳转**：发送成功 → 提示"检查邮箱"；点链接回调 → `/(tabs)/index`
- **数据依赖**：无（纯前端表单 + Auth API）

### 3.2 `/(tabs)/index` — Portfolio list
- **输入**：当前用户 ID（Auth context）
- **读取**：用户的 portfolio 列表（Supabase RLS 自动过滤）
  - Stage 1：通常只有 1 个默认 portfolio（首次登录自动创建）
  - Stage 2：支持多组合
- **每行展示**：portfolio 名 + 总市值（按用户报告货币换算）+ 今日变动
- **空状态**：自动创建默认 portfolio，引导用户添加第一笔交易
- **跳转**：tap row → `/portfolio/[id]`

### 3.3 `/portfolio/[id]` — Portfolio detail
- **输入**：portfolio ID（路由参数）
- **读取**：
  - portfolio 元数据（名、报告货币）
  - holdings：`computeHoldings(transactions where portfolio_id = id)`
  - 当前价格：每个 holding 的 asset 通过 `PriceAdapter.fetchLatest(symbol)` 获取
  - 汇率：每个非报告货币的 holding 通过 `FxAdapter.getRate(from, to)` 获取
  - 总市值：`computeMarketValue(holdings, prices, fx, reportingCurrency)`
- **展示**：
  - 顶部：总市值（报告货币）+ 价格延迟说明
  - 持仓表：每行 asset 名 + 数量 + 原始币种价 + 报告币种价 + 市值
- **跳转**：右上 `+` → `/portfolio/[id]/transactions/new`
- **MVP 简化**：暂不做 asset 详情子页（Stage 2 加）

### 3.4 `/portfolio/[id]/transactions/new` — Add transaction (Modal)
- **输入**：portfolio ID（路由参数）
- **表单字段**：
  - asset 搜索 / 选择（市场 + symbol）—— Stage 1 仅支持 Alpha Vantage 美股
  - 交易类型（buy / sell）—— Stage 1 仅 buy
  - 日期 + 时区
  - 数量（Decimal，禁用 number）
  - 单价（Decimal，原始币种）
  - 手续费（可选，Decimal）
- **写入**：插入 `transaction` 表
- **关闭**：返回 `/portfolio/[id]`，列表自动刷新（TanStack Query invalidate）

### 3.5 `/(tabs)/settings` — Settings
- **读取**：当前用户偏好（reporting_currency, locale）
- **可改**：
  - 报告货币：CNY / USD（Stage 1 仅这两个）
  - 语言：中 / 英
  - 红涨绿跌切换（基础设施已就位，UI 开关 Stage 1 上线）
- **写入**：更新 `user_preferences` 表
- **副作用**：所有页面立即重渲染（i18n / 货币换算）

---

## 四、Stage 2+ 规划（仅供前瞻，Stage 1 不实施）

> 列出来的目的是：**Stage 1 的 IA 不能堵死 Stage 2 的扩展路径**。所有当前选择都需经得起以下扩展。

### 增加的页面

```
Authenticated
├─ /(tabs)/index                         ← Portfolio summary（多组合汇总）
├─ /(tabs)/rebalance                     ← 跨组合再平衡总览（or per-portfolio）
├─ /(tabs)/watchlist                     ← 关注列表（P1）
├─ /(tabs)/settings                      ← Settings（扩展更多偏好）
│
├─ /portfolio/new                        ← 新建组合
├─ /portfolio/[id]/index                 ← 组合详情（含配置环形图 + 持仓表）
├─ /portfolio/[id]/allocation            ← 目标配置编辑
├─ /portfolio/[id]/rebalance             ← 该组合再平衡视图
├─ /portfolio/[id]/asset/[assetId]       ← 资产详情（历史持仓 + 交易记录 + TWR）
├─ /portfolio/[id]/transactions          ← 交易记录列表
├─ /portfolio/[id]/transactions/new      ← 录入交易（仍 Modal）
├─ /portfolio/[id]/csv-import            ← CSV 导入向导（P0）
└─ /portfolio/[id]/csv-export            ← CSV 导出（P0）
```

### Stage 1 决策对 Stage 2 的兼容性自检

| Stage 1 选择 | Stage 2 影响 | 是否兼容 |
|:---|:---|:---:|
| 默认 1 个 portfolio | 多组合时此 1 个变成"默认组合"，列表自然支持 | ✅ |
| 仅美股 + USD/CNY | adapter 接口已抽象，加新市场只是新 adapter | ✅ |
| 仅 buy 交易类型 | transaction 表预留 `type` 字段，加 sell/dividend/split 即可 | ✅ |
| 无 asset 详情页 | 持仓表 row tap 当前 no-op，Stage 2 改为跳详情 | ✅ |
| 无图表 | Portfolio detail 顶部预留区域，Stage 2 加配置环形图 | ✅ |
| 无 i18n key 前缀 | 所有 key 已用 `domain.feature.field` 三段式（见 `packages/i18n/src/locales/`） | ✅ |

---

## 五、不在 Stage 1 / 2 范围（明确推迟）

| 功能 | 推迟到 | 理由 |
|:---|:---|:---|
| 用户引导 onboarding | Stage 3 | MVP 自用不需要新手引导 |
| 注册（独立 register 页）| 永久放弃 | Magic link 注册 + 登录合一 |
| 用户资料 / 头像 | V1.0 之后 | 个人金融工具不需要社交属性 |
| 找回密码 | 永久放弃 | 无密码体系，magic link 即恢复 |
| 推送通知配置 | Stage 2 P1 | 价格异动提醒功能上线时一并加 |
| 多用户 / 共享组合 | V2.0 | 个人工具，多用户是新形态 |
| AI 分析助手 | V1.0 P1 | 见 `development-plan.md` Stage 4 |

---

## 六、移动端导航结构图

```
┌──────────────────────────────────────────────┐
│  iOS / Android                              │
│  ┌────────────────────────────────────────┐ │
│  │  [Stack Header — 当前页标题 + 返回]    │ │
│  ├────────────────────────────────────────┤ │
│  │                                        │ │
│  │      Active Screen Content             │ │
│  │      （Portfolio list / Detail / ...） │ │
│  │                                        │ │
│  │      Modal: /transactions/new          │ │
│  │      （以 sheet 形式从下方滑入）       │ │
│  │                                        │ │
│  ├────────────────────────────────────────┤ │
│  │  [Tab Bar]  📊 Portfolio  ⚙️ Settings  │ │
│  └────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

**Web 端**：
- 同一份代码（react-native-web 渲染）
- Tab Bar 在大屏（≥768px）下置左成 Sidebar，小屏保持底部
- Modal 在 Web 上变成居中浮层

---

## 七、未决问题（待 review 时讨论）

- [ ] Stage 1 的"默认 portfolio"叫什么？（建议：用户邮箱前缀 + "Portfolio"，如 `Boyang's Portfolio`）
- [ ] 是否需要 Tab Bar 上加红点提示（Stage 1 应该不需要）
- [ ] Portfolio detail 是否需要"今日变动"指标（Stage 1 简化：只显示总市值，今日变动推到 Stage 2）
- [ ] Settings 里"红涨绿跌切换"开关 Stage 1 是否上线（建议上线，token 系统已支持，UI 开关零成本）
