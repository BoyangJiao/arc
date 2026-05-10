# Arc 信息架构（Information Architecture）

- **状态**: 已接受（v2.2）
- **更新日期**: 2026-05-10
- **版本演进**:
  - v1（已废弃）：Stage 1 仅 5 个页面，2 Tab（Portfolio / Settings）— 见 `docs/archive/`
  - v2.0（已废弃）：4 Tab（Portfolio / Markets / Insights / Me）— 见 `docs/archive/ia-redesign-proposal.md`
  - v2.1（已废弃）：3 Tab + Stage 1.5 概念 — 见 `docs/archive/`
  - **v2.2（当前）**：3 Tab，Stage 不带小数（老 1.5 升为 Stage 2，老 2/3/4 顺移成 3/4/5），Inbox 归 Me 子页（Revolut 范式），含 6 项深度优化
- **配套**: `docs/user-journeys.md`、`docs/adr/002-ui-library-decision.md`、`docs/adr/003-design-tokens.md`、`docs/adr/004-avatar-generation.md`、`docs/development-plan.md`

---

## 一、设计原则

1. **金融工具不是社交 app** — "首页" = 数据视图（持仓 / 配置 / 偏离），不是 dashboard 卡片墙
2. **数据流优先于 UI 美观** — 跳转都基于"我现在要看什么 / 录什么"
3. **最少跳转触达核心数据** — 任何持仓数字 ≤ 2 次点击可见
4. **一级导航 MVP 锁定** — 3 Tab + 顶栏头像在 Stage 1 确定，不打破用户肌肉记忆
5. **差异化集中在 Insights** — Portfolio / Markets 是同类标杆已有形态，Insights 是 Arc 护城河
6. **Tab + Stack** — 3 个 Tab 是稳定锚点；详情/编辑用 Stack 入栈
7. **写入操作用 Modal/Sheet** — 录入、编辑表单不污染主导航栈
8. **AI 是能力层，不是模块** — 全局浮在所有 Tab 之上，不占 Tab 位

---

## 二、Delta 产品 IA 调研（决策依据）

通过 7 张实拍截图（`.tempref/Home.JPEG`、`market.JPEG`、`Portfolios.PNG` 等）+ 官方 features 页面交叉验证 Delta by eToro 的 IA 形态。**完整调研结论见 `docs/archive/ia-redesign-proposal.md` §二**。

| 借鉴 | 规避 |
|:---|:---|
| 中央 FAB、多时间段切换、Markets 三级筛选、CSV 归 FAB | 底部 5 Tab 过于拥挤 → Arc 收敛到 3 Tab |
| Insights 作为差异化阵地集中数据分析 | Insights 全 PRO 付费墙 → Arc 保留核心 Rebalance 免费 |
| 左上头像作为 Me 入口（非汉堡菜单）| Delta 用汉堡 → Arc 用**渐变头像**（见 ADR 004）|
| "Why is it moving?" 上下文解读 | AI 不做独立模块 → 全局能力层 + 上下文感知 |

---

## 三、Arc 一级导航决策

### 3.1 推荐方案：3 Tab + 左上头像

```
┌────────────────────────────────────────────────┐
│  [👤 头像 = Me]                                 │  ← 顶栏：左 Me，右侧暂留空（AI 在 Stage 3+ 才上）
├────────────────────────────────────────────────┤
│                                                │
│         Active Screen Content                  │
│         （总资产大字 / 组合卡片列表）            │
│                                                │
│                              [ + FAB ]         │
├────────────────────────────────────────────────┤
│   📊 Portfolio    📈 Markets    💡 Insights    │  ← 3 Tab
└────────────────────────────────────────────────┘
```

| 元素 | 位置 | 角色 |
|:---|:---|:---|
| 3 个 Tab | 底部 | 数据型导航：Portfolio / Markets / Insights |
| 头像 Me 入口 | 顶栏左上 | 低频账户/设置类，全屏页从左滑入 |
| AI 助手图标 | 顶栏右上 | **Stage 3 才出现**；Stage 1-2 此位空（避免占位的 cheap 感）|

### 3.2 为什么 3 Tab

