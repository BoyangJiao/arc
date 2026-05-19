# Arc User Journeys

- **状态**: 已接受（v2 — 对齐 IA v2.2 与 dev-plan 新 Stage 编号）
- **更新日期**: 2026-05-10
- **配套**: `docs/information-architecture.md`、`docs/development-plan.md`、`docs/product-roadmap.md`

---

## 一、阅读说明

**Journey vs Flow**：

- **Journey**（本文件）= 用户一个完整意图的端到端经历
- **Flow** = Journey 中的具体页面跳转

**优先级标记**：

- 🟢 P0 = 该 Stage 必须跑通（DoD 依赖）
- 🟡 P1 = 强烈建议
- 🔵 P2 = 看时间
- ⚫ P3 = 推迟

**约束（来自 CLAUDE.md）**：

- 涉及金额展示的步骤默认带"仅供参考，可能延迟"角标
- 任何 journey 都不得出现"建议买入/卖出/应该 ..."等字样
- 处理金额时底层用 `Decimal`，不得 `number`

---

## 二、Stage 1 必须跑通的 Journey（MVP-0 端到端骨架）

### J1🟢 — 首次注册并登录

**触发**：用户第一次打开 Arc

**步骤**：

1. 启动 → 自动重定向到 `/sign-in`
2. 输入邮箱 → tap "发送登录链接"
3. 看到提示："请检查邮箱"
4. 邮箱客户端点链接
5. App 唤起 → Supabase 自动建账户（如未存在）+ 创建 session
6. 跳转 `/(tabs)/index`，Portfolio Tab
7. 后端自动创建一个默认 portfolio `My Portfolio`
8. 列表显示该 portfolio，但内容为"暂无持仓"
9. **Stage 1 不展示欢迎屏**（Stage 2 才加 `/welcome`）

**成功标准**：用户能登录、看到自己的（空）默认组合，无需任何额外操作

---

### J2🟢 — 录入第一笔交易（MVP-0 核心 DoD）

**触发**：J1 完成后，用户想录入持有的 AAPL 头寸

**前置**：已登录，处于 `/(tabs)/index`

**步骤**：

1. tap 默认 portfolio → 进入 `/portfolio/[id]`
2. 看到"暂无持仓，添加你的第一笔资产"
3. tap 右下 FAB → 弹出 Sheet（Stage 1 仅 `手动添加交易` 一项）
4. 选择 → 进入 `/portfolio/[id]/transactions/new` Modal
5. 资产搜索：`AAPL` → 选择 `AAPL — Apple Inc. (NASDAQ:AAPL)`
6. 交易类型：buy（默认，Stage 1 仅 buy）
7. 日期：今天（默认）
8. 数量：`10`
9. 单价：`180.00 USD`（自动带出 Alpha Vantage 实时价为默认建议）
10. 手续费留空
11. tap "保存"
12. Modal 关闭，返回 `/portfolio/[id]`
13. 持仓表显示：`AAPL — 10 股 — $180.00 — $1,800.00 — ¥12,960.00`（按当前 USD/CNY 换算）
14. 顶部总市值：`¥12,960.00`（带"仅供参考，可能延迟"角标）

**成功标准**：

- ✅ 总市值数字与实时 Alpha Vantage + exchangerate.host 数据一致
- ✅ 任何环节使用 Decimal，禁止 number（ESLint 拦）
- ✅ 关闭 Modal 后列表立即刷新（TanStack Query invalidate）

---

### J3🟢 — 切换报告货币验证多币种链路

**触发**：J2 完成后，验证多币种换算正确

**前置**：处于 `/portfolio/[id]`，看到 `¥12,960.00`

**步骤**：

1. 顶栏左上 tap 头像 → 进入 `/me` 全屏页（左滑入）
2. tap "设置" → `/me/settings`
3. 找到"报告货币"，当前 CNY
4. 选择器 → CNY / USD → 选 USD
5. 立即应用
6. 返回 → 切回 Portfolio Tab → `/portfolio/[id]`
7. 总市值变为 `$1,800.00`
8. 持仓表"市值"列从 `¥` 变为 `$`

**成功标准**：

- ✅ 切换瞬时生效
- ✅ 数字精确，无浮点误差累积
- ✅ "单价"列保持 USD 不变（始终显示交易币种），只"市值"列受报告货币影响

---

### J4🟢 — 切换语言验证 i18n 完整性

**触发**：J3 完成后，验证 i18n 全覆盖

**步骤**：

1. `/me/settings` → 语言 → 选英文
2. 立即应用
3. 遍历所有 5 个页面 + 1 Modal + Me 全屏页
4. 验证所有可见文案都是英文，无中文残留，无 `t('xxx.yyy')` 占位

