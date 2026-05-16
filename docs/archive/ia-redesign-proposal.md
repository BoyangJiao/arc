# Arc 信息架构优化方案（v2.1 提案稿）

- **状态**: 待 review（review 通过后合并回 `docs/information-architecture.md`）
- **更新日期**: 2026-05-08
- **作者**: BoyangJiao + Qoder
- **版本演进**:
  - v2.0（已废弃）：4 Tab（Portfolio / Markets / Insights / Me）+ 顶栏 AI 图标
  - **v2.1（当前）**：**3 Tab**（Portfolio / Markets / Insights）+ **左上头像入 Me** + **CSV 回归 Add FAB** + **为 Stage 3 AI 截图导入预留入口**
- **用途**: 基于 Delta 产品 IA 调研 + 用户提供的参考 IA，产出一份产品设计视角的 Stage 1-4 分阶段规划与一级导航决策草案
- **配套阅读**: `.tempref/IA reference.md`、`.tempref/*.{JPEG,PNG}`（Delta 截图）、`docs/information-architecture.md`（现行 v1）

---

## 一、本次调整的动因

现行 `information-architecture.md` v1 只覆盖 Stage 1 的 5 个页面，一级导航只有 `Portfolio` + `Settings` 两个 Tab，未对齐以下关键产品判断：

1. **一级导航应在 MVP 就确定**，而非等 Stage 2 扩张，避免打破用户肌肉记忆
2. **同类标杆 Delta by eToro** 已验证了 5 Tab + 左上头像的形态，Arc 需先做调研再决定是否收敛
3. **AI 能力在 Stage 4 才接入**，但入口位置必须从 Stage 1 就预留
4. **Stage 2+ 展望缺产品设计视角的分阶段能力拆解**
5. **Me 的内容被错误高估**：v2.0 曾把 Me 列为 Tab4，但经重新审视，Me 实际承载的全是**低频入口**（订阅、家庭协作、连接管理、隐私、设置），不应占用底部宝贵 Tab 位；组合管理属 Portfolio、CSV 导入属 Add FAB

---

## 二、Delta 产品 IA 调研

通过 7 张实拍截图（`.tempref/Home.JPEG`、`market.JPEG`、`Portfolios.PNG` 等）+ 官方 features 页面交叉验证。

### 2.1 Delta 底部 Tab 结构（5 Tab）

| 位置 | Tab | 承载内容摘要 | Arc 对应 |
|:---|:---|:---|:---|
| 1 | **Home** | 每日简报、价格亮点、日记、近期活动（财报/分红日历）、趋势分析、新闻、DIRECT、社区、PRO 营销 | 拆到 Insights + Portfolio 顶部摘要 |
| 2 | **Markets** | 概览 / 加密 / 股票 / 基金 / 指标 / 大宗商品，按地区过滤，最活跃/涨幅榜/跌幅榜 | ✅ 直接对标 |
| 3 | **Portfolio**（中央 FAB） | 总市值 + 多时间段图表（1H/1D/1W/1M/YTD/1Y/ALL）+ 持仓列表 + 右下 FAB | ✅ 直接对标（Arc 在此扩容承载多组合） |
| 4 | **Insights** | 历史记录、组合表现、好坏决策、多样性、收益报告、P/E、风险、贸易统计、费用、资产价值（90% PRO/PRO+） | ✅ 直接对标（Arc 差异化核心） |
| 5 | **Following** | Watchlist：按资产类型过滤、搜索、多时间段切换 | 🟡 降级为 Markets 内子模块 |

**账户入口（Me）不占 Tab**：Delta 放在**顶部左上角汉堡菜单**，内含：头像 + 邮箱、Delta PRO 升级、eToro Club、自动刷新价格开关、连接管理、GoodWallet、设置、注销。

### 2.2 Delta 关键交互模式

