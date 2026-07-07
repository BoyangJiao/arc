# Stage 3 路线图 — MVP-1 自用版

- **Status**: Accepted — 3 modifications + 5 tactical decisions locked (BoyangJiao approved 2026-05-19)
- **Author**: Claude Opus 4.7 (draft) + BoyangJiao (review)
- **Scope**: 不是一个 feature spec —— 是 Stage 3 全部 P0/P1/P2 工作项的**依赖排序 + 模型路由 + 风险登记**。每个具体 feature 自己再写 `.specify/feature-specs/stage-3/<name>-stage-3.md`。
- **目标**: 在 Stage 2 已交付的"骨架 + Daily Snapshot + Watchlist + Rebalance + Welcome"基础上，完成 MVP-1 —— **你自己每天能用、能管理真实持仓**。
- **预算**: 60-100h，8-10 周（兼职 6-12h/周）。
- **来源**: 内容主体取自 `docs/development-plan.md §Stage 3`，本文件加序、加路由、加风险、加 spec 落点。

---

## 一、Stage 3 的"DoD 验证条件"（按发展计划复述）

- 你的所有真实持仓全录入，组合视图准确反映你的实际净资产
- 自用 ≥ 4 周，期间至少修复 3 个自己发现的 bug
- TWR 数字与雪球 / 同花顺误差 < 1%（抽 3 个标的验证）

---

## 二、Block 划分（按依赖顺序，不是按重要性）

依赖图（Stage 2 ✅ 上面，Stage 3 在下面）：

```
                ┌─ Stage 2 main ✅ ─┐
                │  - Finnhub US      │
                │  - CASH adapter    │
                │  - PriceAdapter API│
                └────────┬───────────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
        Block A     Block B     Block C
        多市场       多组合      详情页/图表
        adapters    管理         基础 UI
              │          │          │
              └──────────┼──────────┘
                         ▼
                     Block D
                     算法层
                     (TWR / PA / Drawdown)
                         │
                         ▼
                     Block E
                     polish + 上架前
                     (订阅 / AI 占位 / Inbox)
                         │
                         ▼
                     Block F
                     CSV 进出 + P2
```

---

## 三、Block 详解

### Block A — 多市场 adapters（基础设施层）

**为什么先做**：所有下游 feature（详情页、持仓表、TWR、Performance Attribution）都假设你有 A 股 / 港股 / 基金 / 加密的真实数据。adapter 不就位，下游全部走 fixture——和 Stage 1 的 mock 时代没区别。

**包含**：

| 任务                                                                                                                           | 路由     | spec 落点                              |
| :----------------------------------------------------------------------------------------------------------------------------- | :------- | :------------------------------------- |
| **Tushare Pro adapter (CN + HK + FUND)** — 免费版打通；付费版评估推到后续                                                      | Sonnet   | `tushare-adapter-stage-3.md`           |
| CoinGecko adapter (CRYPTO)                                                                                                     | Sonnet   | `coingecko-adapter-stage-3.md`         |
| Registry 多市场路由（按 `Asset.market`）                                                                                       | Sonnet   | `tushare-adapter-stage-3.md` §registry |
| ADR 011 — 多数据源 fallback / 故障转移策略 + **AKShare 候补集成方案**（自建 HTTP wrapper service 或 serverless）+ 法务地图复审 | **Opus** | ADR direct                             |

**Stage 2 锚点**：Finnhub adapter 是参照模板（`fetcher` 注入、`RateLimitError` / `NotFoundError` 错误类、`searchSymbols` optional）。

**放弃项**（2026-05-19 决定）：

- ~~天天基金 NAV adapter~~ —— 反爬 + 字段不稳，由 Tushare Pro FUND 接口替代；AKShare 作为基金 NAV 补全候补
- AKShare 推迟到 ADR 011 一并讨论 —— Python 库无 TS 直连，需自建 HTTP wrapper service / serverless function，附法务地图（`docs/legal-risk-map.md`）复审

**估时**: ~12-15h（2 adapter × 3-5h + 路由整合 + ADR 011 起草；天天基金路径砍掉省 3-5h）

---

### Block B — 多组合管理（数据模型层）

**为什么紧随 A**：你录真实持仓时不会都堆在一个 portfolio 里——A 股 / 港股 / 美股 / 加密通常分开放。再平衡也是按 portfolio 走的。多组合是数据模型层就要支持的。

**包含**：

