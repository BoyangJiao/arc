# Arc 用户场景 Roadmap（User Journeys）

- **状态**: 初稿（待 review）
- **更新日期**: 2026-05-07
- **作者**: BoyangJiao + Claude
- **配套**: `docs/information-architecture.md`（页面树），`docs/development-plan.md` §Stage 拆解

---

## 一、阅读说明

**Journey vs Flow**：
- **Journey**（本文件）= 用户一个完整意图的端到端经历（"我想录入第一笔交易"）
- **Flow** = Journey 中的具体页面跳转（"sign-in → portfolio list → detail → modal → save"）

**优先级标记**：
- 🟢 P0 = Stage 1 必须跑通（MVP-0 端到端验收依赖）
- 🟡 P1 = Stage 2 P0 必须跑通
- 🔵 P2 = Stage 2 P1+
- ⚫ P3 = Stage 3+

**约束（来自 CLAUDE.md）**：
- 每个 journey 涉及金额展示的步骤都默认带"仅供参考，可能延迟"角标
- 任何 journey 都不得出现"建议买入/卖出/应该 ..."等字样
- 任何 journey 处理金额时底层用 `Decimal`，不得 `number`

---

## 二、Stage 1 必须跑通的 Journey

### J1🟢 — 首次注册并登录

**触发**：用户第一次打开 Arc

**步骤**：
1. 启动 → 自动重定向到 `/sign-in`
2. 输入邮箱 → tap "发送登录链接"
3. 看到提示："请检查邮箱"
4. 在邮箱客户端点击链接
5. App 唤起 → Supabase 自动建账户（如未存在）+ 创建 session
6. 跳转 `/(tabs)/index`，Portfolio list 为空
7. 后端自动创建一个默认 portfolio（如 `Boyang's Portfolio`）
8. 列表显示该 portfolio，但内容为"暂无持仓"

**成功标准**：用户能登录、看到自己的（空）默认组合，无需任何额外操作

**未决**：
- 邮件里的 link 是否能 deep link 直接唤起 native app？（Stage 1 简化：MVP 只验证 Web 端流程，native 端的 deep link 配置可推到 Stage 2）

---

### J2🟢 — 录入第一笔交易（MVP-0 核心 DoD）

**触发**：J1 完成后，用户想录入持有的 AAPL 头寸

**前置**：已登录，处于 `/(tabs)/index`

**步骤**：
1. tap 默认 portfolio → 进入 `/portfolio/[id]`
2. 看到"暂无持仓，添加你的第一笔资产"
3. tap 右上角 `+` → 弹出 `/portfolio/[id]/transactions/new` Modal
4. 输入资产搜索：`AAPL`
5. 选择 `AAPL — Apple Inc. (NASDAQ:AAPL)`
6. 选择交易类型：buy（默认）
7. 选择交易日期：今天（默认）
8. 输入数量：`10`
9. 输入单价：`180.00 USD`（自动带出 Alpha Vantage 实时价作为默认建议）
10. 手续费留空
11. tap "保存"
12. Modal 关闭，返回 `/portfolio/[id]`
13. 持仓表显示一行：`AAPL — 10 股 — $180.00 — $1,800.00 — ¥12,960.00`（按当前 USD/CNY 7.20 换算）
14. 顶部总市值：`¥12,960.00`（带"仅供参考，可能延迟"角标）

**成功标准**：
- ✅ 总市值数字与实时 Alpha Vantage 价 + exchangerate.host 汇率匹配
- ✅ 任何环节使用 Decimal，禁止 number（会被 ESLint 拦）
- ✅ 关闭 Modal 后列表立即刷新（不需要手动 pull-to-refresh）

---

### J3🟢 — 切换报告货币验证多币种链路

**触发**：J2 完成后，验证多币种换算正确

**前置**：处于 `/portfolio/[id]`，看到 `¥12,960.00`

**步骤**：
1. 切到 Settings tab → `/(tabs)/settings`
2. 找到"报告货币"设置项，当前为 CNY
3. tap → 弹出选择器：CNY / USD
4. 选择 USD
5. 立即应用（无需返回）
6. 切回 Portfolio tab → `/portfolio/[id]`
7. 总市值变为 `$1,800.00`
8. 持仓表的"市值"列从 `¥` 变为 `$`

**成功标准**：
- ✅ 切换瞬时生效（TanStack Query cache invalidate 链路通畅）
- ✅ 数字精确（USD ↔ CNY 双向换算，不出现浮点误差累积）
- ✅ 原始币种"单价"列不变（始终显示交易币种 USD），只有"市值"列受报告货币影响

---

### J4🟢 — 切换语言验证 i18n 完整性

**触发**：J3 完成后，验证 i18n 全覆盖

**前置**：任意页面（建议 `/portfolio/[id]`）

**步骤**：
1. Settings → 语言 → 选英文
2. 立即应用
3. 遍历所有 5 个页面 + 1 个 Modal
4. 验证：所有可见文案都是英文，无中文残留，无 `t('xxx.yyy')` 这种未翻译占位

**成功标准**：
- ✅ 全部 5 个页面 + 1 个 Modal 翻译覆盖率 100%
- ✅ 没有硬编码字符串残留（每次构建跑 ESLint 自定义规则拦）

---

### J5🟢 — 切换"红涨绿跌"主题

**触发**：J3/J4 顺路验证

**前置**：当 portfolio detail 已经有持仓 + 今日有正/负变动时（可手动改 transaction 时间制造）

**步骤**：
1. Settings → 涨跌色 → 选"红涨绿跌"
2. 返回 `/portfolio/[id]`
3. 涨幅数字从绿变红，跌幅从红变绿