- **Portfolio 中央 Tab + FAB**：中间 Tab icon 视觉比两侧大；右下白色圆形 `+` FAB 悬浮
- **添加交易两级选择**：FAB → 添加方式全屏 Sheet（连接钱包/交易所/券商/手动/eToro/**CSV**）→ 资产类型网格 → 具体表单。**关键点：CSV 是添加方式之一，不单独拆模块**
- **Markets 三级筛选**：顶部 Tab 切分类 + 二级横向 Chip 切地区 + 三级分组（榜单）
- **PRO 营销无处不在**：顶部横幅、每个 Insights 卡片的 PRO 标签、Portfolio 页中部 banner
- **"Why is it moving?"**：AI 驱动的价格解读（PRO），隐藏在资产详情，无独立 AI 入口

### 2.3 对 Arc 的启示

| 借鉴 | 规避 |
|:---|:---|
| 中央 FAB、多时间段切换、Markets 三级筛选、CSV 归 FAB | 底部 5 Tab 过于拥挤 → Arc 收敛到 3 Tab |
| Insights 作为差异化阵地集中数据分析 | Insights 全 PRO 付费墙 → Arc 保留核心 Rebalance 免费 |
| 左上头像作为 Me 入口（非汉堡菜单） | Delta 用汉堡图标 → Arc 用**个性化渐变头像**（Vercel 风格） |
| "Why is it moving?" 的上下文解读 | AI 不做独立模块 → 全局能力层 + 上下文感知 |

---

## 三、Arc 一级导航决策（v2.1）

### 3.1 推荐方案：3 Tab + 左上头像 + 右上 AI

```
┌────────────────────────────────────────────────┐
│  [👤 头像 = Me]              [✨ AI Stage 2 亮]  │  ← 顶栏：左 Me / 右 AI，无标题
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

**一级导航三要素**：

| 元素 | 位置 | 角色 |
|:---|:---|:---|
| 3 个 Tab | 底部 | 数据型导航：Portfolio / Markets / Insights |
| 头像 Me 入口 | 顶栏左上 | 低频账户/设置类，全屏页从左滑入 |
| AI 助手图标 | 顶栏右上 | 全局能力层，抽屉聊天，上下文感知 |

### 3.2 为什么是 3 Tab（而非 4 或 5）

| 方案 | 评估 |
|:---|:---:|
| 3 Tab（Portfolio/Markets/Insights）+ 左上头像 | ✅ **推荐** |
| 4 Tab（+ Me） | ❌ Me 内容低频，占位浪费；与"金融工具不是社交 app"的克制原则冲突 |
| 5 Tab（对齐 Delta，Following 独立） | ❌ 底部拥挤；Following 在 MVP 功能轻量 |
| 3+1 独立 AI Tab | ❌ AI 应是能力层而非功能模块；脱离上下文；主流嵌入式产品无先例 |

**Me 为什么可以从 Tab4 降为顶栏入口**：
1. Me 的所有内容都是**低频操作**（订阅、家庭协作、连接管理、隐私、设置都是几周打开一次）
2. **组合管理回归 Portfolio Tab**（Wise 多账户范式：首页展示所有组合卡片）
3. **CSV 导入回归 Add FAB**（本质是添加资产的方式之一，Delta 自己就这么做）
4. **AI 截图导入（Stage 3）** 将进一步降低 CSV 使用频率，Me 更无需承担数据录入职责

### 3.3 三个 Tab 的职责边界

| Tab | 回答的问题 | Stage 1 内容 | Stage 2+ 扩张方向 |
|:---|:---|:---|:---|
| **Portfolio** | "我现在持有什么？值多少钱？" | 总资产（跨组合汇总）+ 组合卡片列表（Wise 风格，Stage 1 默认 1 个）+ FAB 添加 → 组合详情（持仓表） | 配置环形图、多时间段图表、今日变动、资产详情子页、组合合并视图、AI 健康度徽章 |
| **Markets** | "市场在发生什么？我关心的标的怎样？" | Watchlist（搜索添加自选，实时价格 + 涨跌幅） | 行情分类浏览、涨跌榜、价格提醒、"Why is it moving?"、AI 新闻摘要 |
| **Insights** | "我的决策做得好吗？要调整吗？" | Rebalance 再平衡引擎（目标配置 + 偏离度 + 行动单） | 收益折线图、好坏决策、风险报告、AI 组合体检 |

### 3.4 头像入口的设计规范

- **默认头像**：基于邮箱 hash 生成的**渐变几何图形**（Vercel / Linear 风格），推荐使用 `@dicebear/collection` 的 `shapes` 或 `gradient` 生成器
- **含义**：每个用户视觉唯一，比汉堡菜单更有"品牌温度"
- **点击交互**：从左侧滑入**全屏页面**（Stack push），非抽屉
- **返回方式**：左上角 X / 返回键 / 右滑手势
- **为什么不用汉堡菜单**：苹果 HIG 明确不推荐（2015 年的反模式），头像的可发现性 + 个性化 + 品牌感都更强

### 3.5 Add FAB 内容规划

FAB 仅在 **Portfolio Tab 列表页 / Portfolio detail** 显示，点击弹出添加方式 Sheet：

```
FAB [+]
└─ 添加方式 Sheet（纵向列表）
   ├─ ✍️  手动添加交易          ← Stage 1
   ├─ 📄  导入 CSV              ← Stage 1
   ├─ 📸  AI 截图识别导入 ✨     ← Stage 3（新用户最友好）
   ├─ 🏦  连接券商（只读）       ← Stage 3
   ├─ 💱  连接交易所（只读）     ← Stage 3
   └─ 👛  连接钱包              ← Stage 3
```

**"新建组合"不在 FAB 内**（FAB 是加资产/交易，不是加容器）。新建组合入口放在 Portfolio Tab 的组合卡片列表**末尾的"+ 新建组合"行**，Stage 2 启用多组合时激活。

---

## 四、原 §七 未决问题结论

全部落地为决策：

| 原问题 | 结论 | 落地说明 |
|:---|:---|:---|
| 默认 portfolio 命名 | **`My Portfolio`**（EN）/ **`我的组合`**（ZH） | 由 i18n key `portfolio.defaultName` 驱动，用户系统接入后再个性化 |
| Tab Bar 红点提示 | Stage 1 不做 | 红点需要"未读 / 异动"语义，Stage 1 无推送体系 |
| Portfolio detail "今日变动" | Stage 1 只显示总市值 | 今日变动与多时间段图表一起放 Stage 2 |
| 红涨绿跌切换开关 | **Stage 1 上线** | Token 系统（ADR-003）已就位，Settings 内放 Switch |

---

## 五、AI 对话入口前瞻策略

### 5.1 定位：全局能力层（非独立 Tab）

AI 助手**不是功能模块**，而是贯穿所有 Tab 的**能力层**，类似搜索、通知中心。

### 5.2 为什么不做独立 AI Tab

- **脱离上下文**：切到 AI Tab 即离开当前页面，用户必须从零描述上下文，违反"数据流优先"原则
- **定位错位**：Tab 暗示"和 Portfolio 并列的功能"，AI 应**伴随**所有功能
- **同类产品无先例**：Delta、Cursor、Notion AI、Robinhood、彭博终端都用**抽屉 / 悬浮 / 内联**
- **挤占 Tab 位**：3 Tab 已是最佳平衡，塞入 AI 会让数据型 Tab 被稀释

### 5.3 推荐落位：顶栏右上图标 + 抽屉聊天

- **位置**：Header 右上角固定 `✨` AI 图标（与左上头像对称）
- **交互**：点击 → 从右侧（iPad/Web）或底部（Mobile）滑出聊天抽屉，不切 Tab、不离开当前上下文
- **关闭后**：回到原页面，状态无损

### 5.4 上下文感知机制

进入聊天时自动携带当前页面上下文：

| 用户所在页面 | 自动携带上下文 | 默认快捷提问 Chip |
|:---|:---|:---|
| Portfolio detail | 组合 holdings + 总市值 + 报告货币 | "诊断这个组合的风险" |
| Asset detail（Stage 2） | 资产代码 + 持仓成本 | "Why is it moving today?" |
| Markets 涨跌榜 | 当前筛选 + 榜单类型 | "涨幅榜里谁基本面最稳" |
| Insights - Rebalance | 偏离度 + 目标配置 | "解释为什么偏离这么多" |
| Me | 用户偏好元数据 | 默认空白聊天 |

### 5.5 分期实现计划

| Stage | 做什么 | 成本 |
|:---|:---|:---:|
| Stage 1 | 顶栏右上**预留占位图标**（禁用态 + tooltip "Coming soon"），保留布局空间 | XS |
| Stage 2 | 图标点亮，弹出抽屉；预设 Q&A 卡片 + FAQ，不接 LLM | S |
| Stage 3 | 接入 LLM + 流式回答 + 上下文注入；资产详情页顶部加 "Why is it moving?"；**AI 截图导入**上线 | M |
| Stage 4 | Insights 内 "AI 组合体检报告" 深度生成；多轮对话 + 历史会话 | L |

---

## 六、Stage 1-4 产品设计视角拆解

> 仅覆盖**产品设计**视角的可见能力。工程视角分期见 `docs/development-plan.md`。

### Stage 1（MVP-0）— 端到端骨架

**目标**：一个人能用、闭环自用，覆盖"录入 → 查看 → 决策提示"基本链路。

| 模块 | 交付能力 |
|:---|:---|
| **Portfolio Tab** | 顶部总资产（单组合时即该组合市值）；组合卡片列表（Stage 1 默认 1 个 `My Portfolio`）；点击进组合详情：持仓表 + 总市值（报告货币）；右下 FAB |
| **Markets Tab** | Watchlist 轻量版：搜索美股（Alpha Vantage）→ 添加自选 → 实时价格 + 涨跌幅；无榜单、无分类 |
| **Insights Tab** | Rebalance 基础版：目标配置（拖拽分配）→ 当前 vs 目标对比 → 行动单生成 |
| **Add FAB** | 手动添加交易（仅 buy / 仅美股）+ 导入 CSV |
| **Me（顶栏头像入口）** | 头像 + 邮箱；设置：语言、报告货币、**红涨绿跌切换**、深色/浅色模式；注销 |
| **全局** | Header 右上 AI 图标**占位**（禁用态）；FAB 仅在 Portfolio Tab 显示 |

### Stage 2（广度扩展）— 数据覆盖与分析深度

**目标**：覆盖主流资产类别，Insights 成为差异化护城河。

| 模块 | 新增能力 |
|:---|:---|
| **Portfolio** | **多组合支持**（组合卡片列表激活 "+ 新建组合"）；**配置环形图**（资产大类分布 + 偏离提示角标）；**多时间段图表**（1H/1D/1W/1M/YTD/1Y/ALL）；**今日变动**指标；资产详情子页（交易记录 + 历史持仓 + TWR） |
| **Markets** | 行情分类浏览（美股 + A股 + 港股 + 基金 + 加密）；涨幅榜/跌幅榜/最活跃；**价格提醒**管理；资产详情轻量版 "Why is it moving?" |
| **Insights** | 收益折线图（1W/1M/3M/1Y/YTD/ALL）；年化收益；PRO 卡片位（未激活） |
| **Add FAB** | 交易类型扩展：sell / dividend / split |
| **Me** | **订阅体系上线**（Free / Pro / Pro+）；订阅管理；CSV 导出（放 Me）|
| **全局** | AI 抽屉**点亮**：预设 Q&A + FAQ，不接 LLM |

### Stage 3（连接与协作）— 从"手动录入"到"自动流入"

**目标**：解决"录入即痛点"，数据自动流入；开放多人协作。

| 模块 | 新增能力 |
|:---|:---|
| **Portfolio** | 组合卡片显示来源标签（手动/CSV/AI截图/券商/交易所）；多来源对账冲突解决 |
| **Markets** | Good & Bad Decisions（回顾最佳买入时机 / 亏损持仓） |
| **Insights** | 风险报告（夏普比率、最大回撤、相关性矩阵）— Pro |
| **Add FAB** | 🎯 **AI 截图识别导入**（支付宝/同花顺/盈透截图）；连接钱包 / 交易所 / 券商（只读） |
| **Me** | **连接管理**（统一查看已连接来源）；**家庭协作**（共享组合 / 权限）；数据隐私（本地 / 云同步）；推送通知配置 |
| **全局** | **AI 接入 LLM**：流式回答 + 上下文注入；资产详情 "Why is it moving?" 入口 |

### Stage 4（AI 驱动）— 从"工具"到"伴随"

**目标**：AI 成为专属投资分析师，产品从"记账工具"升级为"决策伴侣"。

| 模块 | 新增能力 |
|:---|:---|
| **Portfolio** | AI 生成的组合健康度徽章（顶部） |
| **Markets** | AI 新闻摘要 + 事件影响解读 |
| **Insights** | **AI 组合体检报告**（长文 + 图表）；AI 再平衡建议（超越规则引擎）；AI 决策复盘 |
| **Me** | AI 偏好学习（风险偏好、投资理念自动 profiling） |
| **全局** | AI 抽屉支持多轮对话 + 历史会话 + 导出报告 |

---

## 七、Stage 1 页面树

```
Public（未登录）
└─ /sign-in                                    ← 邮箱 + magic link

Authenticated（登录后）
├─ /(tabs)/index                               ← Tab1: Portfolio
│  ├─ → /portfolio/[id]                        ← 组合详情（持仓表 + 总市值）
│  │    └─ → /portfolio/[id]/transactions/new  ← 添加交易（Modal，来自 FAB）
│  └─ → /portfolio/[id]/csv-import             ← CSV 导入（Modal/Stack，来自 FAB）
│
├─ /(tabs)/markets                             ← Tab2: Markets（Stage 1 = Watchlist）
│  └─ → /markets/search                        ← 搜索添加自选（Modal）
│
├─ /(tabs)/insights                            ← Tab3: Insights（Stage 1 = Rebalance）
│  ├─ → /insights/rebalance/setup              ← 首次目标配置（Modal）
│  └─ → /insights/rebalance/actions            ← 生成行动单
│
└─ /me                                         ← Me 全屏页（顶栏头像点击触发，非 Tab）
   └─ → /me/settings                           ← 设置（Stack push）
```

**Stage 1 总计**：1 Public + 3 Tab + Me 全屏页 + 若干子页面 + 3 Modal（transactions/new、csv-import、markets/search）

### 路由规范

| 路径 | 文件（Expo Router） | 类型 | 说明 |
|:---|:---|:---|:---|
| `/sign-in` | `app/sign-in.tsx` | Screen | 公开，登录前唯一入口 |
| `/(tabs)/index` | `app/(tabs)/index.tsx` | Tab Screen | Tab1 = Portfolio |
| `/(tabs)/markets` | `app/(tabs)/markets.tsx` | Tab Screen | Tab2 = Markets |
| `/(tabs)/insights` | `app/(tabs)/insights.tsx` | Tab Screen | Tab3 = Insights |
| `/me` | `app/me/index.tsx` | Stack Screen | Me 全屏页（左滑入） |
| `/me/settings` | `app/me/settings.tsx` | Stack Screen | 设置 |
| `/portfolio/[id]` | `app/portfolio/[id]/index.tsx` | Stack | 组合详情 |
| `/portfolio/[id]/transactions/new` | `app/portfolio/[id]/transactions/new.tsx` | Modal | 手动录入交易 |
| `/portfolio/[id]/csv-import` | `app/portfolio/[id]/csv-import.tsx` | Modal/Stack | CSV 导入向导 |
| `/markets/search` | `app/markets/search.tsx` | Modal | 自选搜索添加 |
| `/insights/rebalance/setup` | `app/insights/rebalance/setup.tsx` | Modal | 目标配置 |
| `/insights/rebalance/actions` | `app/insights/rebalance/actions.tsx` | Stack | 行动单详情 |

### 导航约束

- **底部 3 Tab 始终可见**（除 `/sign-in` 和 `/me` 全屏页外）
- **Stack 详情页入栈**，不切 Tab 高亮
- **`/me` 从左滑入全屏**：使用 `animation: 'slide_from_left'`；其内部子页（settings 等）正常 Stack push
- **Modal**：iOS sheet / Android bottom sheet / Web 居中浮层
- **未登录访问 Authenticated 路由** → 重定向到 `/sign-in`
- **顶栏**：左头像 + 右 AI 图标（Stage 1 AI 禁用态），中间**无标题**（Portfolio 页总资产大字即是视觉焦点）

---

## 八、Stage 1 各页面数据契约（产品视角）

> 仅描述"页面给用户看什么 / 用户能做什么"。

### 8.1 `/sign-in`

- **输入**：用户邮箱
- **操作**：触发 Supabase Auth magic link 发送
- **反馈**：发送成功 → 提示"检查邮箱"；点链接回调 → `/(tabs)/index`

### 8.2 `/(tabs)/index` — Portfolio Tab（首页）

- **顶部**：总资产大字（跨所有组合汇总，Stage 1 只有 1 个组合时 = 该组合市值）+ 报告货币切换
- **组合卡片列表**（Wise 风格）：
  - 首次登录自动创建默认组合 `My Portfolio`
  - 每行：组合名 + 总市值（报告货币）+ 来源标签（Stage 3 起）
  - Stage 1 通常只有 1 个
- **右下 FAB**：点击弹出 Sheet → `手动添加交易` / `导入 CSV`（Stage 1 两项）
- **Stage 1 不做**：新建组合、今日变动、顶部图表

### 8.3 `/portfolio/[id]` — 组合详情

- **顶部**：组合名 + 总市值（报告货币）+ 价格延迟说明
- **持仓表**：资产名 + 数量 + 原始币价 + 报告币价 + 市值
- **右下 FAB**：继承首页 FAB（手动交易 / CSV 导入，目标组合预填为当前）
- **Stage 1 不做**：配置环形图、多时间段图表、资产详情子页、今日变动

### 8.4 `/portfolio/[id]/transactions/new` — 手动添加交易（Modal）

- **表单字段**（Stage 1）：
  - 资产搜索选择（仅美股，Alpha Vantage）
  - 类型：buy（仅 buy）
  - 日期 + 时区
  - 数量 / 单价 / 手续费（均 Decimal，禁用 number）
- **提交**：写入 transaction，返回 detail 页，TanStack Query invalidate 刷新

### 8.5 `/portfolio/[id]/csv-import` — CSV 导入（Modal/Stack）

- **步骤**：选择文件 → 预览解析结果 → 字段映射确认 → 确认导入
- **Stage 1 简化**：固定 CSV 格式（后续 Stage 2 支持多格式模板）

### 8.6 `/(tabs)/markets` — Markets（Stage 1 = Watchlist）

- **列表**：用户已添加的自选，每行：代码 + 名称 + 实时价 + 涨跌幅
- **空态**：引导添加第一个自选
- **右上搜索** → `/markets/search`
- **Stage 1 不做**：分类 Tab、地区过滤、涨跌榜、价格提醒

### 8.7 `/(tabs)/insights` — Insights（Stage 1 = Rebalance）

- **未设置目标配置态**：引导首次进入 `/insights/rebalance/setup`
- **已设置态**：
  - 当前 vs 目标对比（双环图 / 偏离度条形图）
  - 每个资产大类的 +/- 偏差
  - "生成行动单" → `/insights/rebalance/actions`
- **Stage 1 不做**：收益折线图、好坏决策、风险报告

### 8.8 `/me` — Me 全屏页（顶栏头像入口）

- **顶部**：默认渐变头像（邮箱 hash 生成）+ 邮箱 + 昵称占位
- **列表项**（Stage 1）：
  - 设置 → `/me/settings`
  - 注销
- **Stage 1 不做**：订阅、连接管理、家庭协作、数据隐私、CSV 导出

### 8.9 `/me/settings` — 设置

- **可改项**（Stage 1）：
  - 报告货币（CNY / USD）
  - 语言（中 / 英）
  - **红涨绿跌切换** Switch
  - 深色 / 浅色模式
- **副作用**：所有页面立即重渲染

---

## 九、导航结构图

### 移动端

```
┌──────────────────────────────────────────────┐
│  iOS / Android                              │
│  ┌────────────────────────────────────────┐ │
│  │ [👤 头像]                    [✨ AI]   │ │  ← 顶栏：左头像 / 右 AI 禁用占位
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

Me 全屏页（点击头像触发，从左滑入）：
┌──────────────────────────────────────────────┐
│  ← 返回                                      │
│  ┌──────┐                                   │
│  │  头像 │  cyberjby@gmail.com              │
│  └──────┘                                   │
│                                              │
│  设置                                       >│
│  注销                                        │
└──────────────────────────────────────────────┘
```

### Web 端

- 同一份代码（react-native-web 渲染）
- **底部 3 Tab** 在大屏（≥768px）下置左成 Sidebar；小屏保持底部
- **头像** 在大屏移到 Sidebar 底部；小屏保持顶栏左上
- **AI 图标** 在大屏置于顶栏右上工具区；点击从右侧滑出抽屉
- **Modal** 变为居中浮层
- **Me 全屏页** 在大屏变为右侧栏 / 居中对话框

---

## 十、Stage 1 决策对 Stage 2+ 的兼容性自检

| Stage 1 选择 | Stage 2+ 演进 | 兼容 |
|:---|:---|:---:|
| 默认 1 个 portfolio | 多组合时此 1 个变默认组合；列表原生支持多卡片 | ✅ |
| 仅美股 + USD/CNY | Adapter 接口已抽象，加新市场 = 加新 Adapter | ✅ |
| 仅 buy 交易类型 | `transaction.type` 字段预留；加 sell/dividend/split 即可 | ✅ |
| Portfolio 无图表 | 顶部预留区域，Stage 2 加配置环形图 + 时间段图表 | ✅ |
| Markets 仅 Watchlist | Stage 2 加分类 Tab，Watchlist 保留为 `watchlist` 子分段 | ✅ |
| Insights 仅 Rebalance | Stage 2 加收益折线图卡片，与 Rebalance 并列 | ✅ |
| Me 仅设置 | Stage 2 加订阅、Stage 3 加连接/协作，Me 页垂直扩展 | ✅ |
| AI 图标禁用占位 | Stage 2 图标点亮，位置不变，用户无视觉中断 | ✅ |
| CSV 在 Add FAB | Stage 3 AI 截图导入作为新 FAB 选项插入即可 | ✅ |
| 顶栏无标题 | 语言无关，i18n 适配零成本 | ✅ |

---

## 十一、不在 Stage 1-4 范围（明确放弃或长期推迟）

| 功能 | 处置 | 理由 |
|:---|:---|:---|
| 用户引导 onboarding 流程 | 推迟到 V1.0 公开发布 | MVP 自用无需新手引导 |
| 独立 register 页面 | **永久放弃** | Magic link 登录注册合一 |
| 找回密码 | **永久放弃** | 无密码体系 |
| 用户资料 / 头像自定义上传 | 推迟到 V1.0 | 个人金融工具非社交属性；Stage 1-4 用邮箱 hash 默认渐变头像 |
| 多用户 / 共享组合（非家庭场景） | V2.0+ | 超出个人工具范畴 |
| 社区 / 新闻流 / DIRECT 新股（Delta Home 内容） | **不做** | Arc 定位"工具"而非"内容消费" |
| 汉堡菜单 | **永久放弃** | 2015 年反模式；用头像替代 |

---

## 十二、Review 通过后的落地步骤

review 通过后，按以下顺序改动 `docs/information-architecture.md`：

1. 替换 §一 设计原则（追加 2 条：一级导航 MVP 锁定、差异化集中 Insights）
2. 新增 §二 Delta 产品 IA 调研
3. 重写 §三 一级导航决策（3 Tab + 左上头像 + 右上 AI）
4. 重写 §四 Stage 1 页面树（含 Me 全屏页 + Add FAB 结构）
5. 重写 §五 Stage 1 各页面数据契约
6. 重写 §六 Stage 2-4 产品设计视角拆解（原 §四 升级）
7. 新增 §七 AI 对话入口前瞻策略
8. 更新 §八 导航结构图（含头像 + AI 图标 + Me 全屏页）
9. 删除原 §七 未决问题（4 条结论已落入对应小节）
10. 同步更新 `docs/development-plan.md` 的 Stage 范围（若影响工程视角）
11. 归档本提案文档到 `docs/archive/ia-redesign-proposal-v2.1.md`

---

## 十三、Review Checklist（待你逐条确认）

### 已确认项
- [x] **一级导航**：3 Tab（Portfolio / Markets / Insights），Me 作为顶栏左上头像全屏页
- [x] **Me 呈现**：全屏页，从左滑入
- [x] **顶栏标题**：无标题，左头像 + 右 AI 图标（总资产大字为视觉焦点）
- [x] **AI 入口**：全局能力层，顶栏右上图标 + 抽屉聊天，不做独立 Tab
- [x] **CSV 导入**：归 Add FAB，不独立入口
- [x] **组合管理**：归 Portfolio Tab（Wise 多卡片范式）
- [x] **默认头像**：邮箱 hash 渐变几何图形（Vercel 风格）

### 待确认项
- [ ] **默认组合名**：`My Portfolio`（EN）/ `我的组合`（ZH）是否可定稿
- [ ] **今日变动推到 Stage 2**：是否接受（原 v1 想放 Stage 1）
- [ ] **红涨绿跌 Stage 1 上线**：是否接受
- [ ] **Rebalance 放 Stage 1**：是否接受（原 v1 未明确）
- [ ] **Watchlist 放 Stage 1**：是否接受（原 v1 未提）
- [ ] **新建组合入口位置**：Portfolio Tab 卡片列表末尾 + Me 里也留一个快捷 or 只在 Portfolio Tab
- [ ] **CSV 导出位置**：Stage 2 放 Me（与订阅同期） or 放 Add FAB 同级
- [ ] **AI 截图导入时机**：Stage 3（我给的排期） or 提前到 Stage 2
- [ ] **头像库选型**：`@dicebear/collection` 可接受 or 自己实现渐变生成器

确认后，我会按 §十二 的步骤合并回 `docs/information-architecture.md`，并归档本文件。