| 任务                                                                      | 路由   | spec 落点                    |
| :------------------------------------------------------------------------ | :----- | :--------------------------- |
| Portfolios CRUD UI (`/me/portfolios` + 新建 modal)                        | Sonnet | `multi-portfolio-stage-3.md` |
| 顶栏 portfolio switcher                                                   | Sonnet | 同上                         |
| 归档 / 重命名 / 删除（含交易级 CASCADE 防误删）                           | Sonnet | 同上                         |
| 默认 portfolio 概念保留（Welcome 流程 + first signin trigger 已经基于此） | —      | 不动，验证不破即可           |

**Stage 2 锚点**: `useEnsureDefaultPortfolio` + `resolvePortfolioDisplayName` 已存在；扩展即可。

**估时**: ~8-12h

---

### Block C — 详情页 + 图表（视图层）

**为什么并行**：A/B 完成后这块就是"接 adapter + 出 UI"，路径成熟。**2026-05-19 决定**：全部图表走 **HeroUI Native Pro chart 组件**（已经核实 Pro 提供 `line-chart` / `area-chart` / `bar-chart` / `chart-crosshair` / `chart-indicator`，覆盖 Stage 3 全部时段图表需求）—— 去掉之前规划的 "Web Recharts + RN Victory Native 双实现"负担。

**包含**：

| 任务                                                         | 路由   | spec 落点                              | 图表底层                                                                           |
| :----------------------------------------------------------- | :----- | :------------------------------------- | :--------------------------------------------------------------------------------- |
| 持仓表（原始 + 报告币种双列；按市场分组；tap 进详情）        | Sonnet | `holdings-table-stage-3.md`            | —                                                                                  |
| `/asset/[id]` 资产详情页                                     | Sonnet | `asset-detail-stage-3.md`              | Pro `line-chart` + `chart-crosshair` + `chart-indicator`                           |
| 多时间段图表（1H / 1D / 1W / 1M / YTD / 1Y / ALL）           | Sonnet | `time-range-chart-stage-3.md`          | Pro `line-chart`                                                                   |
| Portfolio value-over-time（累计净值）                        | Sonnet | `portfolio-value-chart-stage-3.md`     | Pro `area-chart`（渐变填充）                                                       |
| 资产配置环形图                                               | Sonnet | `allocation-donut-stage-3.md`          | **保留 react-native-svg 自绘**（Pro 无 donut；参照 Stage 2 `DeviationDonut` 实现） |
| 今日变动指标（持仓行级别，Daily Snapshot 的 per-asset 视图） | Sonnet | `holdings-table-stage-3.md` §daily-row | —                                                                                  |
| Markets Tab 分类浏览 segmented control (P1)                  | Sonnet | optional                               | —                                                                                  |

**纪律提示**：HeroUI Pro chart 组件必须走 **subpath import**（`heroui-native-pro/line-chart` 等），不能从顶层包导（chart-indicator 依赖 skia，顶层 import 会被 Metro 贪婪解析失败）。`@arc/ui/charts/` 重新封装一层，业务侧依然只 `import { LineChart } from '@arc/ui'`。

**Stage 2 锚点**:

- `DeviationDonut`（react-native-svg 自绘）→ `AllocationDonut` 可直接参照
- 已有 Pro 组件 subpath import 模式（EmptyState / NumberStepper）— 加 chart 是同款

**估时**: ~12-15h（含图表 wrapper 封装 + 详情页静态版本；省下双实现成本 3-5h）

---

### Block D — 算法层（**Opus 主场**）

**为什么放到 A/B/C 后面**：算法依赖**真实多市场 + 多组合**的数据形态做 property tests。如果只有 fixture，property test 的覆盖面只是 mock 自己。

**包含**：

| 任务                                                   | 路由     | spec 落点                            |
| :----------------------------------------------------- | :------- | :----------------------------------- |
| **TWR / MWR 收益率** + 时间区间切换                    | **Opus** | `twr-stage-3.md`                     |
| **Performance Attribution**（哪些资产贡献了今年收益）  | **Opus** | `performance-attribution-stage-3.md` |
| **Drawdown 分析**                                      | **Opus** | `drawdown-stage-3.md`                |
| TWR property tests（与雪球抽样误差 < 1% 是验收硬指标） | **Opus** | 同上                                 |

**风险**: TWR / MWR 在跨货币 + cash flow + dividend reinvestment 场景下不变性极多——需要 ≥ 20 个 property test 覆盖（vs J9 rebalance 的 26 个，参照量）。

**估时**: ~20-25h（含 spec + 算法 + tests + UI 接入）

---

### Block E — 上架前体验 polish

**包含**：