| 方案 | 评估 |
|:---|:---:|
| **3 Tab + 左上头像** | ✅ **推荐** |
| 4 Tab（+ Me） | ❌ Me 内容低频，占位浪费 |
| 5 Tab（对齐 Delta） | ❌ 底部拥挤；Following 在 MVP 功能轻量 |
| 3+1 独立 AI Tab | ❌ AI 应是能力层而非功能模块 |

### 3.3 三个 Tab 的职责边界

| Tab | 回答的问题 | Stage 1 内容 | Stage 2+ 扩张方向 |
|:---|:---|:---|:---|
| **Portfolio** | "我现在持有什么？值多少钱？" | 总资产 + 组合卡片列表（Stage 1 默认 1 个）+ FAB 添加 → 组合详情（持仓表）| Daily Snapshot、配置环形图、多时间段图表、今日变动、资产详情、合并视图、AI 健康度徽章 |
| **Markets** | "市场在发生什么？我关心的标的怎样？" | **Stage 1 = 空态 + 引导文案**；**Stage 2 = Watchlist** | 行情分类浏览、涨跌榜、价格提醒、"Why is it moving?"、AI 新闻摘要 |
| **Insights** | "我的决策做得好吗？要调整吗？" | **Stage 1 = 空态 + Coming soon**；**Stage 2 = Rebalance 基础版** | 收益折线图、好坏决策、风险报告、Performance attribution、Drawdown 分析、AI 组合体检 |

### 3.4 头像入口设计规范

详见 **ADR 004 — 头像生成**。要点：
- 默认头像：基于邮箱 hash 生成的**渐变椭圆**（`@dicebear/collection` 的 `gradient` 生成器，不用 `shapes`）
- 点击：从左侧滑入**全屏页面**（Stack push，`animation: 'slide_from_left'`），非抽屉
- 返回：左上角 X / 系统返回键 / 右滑手势

### 3.5 Add FAB 内容规划

FAB 仅在 **Portfolio Tab 列表页 / Portfolio detail** 显示，点击弹出添加方式 Sheet：

```
FAB [+]
└─ 添加方式 Sheet（纵向列表）
   ├─ ✍️  手动添加交易          ← Stage 1
   ├─ 📄  导入 CSV              ← Stage 2（不在 Stage 1）
   ├─ 📸  AI 截图识别导入 ✨     ← Stage 4 P0 差异化亮点
   ├─ 🏦  连接券商（只读）       ← Stage 4
   ├─ 💱  连接交易所（只读）     ← Stage 4
   └─ 👛  连接钱包              ← Stage 4
```

**"新建组合"不在 FAB 内**（FAB 是加资产/交易，不是加容器）。新建组合入口放在 Portfolio Tab 卡片列表**末尾的"+ 新建组合"行**，Stage 3 启用多组合时激活。

---

## 四、Stage 1 页面树（MVP-0 端到端骨架）

**Stage 1 范围严格收紧**：3 Tab 骨架已就位（Markets / Insights 是空态），手动加交易闭环跑通，红涨绿跌切换上线。Rebalance / Watchlist / Daily Snapshot / 欢迎屏全部推到 Stage 2。

```
Public（未登录）
└─ /sign-in                                    ← 邮箱 + magic link

Authenticated（登录后）
├─ /(tabs)/index                               ← Tab1: Portfolio
│  └─ → /portfolio/[id]                        ← 组合详情（持仓表 + 总市值）
│       └─ → /portfolio/[id]/transactions/new  ← 添加交易（Modal，FAB 触发）
│
├─ /(tabs)/markets                             ← Tab2: Markets（Stage 1 = 空态 + Coming soon）
│
├─ /(tabs)/insights                            ← Tab3: Insights（Stage 1 = 空态 + Coming soon）
│
└─ /me                                         ← Me 全屏页（顶栏头像点击触发）
   └─ → /me/settings                           ← 设置（Stack push）
```

### Stage 1 路由规范

