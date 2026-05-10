# Arc Product Roadmap

- **状态**: 已接受（v1）
- **更新日期**: 2026-05-10
- **作者**: BoyangJiao + Claude
- **范围**: Stage 1（MVP-0 端到端骨架）→ Stage 5（V1.0 公开发布）
- **配套**:
  - `docs/development-plan.md` — 工程视角分期（推荐模型 / Skills / DoD）
  - `docs/information-architecture.md` — 页面树 + 导航
  - `docs/user-journeys.md` — 用户旅程
  - `docs/adr/` — 关键决策

---

## 一、文档目的

本 roadmap 是 **产品视角的能力时间线**。它回答：
- 每个 Stage 用户**能做什么**（产品力交付）
- 每个 Stage 解决的**核心问题 / 假设**
- Stage 间的**先后依赖** / 关键决策点
- 度量指标 / 退出标准

它**不**重复 dev-plan 的工时估算、模型分工、技术任务清单，也**不**重复 IA 的页面树、user-journeys 的步骤。

---

## 二、产品哲学（每个 Stage 都遵守）

引自 CLAUDE.md / development-plan.md：

| 原则 | 含义 | 影响 roadmap |
|:---|:---|:---|
| Scratch your own itch | 自己每周用 ≥3 次的功能才进 MVP | 不做"用户可能喜欢"的功能 |
| 手动优先 > 自动 | MVP 全部手动录入 + CSV，自动同步是 V1.5+ 议题 | Stage 1-3 不接券商 API |
| 数据可信优先 > 功能丰富 | 宁愿少一个图表，也不展示可能错的数字 | TWR 误差必须 <1% 才上 |
| 隐私在产品名片上 | 敏感数字一键脱敏、本地优先存储、最小化云端字段 | Stage 3 一键脱敏 P1 |
| 文案铁律 | 永不"建议买入/卖出"；用"达到/偏离目标配置" | 产品力描述也要遵守 |

---

## 三、Roadmap 全景

```
Stage 0  Pre-flight        ─►  账号 / Figma 关键页 / 产品名 / 设计 token 锁定
                                                                    │
Stage 1  MVP-0 端到端骨架  ─►  3 Tab 骨架 + 单组合 + 手动加单 + 美股
         (3 周, 15-25h)        Markets/Insights 是空态，先把骨架立起来
                                                                    │
Stage 2  让 3 Tab 跑起来   ─►  + Daily Snapshot + 欢迎屏 + Watchlist + Rebalance + CSV
         (3 周, 15-25h)        消除空态，每天有打开 app 的理由
                                                                    │
Stage 3  MVP-1 自用版      ─►  + 多市场 + 多组合 + 配置环形图 + 多时间段 + TWR + 订阅 + Inbox + AI 占位
         (8-10 周, 60-100h)    自己能完整管理真实持仓
                                                                    │
Stage 4  MVP-2 闭门测试    ─►  + 5-15 种子用户 + AI 截图导入 + 接 LLM + 连接券商 + 家庭协作
         (4-6 周, 30-60h)      验证"自己用得爽 ≠ 别人也觉得爽"
                                                                    │
Stage 5  V1.0 公开发布     ─►  + App Store + 订阅 + 完整 onboarding + AI 体检报告
         (4-8 周, 30-60h)      上架 + 商业化
```

---

## 四、Stage 1 — MVP-0 端到端骨架

| 项 | 内容 |
|:---|:---|
| **核心问题** | 我的金融追踪 app 能不能跑通"录一笔交易看到正确市值"的最小闭环？ |
| **关键假设** | HeroUI Native + Uniwind + Tailwind v4 + decimal.js 这套技术栈对金融场景能用 |
| **产品力交付** | 3 Tab 骨架（Portfolio 真实可用 / Markets + Insights 是空态）+ 单组合 + 手动加单 + 美股 + 红涨绿跌切换 |
| **不做** | 多组合 / 图表 / Watchlist / Rebalance / CSV / AI / 欢迎屏 / 订阅 |
| **度量指标** | 录入一笔 AAPL → 看到正确 CNY 市值 → 切换 USD → 数字正确 → 切换语言无残留 → TestFlight 装机 |
| **退出标准** | DoD 100% 通过；自评"再加一行代码就成 polished MVP" |
| **关键决策点** | Stage 1 末：数据模型定型（之后只增不改），Schema migration 从此变贵 |
| **风险** | i18n 早期不分离 → 后期返工；`number` 处理金额 → 浮点 P0 bug |
| **对应 Journey** | J1 / J2 / J3 / J4 / J5 |

---

## 五、Stage 2 — 让 3 Tab 真正跑起来