| 任务                                                                    | 路由                      | spec 落点                       |
| :---------------------------------------------------------------------- | :------------------------ | :------------------------------ |
| 顶栏右上 **AI 图标点亮**（占位 + 预设 Q&A，**不接 LLM**）               | Sonnet                    | `ai-placeholder-stage-3.md`     |
| **Me / Inbox 子页**（价格异动 / cron 提醒触发记录，Revolut 范式）       | Sonnet                    | `inbox-stage-3.md`              |
| **订阅体系**（Free / Pro / Pro+ 三档；Stage 3 仅占位 + 文案，不接支付） | Sonnet + Opus（计价策略） | `subscription-tiers-stage-3.md` |
| 数字脱敏开关（`<RedactedNumber>`，ADR 003 v3.1 §决策八）                | Sonnet                    | `redacted-number-stage-3.md`    |
| 价格异动提醒（推送 + 邮件）                                             | Sonnet + Opus（阈值算法） | `price-alerts-stage-3.md`       |

**估时**: ~10-15h

---

### Block F — CSV 进出 + P2 收尾

| 任务                              | 路由                                 | spec 落点                 |
| :-------------------------------- | :----------------------------------- | :------------------------ |
| CSV 导出（备份；Me 入口）         | Sonnet                               | `csv-export-stage-3.md`   |
| **CSV 导入**（Stage 2 下放）      | Sonnet                               | `csv-import-stage-3.md`   |
| 多账户标签（券商 / 钱包，仅展示） | Haiku                                | optional                  |
| 历史净值导出 PDF                  | Haiku                                | optional                  |
| 全局搜索 affordance               | Sonnet                               | optional                  |
| 离线本地存储（MMKV）+ 上线时同步  | Sonnet（架构）/ Opus（冲突合并策略） | `offline-sync-stage-3.md` |

**为什么放最后**：CSV 导入历史就是"麻烦但不阻塞自用" —— `scratch your own itch` 原则下，你自己用不上的 P1/P2 优先做主场景，CSV 是 alpha 测试前最后一笔。

**估时**: ~10-15h

---

## 四、推荐执行顺序

```
Week 1-2 : Block A (multi-market adapters)
Week 3   : Block B (multi-portfolio)
Week 4-5 : Block C (holdings table + asset detail + charts)
Week 6-7 : Block D (algorithms — Opus heavy)
Week 8   : Block E (polish + 上架前体验)
Week 9-10: Block F (CSV + P2 + buffer)
```

**节奏**: 兼职 6-12h/周 × 10 周 ≈ 60-120h，命中 development-plan.md 预算 60-100h 的上轨。

---

## 五、模型路由总览

| 类型                      | 工作量占比 | 模型                       |
| :------------------------ | :--------- | :------------------------- |
| Adapter 集成 + Registry   | 25%        | Sonnet（Finnhub 模板成熟） |
| RN 页面 + 组件 + hook     | 35%        | Sonnet                     |
| **算法 + property tests** | **20%**    | **Opus**                   |
| ADR / 数据模型 / 风险决策 | 5%         | Opus                       |
| 文案 / i18n / 小修小补    | 10%        | Haiku                      |
| Buffer / 调试             | 5%         | 视情况                     |

**Opus 触发节点**（Sonnet/Cursor 跑到这里主动叫 Opus）：

1. Block A 末尾的 ADR 011（多源 fallback）
2. Block D 全程
3. 任何 `packages/core/` 的算法 / 数据模型扩展
4. 价格异动阈值算法（Block E）
5. 离线同步冲突合并（Block F）
6. 安全 review（Stage 3 末，上架前）

---

## 六、关键风险登记（Stage 3 开局必须心里有数）