| 路径 | 文件（Expo Router）| 类型 | 说明 |
|:---|:---|:---|:---|
| `/sign-in` | `app/sign-in.tsx` | Screen | 公开 |
| `/(tabs)/index` | `app/(tabs)/index.tsx` | Tab | Portfolio |
| `/(tabs)/markets` | `app/(tabs)/markets.tsx` | Tab | 空态：「自选功能即将上线」 |
| `/(tabs)/insights` | `app/(tabs)/insights.tsx` | Tab | 空态：「再平衡引擎即将上线」 |
| `/me` | `app/me/index.tsx` | Stack | Me 全屏页 |
| `/me/settings` | `app/me/settings.tsx` | Stack | 设置 |
| `/portfolio/[id]` | `app/portfolio/[id]/index.tsx` | Stack | 组合详情 |
| `/portfolio/[id]/transactions/new` | `app/portfolio/[id]/transactions/new.tsx` | Modal | 录入交易 |

### Stage 1 各页面数据契约

#### `/sign-in`
- **输入**：邮箱
- **操作**：触发 Supabase Auth magic link
- **反馈**：发送成功 → "请检查邮箱"；点链接回调 → `/(tabs)/index`

#### `/(tabs)/index` — Portfolio Tab
- **顶部**：总资产（Stage 1 单组合时 = 该组合市值）+ 报告货币
- **组合卡片列表**：首登自动建默认组合 `My Portfolio`；每行 = 组合名 + 总市值
- **右下 FAB**：Sheet → `手动添加交易`（Stage 1 仅此一项）
- **Stage 1 不做**：Daily Snapshot、新建组合、今日变动、顶部图表、CSV 入口

#### `/portfolio/[id]` — 组合详情
- **顶部**：组合名 + 总市值 + 价格延迟说明
- **持仓表**：资产名 + 数量 + 原始币价 + 报告币价 + 市值
- **右下 FAB**：继承首页 FAB（目标组合预填）
- **顶栏标题**：组合名（与首页"无标题"是例外，因为详情需要标识）
- **Stage 1 不做**：配置环形图、多时间段图表、资产详情子页、今日变动

#### `/portfolio/[id]/transactions/new` — 手动添加（Modal）
- **表单**：资产搜索（仅美股，Alpha Vantage）/ buy / 日期 / 数量 / 单价 / 手续费（均 Decimal）
- **提交**：写入 transaction，回详情页，TanStack Query invalidate

#### `/(tabs)/markets` — 空态
- 中央插图 + 文案 "Markets coming in Stage 2"
- **不做引导按钮**（避免承诺无法兑现）

#### `/(tabs)/insights` — 空态
- 同上，文案 "Insights coming in Stage 2"

#### `/me` — Me 全屏页
- **顶部**：渐变头像 + 邮箱
- **列表项**（Stage 1）：
  - 设置 → `/me/settings`
  - 注销
- **Stage 1 不做**：订阅、Inbox、连接管理、家庭协作、CSV 导出

#### `/me/settings` — 设置
- 报告货币（CNY / USD）
- 语言（中 / 英）
- **红涨绿跌切换** Switch（Stage 1 上线，token 已就位）
- 深色 / 浅色模式
- **副作用**：所有页面立即重渲染

---

## 五、Stage 2 页面树（让 3 Tab 真正跑起来）

**Stage 2 目标**：3 Tab 不再有空态；用户每天有打开 app 的理由（Daily Snapshot）；首登有迎接（欢迎屏）。

### Stage 2 新增 / 升级

| Tab / 区域 | Stage 2 新增 | 实现要点 |
|:---|:---|:---|
| Portfolio Tab | **Daily Snapshot** 卡片（顶部，今日 ¥+352 / +1.2% + 涨跌前 3）| 依赖 24h 前估值快照；computeMarketValue 已就位 |
| Portfolio Tab | CSV 导入入口加入 FAB Sheet（第 2 项）| `/portfolio/[id]/csv-import` Modal |
| Markets Tab | **Watchlist 轻量版**（搜索美股 + 实时价 + 涨跌幅）| `/markets/search` Modal |
| Insights Tab | **Rebalance 基础版**（目标配置 → 当前 vs 目标 → 行动单）| `/insights/rebalance/{setup,actions}` |
| 全局 | **首登欢迎屏**（1 屏，30 秒）| `/welcome`，签后首次进入 |

### Stage 2 完整页面树

