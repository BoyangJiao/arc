# Arc — Polish Backlog

> **Block E / F 实施起手时必读**。这条 backlog 收集 Stage 3 各 Block UAT / Opus review 期间识别但**不阻塞当 Block** 的 polish 项，按目标 Block 分桶。
>
> **谁来读**：
>
> - Block E (订阅 / Inbox / AI / 脱敏 / 价格异动) 起手 — 扫 §Block E 桶
> - Block F1 (UX flow redesign sprint) 起手 — 扫 §Block F1 桶（最多项）
> - Block F2 (CSV + 视觉打磨) 起手 — 扫 §Block F2 桶
> - Stage 4 (上架前) 起手 — 扫 §Stage 4 桶
>
> **怎么用**：每个 item 标了来源 + 是否阻塞 DoD。F1 sprint 设计稿覆盖到的 → 走 redesign；没覆盖的 → 单点 polish commit。
>
> **怎么维护**：Opus / Cursor / User 任一识别新 polish item，按 "Block / 来源 / 影响 / fix 方案" 4 字段加进对应桶。**不要**直接修当前 Block 范围外的代码。

---

## Block E 桶 — 占位 features sprint（roadmap §Block E）

### withFallback `searchSymbols` 路径加 observability log

- **来源**: Opus review 2026-05-25 — Block C commit `08e86f3` review §P2
- **现状**: [`packages/data-sources/src/adapters/with-fallback.ts:69-86`](../packages/data-sources/src/adapters/with-fallback.ts#L69-L86) — `searchSymbols` 在 NotImpl/error fallback 到 secondary 时**没**走 `wrap` helper 的 `console.warn` 路径
- **影响**: NotImpl → secondary 静默切换 → fallback 路径无可观测性 → bug 时难以诊断
- **fix 方案**: Block E 接 Sentry breadcrumb 时统一在 `searchSymbols` fallback 加 `console.warn({primary, secondary, reason: err.name})` —— 与 `wrap` helper 同模式
- **影响 DoD**: ❌ 不影响

---

## Block F1 桶 — UX flow redesign sprint（roadmap §Block F1 — 设计稿 + flow 重构）

### Tx Entry 日期输入换 DatePicker

- **来源**: Opus review 2026-05-21 — Block C commit `251fc11` review §P1（Spec deviation）
- **现状**: [`apps/mobile/app/portfolio/[id]/transactions/new.tsx:316-326`](../apps/mobile/app/portfolio/[id]/transactions/new.tsx#L316-L326) — `tradeDate` 用 `<Input value placeholder="YYYY-MM-DD">` + 正则校验
- **影响**: 用户手打日期容易错；移动键盘不是 date picker
- **Spec deviation**: 违反 `holdings-and-transactions-stage-3.md` §决策 8 写的 "HeroUI Pro DatePicker"
- **fix 方案**: F1 redesign 换 `heroui-native-pro/date-picker` 或 native date input；同步更新 spec §决策 8 状态
- **影响 DoD**: ❌ 不影响

### Tx Entry prefill `name` 透传

- **来源**: Opus review 2026-05-21 — Block C commit `251fc11` review §P3
- **现状**: [`apps/mobile/app/portfolio/[id]/transactions/new.tsx:90`](../apps/mobile/app/portfolio/[id]/transactions/new.tsx#L90) — 从 asset detail 跳进来时 `name: prefillSymbol`（即用 ticker 当 name）
- **影响**: 表单顶部显示 "AAPL (US:AAPL)" 而非 "Apple Inc. (US:AAPL)"
- **fix 方案**: asset detail page → tx entry 跳转时把 name 也放进 query `?prefillName=Apple+Inc.`；entry form 优先用 query name，缺省 fallback symbol
- **影响 DoD**: ❌ 不影响

### PortfolioSwitcher Dialog → BottomSheet

- **来源**: 上下文 review 2026-05-21 — 用户提到 Block B 完成后看到 PortfolioSwitcher 用 Dialog 弹下拉视觉重
- **现状**: [`apps/mobile/src/components/PortfolioSwitcher.tsx`](../apps/mobile/src/components/PortfolioSwitcher.tsx) 用 Dialog
- **影响**: 切换 portfolio 是高频操作，Dialog 半屏遮挡感重
- **fix 方案**: 换 `@gorhom/bottom-sheet`（ADR 006 wrappers 已有），半屏 sheet 视觉更轻；保留键盘 a11y
- **影响 DoD**: ❌ 不影响

### Portfolio Rename Alert.prompt → Sheet input

- **来源**: 上下文 review 2026-05-21
- **现状**: `/me/portfolios` 长按重命名走 `Alert.prompt`（iOS only）
- **影响**: Android 不兼容 + 输入体验差
- **fix 方案**: 换 Sheet + TextField 组合，跨平台一致
- **影响 DoD**: ❌ 不影响

### Insights Tab 整体 flow redesign

- **来源**: 用户 2026-05-21 反馈 + Delta 截图参考
- **现状**: 卡片 per-portfolio 模式（决策 7 落地）+ "贡献分析 / 跨组合再平衡" 占位
- **影响**: 单 portfolio 用户卡片密度低；多 portfolio 用户跨卡比较难
- **fix 方案**: F1 设计稿覆盖；可能引入 segment "all portfolios / per portfolio" + 横向资产排行
- **影响 DoD**: ❌ 不影响

### Block C 期间累积的杂项 UX 痛点（用户 UAT log）

- **来源**: Block C UAT 期间 Cursor 已修一部分（Portfolio hero polish `7c7755b` / Typography tokens `2c20863` / Soft-foreground bridge `8adf16f` / Daily snapshot card `f4d34b6`）；剩余痛点待 F1 设计稿一次性梳理
- **fix 方案**: 用户在 F1 sprint 起手前 review 现 Block C UI，列出剩余痛点

---

## Block F2 桶 — CSV + 视觉细节打磨（roadmap §Block F2）

### 文案铁律全 audit

- **来源**: Constitution `forbidden UX phrases` 列表
- **fix 方案**: F2 起手前 grep 全代码库 + i18n 文件，确认无 "建议买卖" "推荐" "保障收益" 等禁词
- **影响 DoD**: ✅ Stage 4 上架硬条件

### 价格旁 "仅供参考，可能延迟" 标识 audit

- **来源**: Constitution §forbidden phrases / `docs/legal-risk-map.md` L8
- **fix 方案**: 所有显示 price/NAV 的位置 audit，确保配此标识；未来新加 price 屏自动覆盖（component 内嵌）
- **影响 DoD**: ✅ Stage 4 上架硬条件

### Expo Router typed routes 收口

- **来源**: Opus review 2026-05-21 — Block C tx entry §P3
- **现状**: `router.replace("/(tabs)" as Href)` 用 cast 而非 typed path
- **fix 方案**: F2 视觉打磨期间全 grep `as Href` + cast，收口 typed routes
- **影响 DoD**: ❌ 不影响

### i18n typed key narrowing

- **来源**: Opus review 2026-05-21 — Block C tx entry §P3
- **现状**: `t(\`holdings.markets.${m}\` as "holdings.markets.US")` 临时 hack
- **fix 方案**: i18n schema 进化支持 union key（`holdings.markets.${Market}`）；如果 @arc/i18n 没该能力，留 hack
- **影响 DoD**: ❌ 不影响

---

## Stage 4 桶 — 上架前 / 公开发布 hardening

### TWR 跨币种 cash flow 走历史 FX 换算

- **来源**: Opus review 2026-05-25 — Block D Phase 1 commit `e2399c4` review §Spec deviation
- **现状**: [`packages/core/src/returns/twr.ts:179`](../packages/core/src/returns/twr.ts#L179) 简化为 same-currency only filter，跨币种 CASH:\* 当内部购买
- **影响**: Stage 3 自用 OK（用户自己手动录 currency conversion 两笔）；**Stage 4 公开**用户可能直接跳 conversion 步骤，TWR 偏差
- **fix 方案**:
  1. spec §决策 4 amend 为 "Stage 3 same-currency filter；Stage 4 加历史 FX 换算"
  2. Stage 4 起 `valueAt` callback 在跨币种 CF 时调 `fxAt(from, to, eventDate)` 换算到 reporting currency
  3. 新增 property test 覆盖跨币种 CF 路径
- **影响 DoD**: ❌ Stage 3 不影响；Stage 4 ✅ 必修

### ADR 012 P2/P3 大陆 BFF 实施

- **来源**: ADR 012 决策二 P1 / P2 + 附录 A.1-A.6 列表
- **fix 方案**: Stage 4 起 `auth-cn-spec.md`（一号一绑 + 注销策略）+ `services/auth-bff/` Vercel/Cloudflare 部署 + 微信/短信 SDK 接入
- **影响 DoD**: ✅ Stage 4 大陆上架硬条件

### AKShare wrapper Stage 4 sunset 评估

- **来源**: ADR 011 §决策四 Phase 3 + `docs/legal-risk-map.md` L3
- **fix 方案**: Stage 4 公开前律师复审 AKShare 底层 TOS；决议 撤除 / 替换 / 商业授权 三选一
- **影响 DoD**: ✅ Stage 4 公开发布硬条件

### `forbidden UX phrases` 自动化 lint

- **来源**: Constitution §文案铁律
- **fix 方案**: ESLint rule 扫 i18n 文件 + JSX `<Text>` 内联文本，命中禁词 fail
- **影响 DoD**: ✅ Stage 4 上架前 nice to have

---

## 全量打磨桶 — 2026-07 screen-map 基线发现（dev/ux-polish 打磨阶段主战场）

> 来源标 `screen-map baseline` = 33 屏截图基线 / Atlas 云测试 / viewer Flows 视角发现。
> 基线：`docs/screen-map/before-polish-2026-07-17/`；viewer：`pnpm screenmap:open`。

### ~~首页周期涨跌币种混算（-\$225,903 (77.95%)）~~

- **来源**: screen-map baseline 2026-07-17 首页截图 → 精确复算定位
- **根因**: chart series 直接用快照 totalValue（CNY），Hero live 值用显示币种（USD）→ 两种单位相减
- **Resolved**: `4dbc6f4` 2026-07-17 — `snapshotsCurrencyMismatch` 守卫强制 True-Historical bootstrap；+4 单测 + 模拟器实拍验证

### 再平衡行动单/setup 空态过空

- **来源**: viewer Flows「再平衡 (J9)」泳道 — 行动单页在未设目标配置时近乎全白，setup 页 0% 环无引导
- **影响**: 高价值功能的第一触点是一面白墙；违背三态审计「空态给出路」的既有标准
- **fix 方案**: actions 空态给「先设定目标配置」引导卡 + CTA；setup 0% 态加说明文案/示例
- **影响 DoD**: ❌ 不影响

### active portfolio 解析疑似不一致

- **来源**: Atlas 云测试 2026-07-17 — 同 Clean 账号部分会话见空组合（portfolio_empty_state 入图），insights-overview 测试因此失败
- **fix 方案**: 复现 → 查 `resolve-active-portfolio` + 默认组合自愈逻辑的排序稳定性；Revyl 报告有录像
- **影响 DoD**: ❌（若确认高频则升级）

### transaction-flow 删除路径云测试未走通

- **来源**: Atlas 云测试 2026-07-17 — AI 找不到刚建仓的 600519 完成删除
- **fix 方案**: 人工复现判定 app bug（列表刷新/滚动定位）vs 测试措辞问题
- **影响 DoD**: ❌

### 3M/1Y 范围超出数据史时的周期语义

- **来源**: screen-map baseline — 「过去 3 个月」实际基线是 30 天前首笔建仓日（更早为空仓 0）
- **影响**: 文案说 3 个月、数字算的是建仓以来；用户可能误读
- **fix 方案**: 讨论项 — 空仓段是否该计入（现符合 ADR 014 阶跃语义）；或 label 动态改「建仓以来」
- **影响 DoD**: ❌（先讨论后动）

---

## 元信息

- **建立日期**: 2026-05-25 by Claude Opus 4.7
- **覆盖范围**: Stage 3 Block A/B/C/D Phase 1 期间识别的所有 polish item
- **更新规则**: 任一 review session 新发现 polish item → 直接 append 到对应桶 + 标 source commit + DoD 影响
- **删除规则**: item 实施完成（commit landed）→ 在该 item 下方加 `**Resolved**: <commit-sha> <date>` 一行 + 保留 history（不直接删，方便追溯）