**成功标准**：
- ✅ Foundation 层颜色不动（`success` 永远绿、`danger` 永远红）
- ✅ Semantic 层映射切换（`gain` → `danger`，`loss` → `success`）
- ✅ 详见 `docs/adr/003-design-tokens.md` 的红涨绿跌切换章节

---

## 三、Stage 2 P0 必须跑通的 Journey

### J6🟡 — 录入跨市场资产组合

**意图**：用户想把 A股/港股/美股/基金/crypto 真实持仓全部录入

**关键节点**：
- 资产搜索能识别市场前缀（`CN:600519` / `HK:00700` / `US:AAPL` / `FUND:000001` / `CRYPTO:btc`）
- 每个市场的 adapter 都已接入（Tushare / Alpha Vantage / 天天基金 / CoinGecko）
- 多币种汇率链路在所有方向都通（CNY/HKD/USD/JPY ↔ 报告币种）

**P0 体验门槛**：
- 同时录入 ≥10 笔交易（覆盖所有 5 个市场）后，portfolio detail 加载 ≤ 2s
- 任何一个 adapter 失败时，单 row 显示 fallback（如"价格暂不可用"），不阻塞其他 row

---

### J7🟡 — 设置目标配置 + 看偏离度

**意图**：用户想给 portfolio 设置目标（如美股 50% / A 股 30% / 现金 20%），看自己当前偏离多少

**关键节点**：
- 进入 `/portfolio/[id]/allocation`
- 用 bucket 形式定义目标（每个 bucket 可以 = 一个 asset，也可以 = 一组 asset 标签）
- 总和必须 = 100%
- 保存后回 portfolio detail，顶部多一个"配置环形图 + 偏离度热力"区域
- **文案铁律**：偏离 > 5% 时不说"建议调整"，说"偏离目标配置 X%"

**视觉**：
- 用 Foundation 的 `accent` + `success/warning/danger` 表达偏离程度
- Stage 2 这个页面属于"复杂金融可视化"，按 ADR 003 的协作策略 → 你画 Figma 详细设计稿后我再迭代

---

### J8🟡 — 做一次再平衡决策

**意图**：用户想知道"为了达到目标配置，我各资产需要 ±多少股"

**关键节点**：
- 进入 `/portfolio/[id]/rebalance`（或从 detail 顶部 banner 进入）
- 看到当前 vs 目标对照表
- 每行显示"达到目标配置需要的份额变化为 ±X 股"
- **绝不出现** "建议买入 X 股 / 应该卖出 X 股" 字样

---

### J9🟡 — CSV 导入历史交易

**意图**：用户已经在 Excel 里手动维护多年记录，想一次导入

**关键节点**：
- 进入 `/portfolio/[id]/csv-import`
- 下载提供的模板（市场 / symbol / 日期 / type / 数量 / 单价 / 手续费 / 币种 / 备注）
- 上传文件 → 预览前 10 行 → 校验失败的 row 高亮 + 错误说明 → 确认导入

**P0 验收**：≥100 行无错误数据 < 10s 导入完成

---

### J10🟡 — CSV 导出做备份

**意图**：用户随时能拿到自己的全部数据

**关键节点**：
- Settings → 数据导出 → 选择 portfolio → 下载 CSV

**P0 验收**：导出格式与导入模板互通（导出 → 不修改 → 重新导入应能完全 round-trip）

---

## 四、Stage 2 P1 Journey（择优实施）

### J11🔵 — 价格异动推送提醒

略（详见 `development-plan.md` Stage 2 P1）

### J12🔵 — 一键脱敏开关（演示模式）

**意图**：在公共场合或截图分享时，一键把所有金额数字隐藏成 `••••`

**关键节点**：
- Settings 顶部一个全局开关
- 开启后：所有 `<RedactedNumber>` 组件渲染 `••••`
- 颜色不变（仍用 `foreground` / `muted`），只是字符替换
- **不需要新增 design token**（属组件层逻辑）

### J13🔵 — Watchlist

略

---

## 五、Stage 3+ Journey（仅提及）

| ID | 名称 | 阶段 |
|:---|:---|:---|
| J20⚫ | 首次 onboarding 三步引导 | Stage 3 |
| J21⚫ | 用户反馈渠道 | Stage 3 |
| J22⚫ | 订阅 Pro 解锁高级功能 | Stage 4 |
| J23⚫ | AI 分析"我的组合风险" | Stage 4 P1 |

---

## 六、Journey 与 Stage DoD 的对应

| Stage | DoD 核心要求 | 对应 Journey |
|:---|:---|:---|
| Stage 1 | "录入一笔 AAPL 看到 CNY 计价" | J1 + J2 + J3 |
| Stage 1 | "切换语言无未翻译" | J4 |
| Stage 1 | "TestFlight build 装机" | 不属 journey，属构建 |
| Stage 2 | "所有真实持仓录入" | J6 + J9 |
| Stage 2 | "TWR 与雪球误差 < 1%" | 隐含在 J7/J8 数据准确性 |

---

## 七、未决 / 待你 review 时拍板

- [ ] J1 步骤 7 的"默认 portfolio 名"格式
- [ ] J2 步骤 9 是否默认带 Alpha Vantage 实时价（建议带，节省录入）
- [ ] J5 是否要在 Stage 1 上线（建议上线，零成本）
- [ ] J3 切换货币是否要"动画过渡"（建议无，数字直接跳更显专业）
- [ ] 是否要为每个 journey 写一个 e2e 测试？（建议 Stage 3 末再补，MVP-0 手动验）