```
Public
└─ /sign-in
└─ /welcome                               ← Stage 2 新增（首登一次性）

Authenticated
├─ /(tabs)/index                          ← Portfolio + Daily Snapshot
│  ├─ → /portfolio/[id]                   ← 组合详情
│  │    ├─ → /portfolio/[id]/transactions/new   ← 手动交易（Modal）
│  │    └─ → /portfolio/[id]/csv-import          ← CSV 导入（Modal/Stack）
│
├─ /(tabs)/markets                        ← Watchlist
│  └─ → /markets/search                   ← 自选搜索添加（Modal）
│
├─ /(tabs)/insights                       ← Rebalance
│  ├─ → /insights/rebalance/setup         ← 首次目标配置（Modal）
│  └─ → /insights/rebalance/actions       ← 行动单
│
└─ /me                                    ← Me 全屏页
   └─ → /me/settings
```

---

## 六、Stage 3-5 产品视角拆解（前瞻）

> 仅覆盖**产品设计**视角的可见能力。工程视角分期见 `docs/development-plan.md`。

### Stage 3 — MVP-1 自用版（广度扩展）

**目标**：覆盖主流资产类别，Insights 成为差异化护城河。

| 模块 | 新增能力 |
|:---|:---|
| **Portfolio** | **多组合支持**（"+ 新建组合"激活）；**配置环形图**（资产大类分布 + 偏离角标）；**多时间段图表**（1H/1D/1W/1M/YTD/1Y/ALL）；**今日变动**指标；资产详情子页（交易记录 + 历史持仓 + TWR）|
| **Markets** | 行情分类浏览（美股 + A股 + 港股 + 基金 + 加密）；涨跌榜/最活跃；**价格提醒**管理；资产详情轻量版 |
| **Insights** | 收益折线图；年化收益；**Performance Attribution**（哪些资产贡献了今年收益）；**Drawdown 分析**；PRO 卡片占位 |
| **Add FAB** | 交易类型扩展：sell / dividend / split |
| **Me** | **订阅体系上线**（Free / Pro / Pro+）；**Inbox 子页**（价格提醒等通知，Revolut 范式 — Me 头像下方专属入口）；CSV 导出；**搜索**全局 affordance |
| **全局** | 顶栏右上 **AI 占位图标点亮**；预设 Q&A + FAQ，不接 LLM |

### Stage 4 — MVP-2 闭门测试（连接 + 协作）

**目标**：从"手动录入"到"自动流入"；开放多人协作。

| 模块 | 新增能力 |
|:---|:---|
| **Portfolio** | 组合卡片显示来源标签（手动/CSV/AI截图/券商/交易所）；多来源对账冲突解决 |
| **Markets** | Good & Bad Decisions（最佳买入时机回顾 / 亏损分析）|
| **Insights** | 风险报告（夏普比率、最大回撤、相关性矩阵）— Pro |
| **Add FAB** | 🎯 **AI 截图识别导入**（支付宝/同花顺/盈透截图）— **Stage 4 P0 差异化亮点**；连接钱包 / 交易所 / 券商（只读）|
| **Me** | **连接管理**（统一查看已连接来源）；**家庭协作**（共享组合 / 权限）；数据隐私（本地 / 云同步）；推送通知配置 |
| **全局** | **AI 接入 LLM**：流式回答 + 上下文注入；资产详情 "Why is it moving?" 入口 |

### Stage 5 — V1.0 公开发布（AI 驱动）

**目标**：AI 成为专属投资分析师，产品从"记账工具"升级为"决策伴侣"。

| 模块 | 新增能力 |
|:---|:---|
| **Portfolio** | AI 生成的组合健康度徽章 |
| **Markets** | AI 新闻摘要 + 事件影响解读 |
| **Insights** | **AI 组合体检报告**（长文 + 图表）；AI 再平衡建议；AI 决策复盘 |
| **Me** | AI 偏好学习（风险偏好、投资理念自动 profiling）|
| **全局** | AI 抽屉支持多轮对话 + 历史会话 + 导出报告 |

**Stage 5 同时完成**：App Store / 国内安卓上架、订阅系统上线、官网。

---

## 七、AI 对话入口前瞻策略