**成功标准**：

- ✅ 全部页面翻译覆盖率 100%
- ✅ 没有硬编码字符串残留（ESLint 拦）

---

### J5🟢 — 切换"红涨绿跌"主题

**触发**：J3/J4 顺路验证

**前置**：portfolio detail 已有持仓 + 今日有正/负变动（可手动改 transaction 时间制造）

**步骤**：

1. `/me/settings` → 涨跌色 → 选"红涨绿跌"
2. 返回 `/portfolio/[id]`
3. 涨幅数字从绿变红，跌幅从红变绿

**成功标准**：

- ✅ Foundation 层颜色不动（`success` 永远绿、`danger` 永远红）
- ✅ Business 层映射切换（`gain` → `danger`，`loss` → `success`）
- ✅ 详见 `docs/adr/003-design-tokens.md` §决策六

---

## 三、Stage 2 必须跑通的 Journey（让 3 Tab 真正跑起来）

### J6🟢 — 首登欢迎屏

**触发**：Stage 2 起，新用户首次完成 J1 后（`user_preferences.has_seen_welcome = false`）

**步骤**：

1. J1 OTP 验证后 → `_layout` 路由门控：prefs settled 且 `hasSeenWelcome === false` → `/welcome`（非 `/(tabs)`）
2. 单屏：Hero + 定位文案 + 免责声明「本工具不构成投资建议」
3. 主 CTA「添加第一笔资产」→ `has_seen_welcome` optimistic 置 true + `router.replace("/(tabs)")`（不预开 FAB / 交易 Modal；用户自行发现 FAB）
4. 页脚「跳过」→ 同上 flip + 进 `/(tabs)`（无额外引导）
5. 冷启动：已看过 → 直接 `/(tabs)`；手敲 `/welcome` 且已看过 → 自动 redirect `/(tabs)`（防御）
6. DB 写入失败（如飞行模式）：仍进 `/(tabs)`；本地 cache optimistic；后台重试；下次启动可能再展示 Welcome（可接受，见 spec AC-4.6）

**DEV**：`welcome:fresh` / `welcome:seen`（App DEV 面板 → Welcome）切换 `has_seen_welcome`；`fresh` 后 **Reload** 验首登路径。

**Stage 5 hook**：`app/welcome.tsx` 保持单文件；多步 carousel 届时可能迁到 `app/(onboarding)/`；`has_seen_welcome` 列与 `_layout` 门控不变。

**成功标准**：

- ✅ 30 秒内能完成
- ✅「跳过」与「添加第一笔资产」均不阻塞核心流程
- ✅ 已看过的用户不再见 Welcome

---

### J7🟢 — Daily Snapshot（用户每天打开 app 的钩子）

**触发**：用户打开 Portfolio Tab

**前置**：已有持仓、24h 前已写入估值快照

**步骤**：

1. 进入 `/(tabs)/index`
2. 顶部 Daily Snapshot 卡片显示：
   - 今日总变动金额（如 `¥+352.20`）
   - 今日总变动百分比（如 `+1.23%`，按 Business token gain/loss 颜色）
   - 涨跌前 3 资产小卡（symbol + 变动幅度）
3. tap 任意资产小卡 → 跳详情（Stage 3 才有，Stage 2 暂时 no-op）

**成功标准**：

- ✅ 数字与"昨日总市值 → 今日总市值"差值一致
- ✅ 跨午夜后正确滚动（用户时区）
- ✅ 涨跌色受用户红涨绿跌偏好影响

---

### J8🟢 — 添加 Watchlist 自选

**触发**：用户想关注几个非持仓的标的

**步骤**：

1. tap Markets Tab → `/(tabs)/markets`
2. 列表为空：引导文案 + "搜索添加自选"按钮
3. tap → `/markets/search` Modal
4. 输入 `NVDA` → 列表展示候选
5. tap NVDA → 加入 Watchlist
6. Modal 关闭 → Markets Tab 列表多一行：`NVDA — Nvidia — 最新价 + 涨跌幅`（旁注：仅供参考，可能延迟）

**成功标准**：

- ✅ Watchlist 持久化（关闭 app 再开仍在）
- ✅ 同一资产不重复添加
- ✅ 报价缓存 TTL 5 分钟：Tab 获焦时若缓存未过期则不发起新请求；下拉刷新强制拉新

---

### J9🟢 — 设置目标配置 + 看偏离度（首次 Rebalance）

**触发**：用户想给 portfolio 设置目标配置

**前置**：已有持仓（含可选现金槽 `CASH:USD` / `CASH:CNY` / `CASH:HKD` / `CASH:JPY`，通过 Settings → 现金余额 或 BUY `CASH:*` @ 单价 1.0 登记）