| 风险                                                   | 表现                                                                                                                            | 缓解                                                                                                                     |
| :----------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------- |
| Tushare Pro 积分门槛                                   | 部分接口需要 2000+ 积分，免费账号 100 积分                                                                                      | 注册付费版（¥200/年）或回退到东方财富 / 同花顺非官方接口（合规风险）                                                     |
| 天天基金无官方 API                                     | 反爬 + 字段不稳定                                                                                                               | 接 Tushare 基金 NAV 作主 + 天天基金 fallback；任何爬虫前评估法律风险（参考 `docs/legal-risk-map.md`）                    |
| TWR 与雪球抽样误差 > 1%                                | DoD 不达标                                                                                                                      | property tests 必须覆盖 dividend / split / 跨货币；ADR 提前讨论 IRR (MWR) 还是 TWR 优先                                  |
| CoinGecko 限流（30/分钟，免费）                        | 加密多币种 polling 不够                                                                                                         | 价格走 CoinGecko，FX (USDT 等) 走 Finnhub；BTC/ETH/USDC 限于这几个先                                                     |
| 数据源混用引入估值偏差                                 | 同一时点不同源拿到不同 USD 报价                                                                                                 | ADR 011 锁定**优先级**：股票 → Finnhub/Tushare，加密 → CoinGecko，基金 NAV → Tushare（+ AKShare 候补），FX → Frankfurter |
| 多 portfolio 后 cash 现金分摊（**已决定 2026-05-19**） | 每 portfolio 独立 CASH:USD/CNY/HKD/JPY（J9 数据模型零改动）+ 跨组合"转账"动作生成两笔 transaction（SELL + BUY，币种保持不换汇） | 在 `multi-portfolio-stage-3.md` 里展开实施细节；**不需要新 ADR**；UI 落点 `/me/cash-balances` 加"转账到其他组合"按钮     |
| 上架前 Stage 4 时间紧                                  | 订阅 / 法务文案 / 苹果审核                                                                                                      | Stage 3 末预留 1 周给 Block E polish + 法务初审                                                                          |

---

## 七、Resolved tactical decisions (locked 2026-05-19)

1. **Block D 在 C 之后** — UI 静态版本先 ready，property test 设计基于真实数据形态，验证更踏实
2. **订阅体系 Stage 3 仅占位** — Free/Pro/Pro+ 三档文案 + 价格展示；Apple IAP / Stripe 接入推到 Stage 4
3. **AI 图标 chip preset 路线** — 占位 + 预设 Q&A 按 chip 触发；LLM 接入是 V1.0+ 议题
4. **Inbox 先做空态，价格异动后续填** — Inbox 不阻塞价格异动；价格异动落地后数据自动出现在 Inbox 里
5. **Offline 只做 MMKV 本地缓存读** — 完整双向同步推 Stage 4（与 prod Supabase fork 一起设计）

**Block C 图表底层（新增 2026-05-19 决定）**：

6. **所有图表走 HeroUI Native Pro chart 组件**（`line-chart` / `area-chart` / `bar-chart` / `chart-crosshair` / `chart-indicator`）—— 替换之前规划的 Recharts + Victory Native 双实现。Pro 已经在 react-native-web 兼容；donut 保留 react-native-svg 自绘（Pro 无）。subpath import 纪律照旧。

**Block A 数据源（新增 2026-05-19 决定）**：

7. **CN/HK/FUND 主源 Tushare Pro 免费版** —— 打通流程优先；付费版评估推到后续
8. **AKShare 作为候补 / fallback**，推迟到 ADR 011 一并讨论：自建 HTTP wrapper service 还是 serverless；附法务地图复审
9. **天天基金 NAV adapter 放弃** —— 基金 NAV 由 Tushare Pro FUND 接口主供，AKShare 候补

**Block B 多组合 Cash 现金模型（新增 2026-05-19 决定）**：

10. **每 portfolio 独立现金（J9 数据模型零改动）+ 跨组合"转账"动作** = 两笔 transaction（SELL on source + BUY on dest）
11. **币种保持，不自动换汇** — Portfolio A 转 $5000 USD 到 B，B 收到 USD 5000；换汇是分两步用户主动操作
12. **不允许做空现金** — 表单 inline validation：转出金额 ≤ 源 portfolio 当前 CASH:\* 余额
13. **`notes` 字段标记 transfer** —— `transfer-out-to-{portfolioId}` / `transfer-in-from-{portfolioId}`，方便交易历史识别；Stage 3 P2 可选加 `transfer_group_id` 外键
14. **UI 落点 `/me/cash-balances` 加"转账到其他组合"按钮**，而不是新增独立路由

---

## 八、下一步

1. ✅ 路线图 Status = Accepted（本次会话完成）
2. **新 Opus 会话接力**起 **Block A 第一个 spec**: `.specify/feature-specs/stage-3/tushare-adapter-stage-3.md` —— Sonnet/Cursor 起草，Opus review
3. **用户**：注册 Tushare Pro 账号 + 复读 `docs/legal-risk-map.md`（AKShare 是潜在的法务复审点）
4. Block A 期间持续 commit 到 `dev/stage-3`，每个 adapter 一个 PR

---

## Context bundle

Auto: `pnpm ctx:auto` (agent/hook). Config: `.specify/feature-specs/stage-3/stage-3-roadmap.repomix.json`