### 7.1 定位：全局能力层（不是 Tab，不是底部悬浮）

AI 助手贯穿所有 Tab 的**能力层**，类似搜索、通知中心。

### 7.2 为什么不做独立 AI Tab / 不做底部悬浮

- **脱离上下文**：切到 AI Tab 即离开当前页面，违反"数据流优先"原则
- **定位错位**：Tab 暗示"和 Portfolio 并列的功能"，AI 应**伴随**所有功能
- **同类产品**：Delta、Cursor、Notion AI、Robinhood 都用**抽屉 / 内联**
- **底部悬浮的副作用**：与 FAB 形成两个浮动按钮视觉竞争；将 AI 升级为主交互违背"Arc 是数据 app"定位

### 7.3 落位：顶栏右上图标 + 抽屉聊天

- **位置**：Header 右上角固定 `✨` AI 图标（与左上头像对称）
- **交互**：点击 → 从右侧（iPad/Web）或底部（Mobile）滑出聊天抽屉，不切 Tab、不离开当前上下文
- **关闭后**：回到原页面，状态无损

### 7.4 上下文感知机制

| 用户所在页面 | 自动携带上下文 | 默认快捷提问 |
|:---|:---|:---|
| Portfolio detail | holdings + 总市值 + 报告货币 | "诊断这个组合的风险" |
| Asset detail（Stage 3）| 资产代码 + 持仓成本 | "Why is it moving today?" |
| Markets 涨跌榜 | 当前筛选 + 榜单类型 | "涨幅榜里谁基本面最稳" |
| Insights - Rebalance | 偏离度 + 目标配置 | "解释为什么偏离这么多" |
| Me | 用户偏好元数据 | 默认空白聊天 |

### 7.5 分期实现

| Stage | 做什么 |
|:---|:---|
| Stage 1-2 | **顶栏右上不放 AI 图标**（避免占位的 cheap 感）|
| Stage 3 | 图标点亮，弹出抽屉；预设 Q&A + FAQ，不接 LLM |
| Stage 4 | 接入 LLM + 流式回答 + 上下文注入；详情页 "Why is it moving?"；**AI 截图导入**上线 |
| Stage 5 | Insights 内 "AI 组合体检报告" 深度生成；多轮对话 + 历史会话 |

**未来重新评估底部悬浮的条件**（不进 ADR）：
- AI 周活 > 30%（说明高频交互值得更高优先级）
- 或 Pro 用户专属 UI 布局（差异化付费功能）

---

## 八、Stage 1 决策对 Stage 2-5 的兼容性自检

| Stage 1 选择 | Stage 2-5 演进 | 兼容 |
|:---|:---|:---:|
| 默认 1 个 portfolio | Stage 3 多组合时此 1 个变默认；列表原生支持多卡片 | ✅ |
| 仅美股 + USD/CNY | Adapter 接口已抽象，加新市场 = 加新 Adapter | ✅ |
| 仅 buy 交易类型 | `transaction.type` 字段预留；Stage 3 加 sell/dividend/split | ✅ |
| Markets / Insights Stage 1 = 空态 | Stage 2 直接填充功能，路由结构不变 | ✅ |
| Portfolio 无图表 | 顶部预留区域，Stage 2 加 Daily Snapshot，Stage 3 加图表 | ✅ |
| Me 仅设置 | Stage 3 加订阅 + Inbox 子页 + 搜索；Stage 4 加连接/协作 | ✅ |
| 顶栏右上无 AI | Stage 3 占位点亮，位置不变 | ✅ |
| CSV 在 Stage 2 加入 FAB | Stage 4 AI 截图导入作为新 FAB 选项插入 | ✅ |
| 顶栏首页无标题 | 详情页有标题（组合名）；i18n 适配零成本 | ✅ |
| 红涨绿跌 Stage 1 上线 | Token 系统（ADR 003）已支持；后续业务页面默认引用 | ✅ |

---

## 九、移动端 / Web 端导航结构图

### 移动端