| 项 | 内容 |
|:---|:---|
| **核心问题** | Stage 1 骨架 OK，但 Markets / Insights 是空态 — 怎么让用户每天有打开 app 的理由？ |
| **关键假设** | Daily Snapshot（"今日 +1.23%"）就是钩子；Rebalance 基础版就是 Insights 的差异化护城河起点 |
| **产品力交付** | Daily Snapshot + 欢迎屏 + Watchlist 轻量版 + Rebalance 基础版 + CSV 导入 |
| **不做** | 多组合 / 多市场 / TWR / Performance Attribution / Drawdown / AI / 订阅 / Inbox |
| **度量指标** | Daily Snapshot 每天准确反映；Watchlist 持久化；Rebalance 行动单数字精确；CSV 100 行 <10s |
| **退出标准** | 自评"我每天会打开看 Daily Snapshot；周末会用 Rebalance 调一次配置" |
| **关键决策点** | Stage 2 末：是否进入 Stage 3？ — 看自用频率（≥每周 3 次） |
| **风险** | Daily Snapshot 数字错误 → 信任崩塌；Rebalance 文案"建议买入" → 合规事故 |
| **对应 Journey** | J6 / J7 / J8 / J9 / J10 |

---

## 六、Stage 3 — MVP-1 自用版

| 项 | 内容 |
|:---|:---|
| **核心问题** | 我能不能用 Arc 替代 Excel + 雪球 + 同花顺三件套，完整管理真实跨市场持仓？ |
| **关键假设** | 多市场 adapter 能覆盖我所有持仓；TWR 准确度能达到金融工具水准 |
| **产品力交付** | 多市场（A股 / 港股 / 美股 / 基金 / crypto）+ 多组合 + 配置环形图 + 多时间段图表 + TWR + Performance Attribution + Drawdown + 订阅体系 + Me/Inbox + AI 占位（不接 LLM）|
| **P1 加项** | 数字脱敏 / 价格提醒 / Markets 行情分类 / 全局搜索 |
| **不做** | AI LLM（占位但不接）/ 截图识别 / 连接券商 / 家庭协作 / 风险报告 |
| **度量指标** | 真实持仓 100% 录入；自用 ≥4 周；TWR 与雪球误差 <1%；至少 3 个自发现 bug 修复 |
| **退出标准** | 自评"我已经停用 Excel/雪球/同花顺"；订阅体系跑通（自己买也算） |
| **关键决策点** | Stage 3 中：是否提前 prompt design AI 模块；Stage 3 末：进入 Stage 4 招种子用户 |
| **风险** | TWR 算法 edge case（QDII / 股息再投资）；多组合 schema 复杂度爆炸 |
| **对应 Journey** | J11 / J12 / J13 / J14 / J15 / J16 |

---

## 七、Stage 4 — MVP-2 闭门测试 + 连接协作

| 项 | 内容 |
|:---|:---|
| **核心问题** | 别人能用 Arc 吗？AI + 连接 + 协作能不能成为差异化护城河？ |
| **关键假设** | AI 截图识别能解决"录入即痛点"；家庭协作是高价值少做场景 |
| **产品力交付** | 🎯 AI 截图识别（差异化亮点）+ 连接券商/交易所/钱包（只读）+ 家庭协作 + 风险报告 + Good & Bad Decisions + AI 接入 LLM + Why is it moving |
| **不做** | App Store 上架 / 完整 onboarding（推 Stage 5）/ 公司主体注册（看反馈再说）|
| **度量指标** | ≥10 个用户使用 ≥4 周；留存：≥5 用户每周打开 ≥2 次；≥3 用户说"会推荐"；AI 截图识别准确率 ≥90% |
| **退出标准** | 0 个 P0/P1 未修；NPS ≥7；用户至少一次"我的数字怎么不对"对账完成 |
| **关键决策点** | Stage 4 末：是否启动公司主体注册（看种子用户反馈深度） |
| **风险** | AI 截图识别准确率不达标；连接券商监管/合规风险；家庭协作权限模型复杂 |
| **对应 Journey** | J17 / J18 / J19 / J20 |

---

## 八、Stage 5 — V1.0 公开发布

| 项 | 内容 |
|:---|:---|
| **核心问题** | Arc 能不能成为商业化产品？AI 能不能从能力升级为差异化护城河？ |
| **关键假设** | App Store 上架后能通过自然搜索 + KOL 渠道获取首批 100-1000 用户；AI 体检报告能成为口碑亮点 |
| **产品力交付** | App Store / 国内安卓上架 + 订阅系统（Free / Pro / Pro+）+ 官网 + AI 组合体检报告 + AI 多轮对话 + 完整 onboarding + 合规材料 |
| **不做** | 自动同步交易（V1.5+）/ 多用户共享非家庭场景（V2.0+）/ 社区 |
| **度量指标** | App Store 上架 + 至少 1 家国内安卓商店 + Pro 订阅首单 + 官网 SEO 元数据齐 + AI 体检报告稳定 ≥1 周 |
| **退出标准** | 应用商店审核通过；首单到账（自己买也算）；官网可访问 |
| **关键决策点** | Stage 5 中：是否需要专项律师 review（含支付/AI） |
| **风险** | App Store 审核驳回（金融类目敏感）；ICP 备案延迟（30-60 天）；订阅退款率高 |
| **对应 Journey** | J21 / J22 / J23 |