**步骤**：

1. tap Insights Tab → `/(tabs)/insights`
2. 未设置态：引导 → tap "设置首次目标配置" → `/insights/rebalance/setup` Modal
3. 列出所有当前持仓资产（含已持有的 `CASH:*`）
4. 给每个分配目标百分比（Stage 2 = 数字输入；非拖拽）
5. 必须总和 = 100% ± 0.01（否则保存按钮 disabled）
6. 保存 → 回 `/(tabs)/insights`
7. 看到对比视图：双环图（目标外环 / 当前内环）+ 每资产偏离条
8. 偏离色阶（固定阈值）：|偏离| ≤ 5% → 中性；5% < |偏离| ≤ 10% → `deviation-warning`（黄）；|偏离| > 10% → `deviation-critical`（红）
9. tap "查看再平衡行动单" → `/insights/rebalance/actions`
10. 看到 "份额变化 +5 股 AAPL / -3 股 NVDA" 等（按 |金额| 降序扁平列表，不按买卖分组）

**份额取整（脚注）**：US/CN/HK/FUND → 向下取整至整数股；CRYPTO → 8 位小数；CASH → 2 位小数（JPY 现金 0 位）。

**成功标准**：

- ✅ 文案铁律：永不出现"建议买入"，只说"份额变化 / 偏离目标 / 目标配置"
- ✅ 行动单数字精确（Decimal + 按市场取整）
- ✅ 偏离度颜色正确（Business token）
- ✅ 页脚含「仅供参考，不构成投资建议」

---

### J10🟢 — CSV 导入历史交易

**触发**：用户已经在 Excel 里维护多年记录，想一次导入

**步骤**：

1. Portfolio Tab → tap FAB → Sheet 第 2 项 `导入 CSV`
2. 进入 `/portfolio/[id]/csv-import`
3. 下载提供的模板（含字段说明）
4. 上传文件 → 预览前 10 行 → 校验失败的 row 高亮 + 错误说明
5. 确认 → 导入

**Stage 2 P0 验收**：≥100 行无错误数据 < 10s 导入完成

---

## 四、Stage 3 必须跑通的 Journey（MVP-1 自用版广度扩展）

### J11🟡 — 录入跨市场资产组合

**意图**：用户想把 A股/港股/美股/基金/crypto 真实持仓全部录入

**关键节点**：

- 资产搜索能识别市场前缀（`CN:600519` / `HK:00700` / `US:AAPL` / `FUND:000001` / `CRYPTO:btc`）
- 每个市场的 adapter 都已接入（Tushare / Alpha Vantage / 天天基金 / CoinGecko）
- 多币种汇率链路在所有方向都通

**P0 体验门槛**：

- 同时录入 ≥10 笔交易（覆盖所有 5 个市场）后，portfolio detail 加载 ≤ 2s
- 任何一个 adapter 失败时，单 row 显示 fallback（"价格暂不可用"），不阻塞其他 row

---

### J12🟡 — 多组合 + 配置环形图

**意图**：用户有不同账户（如 401k / 普通券商 / 加密钱包）想分组管理

**步骤**：

1. Portfolio Tab → 滚到列表底部 → tap "+ 新建组合"
2. 输入组合名（如 `401k`）+ 报告货币
3. 进入新组合，添加资产
4. 返回 Portfolio Tab → 顶部"总资产"汇总所有组合
5. 进入任一组合详情 → 顶部多了配置环形图（资产大类分布 + 偏离角标）

---

### J13🟡 — 多时间段图表 + 今日变动

**意图**：用户想看不同时间维度的总市值走势

**步骤**：

1. 进入 `/portfolio/[id]`
2. 顶部图表区域 → 时间段切换：1H / 1D / 1W / 1M / YTD / 1Y / ALL
3. 持仓表每行显示"今日变动"（金额 + 百分比，gain/loss 色）

---

### J14🟡 — TWR 收益率 + Performance Attribution

**意图**：用户想知道自己投资表现，以及哪些资产贡献了大部分收益

**步骤**：

1. 进入 Insights Tab → 收益分析卡片
2. TWR 总收益率 + 时间区间切换
3. Performance Attribution 子卡片："AAPL 贡献了你今年 60% 的涨幅；NVDA 贡献了 -15%"

**关键约束**：TWR 数字与雪球/同花顺误差 < 1%（CLAUDE.md DoD）

---

### J15🟡 — 价格异动推送提醒（落到 Inbox）

**意图**：用户想被提醒"AAPL 跌破 $170"

**步骤**：

1. Markets Tab → tap NVDA → 资产详情 → "添加价格提醒"
2. 设置 "$170 以下"
3. Stage 3 触发后：推送通知 + Me / Inbox 子页留一条
4. tap Inbox 通知 → 跳资产详情