```
┌──────────────────────────────────────────────┐
│  iOS / Android                              │
│  ┌────────────────────────────────────────┐ │
│  │ [👤 头像]                               │ │  ← Stage 1-2: 仅左头像；Stage 3+: + 右上 ✨
│  ├────────────────────────────────────────┤ │
│  │                                        │ │
│  │   Active Screen Content                │ │
│  │   （总资产大字 / 组合卡片列表）         │ │
│  │                                        │ │
│  │   Modal: /transactions/new             │ │
│  │   （sheet 从下方滑入）                 │ │
│  │                                        │ │
│  │                            [ + FAB ]   │ │
│  │                                        │ │
│  ├────────────────────────────────────────┤ │
│  │  📊 Portfolio  📈 Markets  💡 Insights │ │  ← 3 Tab
│  └────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘

Me 全屏页（点击头像，从左滑入）：
┌──────────────────────────────────────────────┐
│  ← 返回                                      │
│  ┌──────┐                                   │
│  │  渐变 │  cyberjby@gmail.com              │
│  └──────┘                                   │
│                                              │
│  Stage 1: 设置 / 注销                        │
│  Stage 3+: 设置 / Inbox / 订阅 / 注销        │
└──────────────────────────────────────────────┘
```

### Web 端

- 同一份代码（react-native-web 渲染）
- 底部 3 Tab 在大屏（≥768px）下置左成 Sidebar；小屏保持底部
- 头像在大屏移到 Sidebar 底部；小屏保持顶栏左上
- AI 图标（Stage 3+）在大屏置于顶栏右上工具区；点击从右侧滑出抽屉
- Modal 变为居中浮层
- Me 全屏页在大屏变为右侧栏 / 居中对话框

---

## 十、Inbox / Notification 设计（Revolut 范式）

**Stage 3 起**，Inbox 作为 **Me 子页**，不占顶栏图标位、不占 Tab 位。

### 10.1 入口位置
- Me 全屏页头像 profile 区下方第一个列表项：`📬 Inbox`（带未读红点）
- **不在顶栏放铃铛图标**（避免"通知中心"和"AI"两个图标拥挤）
- **不做底部 Tab**（Stage 5 之前都不需要这个频度）

### 10.2 Inbox 内容分期

| Stage | Inbox 包含 |
|:---|:---|
| Stage 3 | 价格提醒触发记录 |
| Stage 4 | 家庭协作邀请、连接管理状态变更（如券商 token 失效）、订阅状态变更 |
| Stage 5 | AI 生成的报告通知（"本月组合体检报告已生成"）|

### 10.3 交互规范
- 列表式（按时间倒序），未读高亮
- 点击通知 → 跳转对应业务页面（如价格提醒 → 资产详情）
- 顶部"全部已读"操作
- 不支持删除（金融通知有审计价值）

---

## 十一、不在 Stage 1-5 范围（明确放弃 / 长期推迟）

| 功能 | 处置 | 理由 |
|:---|:---|:---|
| 完整新手 onboarding（多步）| Stage 5 才做 | Stage 2 的 1 屏欢迎屏即足够 |
| 独立 register 页面 | **永久放弃** | Magic link 登录注册合一 |
| 找回密码 | **永久放弃** | 无密码体系 |
| 用户头像自定义上传 | Stage 5 才做 | 渐变头像够用；非社交属性 |
| 多用户 / 共享组合（非家庭场景）| V2.0+ | 超出个人工具范畴 |
| 社区 / 新闻流 / DIRECT 新股（Delta Home 内容）| **不做** | Arc 定位"工具"非"内容消费" |
| 汉堡菜单 | **永久放弃** | HIG 反模式；用头像替代 |
| AI 底部悬浮按钮 | 暂不规划 | 见 §7.5 重新评估条件 |
| 独立 AI Tab | **永久放弃** | AI 是能力层 |

---

## 十二、文档维护规则

- 本文件是**单一来源真相**。任何 IA 调整都改本文件，不另开提案文档
- 重大变更（Tab 结构、Me 内容、AI 落位）必须立 ADR
- 旧版 IA 提案归档到 `docs/archive/`，本文件只保留当前版本
- 与 `docs/user-journeys.md`、`docs/development-plan.md`、`docs/adr/003-design-tokens.md` 同步更新；任何文档不一致以本文件为准