---

## 九、关键依赖与里程碑

### 9.1 Stage 间硬依赖

```
Stage 1 ─► Stage 2 : 数据模型必须定型（不再改 schema）
Stage 2 ─► Stage 3 : 自评每周打开 ≥3 次（Daily Snapshot 是钩子有效）
Stage 3 ─► Stage 4 : 自用 ≥4 周；订阅体系跑通
Stage 4 ─► Stage 5 : ≥10 种子用户使用 ≥4 周；NPS ≥7
```

### 9.2 跨 Stage 持续投入

| 项 | Stage 1 | Stage 2 | Stage 3 | Stage 4 | Stage 5 |
|:---|:---:|:---:|:---:|:---:|:---:|
| ADR 维护 | ✓ | ✓ | ✓ | ✓ | ✓ |
| i18n 同步 | ✓ | ✓ | ✓ | ✓ | ✓ |
| Token 系统扩展（按需）| ✓ | ✓ | ✓ | ✓ | ✓ |
| Sentry 错误响应 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 自用 dogfooding | ✓ | ✓ | ✓ | ✓ | ✓ |

### 9.3 单次性事件（只在某 Stage 发生）

| 事件 | Stage | 说明 |
|:---|:---:|:---|
| 数据模型定型 | Stage 1 末 | 之后只增不改 |
| 设计 token 落地 | Stage 1 初 | ADR 003 实施 |
| 招种子用户 | Stage 4 初 | 5-15 人 |
| App Store 提审 | Stage 5 中 | 首次上架 |
| 公司主体注册 | Stage 4-5 间 | 看反馈决定 |

---

## 十、AI 能力时间线（产品视角）

> AI 能力跨多个 Stage，单独成节便于追踪。详细 UI 落位见 IA §七。

| Stage | AI 能力 | 用户感知 | 工程复杂度 |
|:---|:---|:---|:---:|
| Stage 1-2 | **不上 AI** | 顶栏右上无 AI 图标 | — |
| Stage 3 | **AI 占位 + 预设 Q&A** | 图标点亮，点击弹出 FAQ 抽屉，无 LLM | 低 |
| Stage 4 | **接入 LLM**：流式回答 + 上下文注入 | "Why is it moving?" 按钮；AI 抽屉响应 | 中 |
| Stage 4 | **AI 截图识别导入** | FAB → 截图 → AI 解析 → 批量交易 | 高（多模态 LLM）|
| Stage 5 | **AI 组合体检报告** | Insights → 一键生成长文 + 图表 | 高 |
| Stage 5 | **AI 多轮对话 + 历史会话** | AI 抽屉支持多轮 + 导出 | 中 |
| Stage 5 | **AI 偏好学习** | 自动 profiling 风险偏好、投资理念 | 高 |

**重新评估"底部悬浮 AI"的条件**（不进 ADR）：
- AI 周活 > 30%（说明高频值得更高优先级）
- 或 Pro 用户专属 UI 布局（差异化付费）

---

## 十一、订阅体系时间线

| Stage | 订阅状态 | 说明 |
|:---|:---|:---|
| Stage 1-2 | 未上线 | 全免费 |
| Stage 3 | **订阅体系上线**（Free / Pro / Pro+）| 自己买首单；Pro 解锁部分 Insights / 多组合上限 |
| Stage 4 | 订阅 + 退款流程稳定 | 配合种子用户付费验证 |
| Stage 5 | App Store 内购 + 国内安卓订阅 | StoreKit / Google Play Billing；国内独立支付推 V1.5+ |

---

## 十二、商业化与合规时间线

| Stage | 合规 / 商业化进展 |
|:---|:---|
| Stage 0 | 注册 Apple Developer / Supabase / Vercel / Tushare 等账号 |
| Stage 3 | 订阅体系上线（个人账户即可，未注册公司）|
| Stage 4 末 | 决策：是否启动公司主体注册（依据：种子用户反馈深度）|
| Stage 5 初 | 隐私政策 / 用户协议正式版（律师过目）+ ICP 备案启动（30-60 天）|
| Stage 5 中 | App Store 中国区 + 海外提审；国内安卓五大商店 |
| Stage 5 末 | 软件著作权（30 天）+ PIPL 个人信息处理清单 |

**合规铁律**：App Store 类目选「效率工具」或「记账」，**绝不选「金融」**

---

## 十三、本 Roadmap 的修订规则

- 任何 Stage 范围调整必须**同步**更新本文件、`development-plan.md`、`information-architecture.md`、`user-journeys.md` 四份
- 单 Stage 内功能优先级调整（P0 ↔ P1）只改 dev-plan，不改本文件
- 新加 Journey 必须在本文件 §四-八对应 Stage 找到归属，否则需先调整 roadmap
- 跨 Stage 重大架构变更（如换技术栈、换 BaaS）必须新立 ADR，并在本文件 §九更新里程碑