---

### J16🟡 — 一键脱敏（演示模式）

**意图**：用户在公共场合或截图分享时，一键隐藏所有金额数字

**步骤**：

1. `/me/settings` → 顶部"演示模式"开关
2. 开启后：所有 `<RedactedNumber>` 渲染 `••••`
3. 颜色不变（仍 fg-primary / fg-secondary）

**关键**：不需要新增 design token（属组件层逻辑，见 ADR 003 §决策七）

---

## 五、Stage 4 必须跑通的 Journey（MVP-2 闭门测试 + 连接协作）

### J17🟡 — AI 截图识别导入（Stage 4 P0 差异化亮点）

**意图**：用户从支付宝/同花顺/盈透截图直接生成交易记录

**步骤**：

1. Portfolio Tab → FAB → Sheet "🎯 AI 截图识别导入"
2. 选择截图（相册或拍照）
3. AI 解析 → 预览生成的交易列表
4. 确认 → 批量导入

**P0 验收**：3 种主流截图（支付宝 / 同花顺 / 盈透）准确率 ≥90%

---

### J18🟡 — 连接券商账户（只读）

**意图**：用户想自动同步真实持仓数据

**步骤**：FAB → Sheet "连接券商" → 选择券商 → OAuth 授权 → 自动拉持仓

---

### J19🟡 — 家庭协作

**意图**：用户和家人共享一个组合（如夫妻共同账户）

**步骤**：Me → 家庭协作 → 邀请成员 → 设置权限（只读 / 编辑）→ 对方接受

---

### J20🟡 — "Why is it moving?"（AI 上下文解读）

**意图**：用户在资产详情页问 AI："为什么今天 AAPL 跌了？"

**步骤**：

1. 资产详情顶部"✨ Why is it moving?"卡片
2. tap → 顶栏 AI 抽屉打开（已携带资产上下文）
3. AI 流式回答（基于今日新闻 + 财报数据）

---

## 六、Stage 5 必须跑通的 Journey（V1.0 公开发布 + AI 深度）

### J21🟡 — AI 组合体检报告

**意图**：用户想要一份专业的组合健康度分析

**步骤**：Insights Tab → "生成 AI 组合体检报告" → AI 生成长文（含图表）→ 可导出 PDF

---

### J22⚫ — 完整 onboarding（多步引导）

**意图**：公开发布后，新用户需要更系统的入门

**步骤**：3-5 屏教学 → 创建组合 → 添加首个资产 → 设置目标配置 → 进入主界面

---

### J23⚫ — 订阅 Pro 解锁高级功能

**步骤**：Me → 订阅 → Free / Pro / Pro+ 对比 → StoreKit / Google Play Billing 完成支付

---

## 七、Journey 与 Stage DoD 的对应

| Stage   | DoD 核心要求                              | 对应 Journey           |
| :------ | :---------------------------------------- | :--------------------- |
| Stage 1 | "录入一笔 AAPL → 看到 CNY 计价"           | J1 + J2 + J3           |
| Stage 1 | "切换语言无未翻译"                        | J4                     |
| Stage 1 | "切换红涨绿跌"                            | J5                     |
| Stage 2 | "Daily Snapshot 真实反映今日变动"         | J7 ✅                  |
| Stage 2 | "Watchlist 持久化"                        | J8 ✅                  |
| Stage 2 | "首次 Rebalance 跑通行动单"               | J9 ✅                  |
| Stage 2 | "首登欢迎屏一次性展示"                    | J6 ✅                  |
| Stage 3 | "CSV 100 行 <10s"                         | J10（自 Stage 2 下放） |
| Stage 3 | "所有真实持仓录入 + TWR 误差 <1%"         | J11 + J14              |
| Stage 3 | "多组合 + 配置环形图"                     | J12 + J13              |
| Stage 4 | "AI 截图识别 ≥90%"                        | J17                    |
| Stage 4 | "AI 接入 LLM"                             | J20                    |
| Stage 5 | "App Store 上架 + Pro 首单 + AI 报告稳定" | J21 + J22 + J23        |

---

## 八、未决 / 待 review 时拍板

- [ ] J7 涨跌前 3 是按金额变动还是百分比变动排？（建议：百分比，避免大持仓总主导）
- [ ] J9 首次设置时，目标配置粒度按"单资产"还是"资产大类"？（建议：先单资产，Stage 3 加大类）
- [ ] J17 AI 截图识别用 OCR + LLM 还是纯多模态 LLM？（成本 / 准确率 trade-off，Stage 4 才决）
- [ ] 是否要为每个 Journey 写 e2e 测试？（建议 Stage 4 末再补，前期手动验）
