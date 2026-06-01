# Feature: CSV 导出（交易备份）— Stage 3 Block F

- **Status**: Draft — Opus 4.8 (2026-06-01); awaiting BoyangJiao review
- **Author**: Claude Opus 4.8 (draft)
- **Created**: 2026-06-01
- **Implements**: `stage-3-roadmap.md` §三 Block F 第 1 项「CSV 导出（备份；Me 入口）」
- **Conforms to**: `.specify/constitution.md`（Decimal 计算 + 禁忌文案）、`.specify/data-model-invariants.md`（法则 4 币种永不丢失、法则 1 资产 ID 不变）、ADR 006（`@arc/ui` 薄封装铁律）、ADR 007（真实链路不可绕过）
- **Depends on**: `Transaction` domain type（已存在）、Me 页 ListGroup 入口范式（已存在，仿 inbox/subscription 行）、me 子栈 file-based 路由（`/me/export` 自动注册，无需改 `me/_layout.tsx`）。⚠️ 现有 `use-transactions.ts` 仅 **per-portfolio** query → 需新增 all-portfolio query（见 commit 3）
- **Scope（本轮仅导出）**: 显式**不含** CSV 导入（独立 spec `csv-import-stage-3.md`，复杂度高）、离线存储（roadmap 决策 5 推 Stage 4）、PDF 导出 / 多账户标签 / 全局搜索（roadmap optional，本轮不做）
- **Touches**:
  - `apps/mobile` — 新增 `/me/export` 路由 + `me/index.tsx` 入口 + `use-csv-export` hook（或 lib 函数）
  - `apps/mobile/src/lib/` — 新增 `transactions-to-csv.ts`（纯函数，**可单测**）
  - deps — `expo-file-system` + `expo-sharing`（写临时文件 + 调系统分享）
  - `@arc/i18n`（en + zh）— `export.*` 新键
  - **不动**：`@arc/core`（导出是展示层，不碰领域逻辑）、DB / migration（纯读）

---

## Why this feature exists

Stage 3 DoD = "自用 ≥ 4 周 + 真实持仓全录入"。用户把真实交易录进 Arc 后，**数据只活在 Supabase 一处** —— 没有本地备份、无法迁出、无法在表格里自查对账。CSV 导出是 alpha 测试前最小的「数据主权」保障：一键导出全部交易为标准 CSV，用户可存档 / 在 Excel/Numbers 里核对 / 未来导入别的工具。

**为什么是 Block F 第一个做**：纯读 + 纯函数转换 + 系统分享，**无解析容错、无写库、无 migration**，是 Block F 风险最低、自用价值最高的一项（对比 CSV 导入的列映射/校验/错行处理复杂度）。

**目标用户场景**：

- "我想把所有交易导出存到网盘做备份。"
- "我想在 Excel 里核对 Arc 的成本基数和支付宝/券商对账单。"

---

## 决策（待 BoyangJiao confirm）

**决策 1 — 导出范围 = 交易（transactions），非持仓快照**
持仓 = Σ(交易) 派生（数据模型法则 2），导出**原始交易**才是可还原的真备份；持仓是计算结果，不可逆。**决策 1a 待确认**：导出当前 active portfolio 的交易，还是全部 portfolio？建议**全部 portfolio**（含 `portfolioId` 列），一次拿全才是备份语义。

**决策 2 — CSV 列 = Transaction 原始字段，币种永不丢失（法则 4）**
列固定为领域字段，**导出原始币种 + 原始数值**（不预先换算成报告币种 —— 换算是展示层职责，备份要保真）：

```
portfolio_id,portfolio_name,asset_id,type,shares,price_per_share,currency,fee,trade_date,notes
```

- `shares` / `price_per_share` / `fee` 用 **Decimal.toString()**（全精度，不格式化、不千分位、不脱敏）—— 备份要精确可还原。
- `trade_date` 原样输出 ISO 8601（含时区）。
- `asset_id` = `market:symbol`（法则 1，可作未来导入的 join key）。
- `notes` 走 CSV 转义（含逗号/引号/换行 → 双引号包裹 + 引号转义，RFC 4180）。

**决策 3 — 文件名 + 落点**
`arc-transactions-YYYY-MM-DD.csv` 写入 `FileSystem.cacheDirectory`（临时，系统清理），再 `expo-sharing` 调起系统分享面板（存文件 App / AirDrop / 发邮件）。**不**写持久目录、**不**申请额外权限。

**决策 4 — 入口 = Me 页 ListGroup 行**
仿现有 inbox / subscription 行，`/me/export`。点进是一个确认页（说明导出内容 + 「导出」按钮），而非 Me 行直接触发（避免误触 + 给空态/计数反馈空间）。

**决策 5 — 空态 + 大数据量**
无交易 → 导出按钮禁用 + 空态文案。交易量大（数千行）→ 纯字符串拼接在 JS 线程同步完成即可（Stage 3 自用量级无需流式）；若未来量级上来再优化。

**决策 6 — 文案合规**
全程无金额「建议/预期」类文案；导出说明页用中性描述（「导出你的全部交易记录为 CSV 文件」）。CSV 内容是原始数据，不涉及禁忌文案。

---

## User journey (J-F1)

### J-F1a — 导出入口

**Given** 用户在 Me 页
**When** tap「导出数据 / Export data」
**Then** 进入 `/me/export`，显示导出说明（将导出 N 笔交易，跨 M 个组合）+「导出 CSV」按钮

### J-F1b — 执行导出

**Given** 用户在导出页，有 ≥1 笔交易
**When** tap「导出 CSV」
**Then** 生成 CSV → 调起系统分享面板
**And** 用户可选择存文件 / 发送 / AirDrop
**And** 数值为全精度原始值、原始币种，notes 正确转义

### J-F1c — 空态

**Given** 用户无任何交易
**Then** 导出按钮禁用 + 文案「暂无可导出的交易」

---

## Acceptance criteria（UAT）

| AC            | 测什么                                                                                                |
| :------------ | :---------------------------------------------------------------------------------------------------- |
| **S3-AC-F.1** | Me →「导出数据」→ `/me/export`，显示交易/组合计数；返回正常                                           |
| **S3-AC-F.2** | tap 导出 → 系统分享面板弹出；存文件后 CSV 可在 Excel/Numbers 打开                                     |
| **S3-AC-F.3** | CSV 表头 = 决策 2 的 10 列；行数 = 交易总数（全 portfolio）                                           |
| **S3-AC-F.4** | `shares`/`price_per_share`/`fee` 为全精度 Decimal 字符串（非格式化、非脱敏，即使 App 当前处于脱敏态） |
| **S3-AC-F.5** | 原始币种保留（`currency` 列 = 交易币种，未换算成报告币种）                                            |
| **S3-AC-F.6** | `notes` 含逗号/引号/换行 → RFC 4180 转义正确（Excel 打开不错列）                                      |
| **S3-AC-F.7** | 无交易 → 按钮禁用 + 空态；i18n en+zh 齐全 + `lint:copy` 无禁忌词                                      |
| **S3-AC-F.8** | 单测：`transactionsToCsv([...])` 表头/转义/Decimal 全精度/空数组                                      |

---

## Implementation plan（commit chain — 交接 Sonnet）

1. **`chore(mobile): add expo-file-system + expo-sharing`** — 装依赖（用 `npx expo install` 保证 SDK 55 版本对齐）；确认 web/iOS 都能 build。
2. **`feat(mobile): transactions-to-csv pure fn + tests`** — `src/lib/transactions-to-csv.ts`：`transactionsToCsv(rows, {portfolioNameById}) → string`；RFC 4180 转义；Decimal `.toString()` 全精度；header 常量。**单测覆盖 AC.6/AC.8**（转义/空/精度）。**不碰 IO**（纯函数，易测）。
3. **`feat(mobile): use-csv-export hook (fetch all-portfolio tx + write + share)`** — ⚠️ **现有 `useTransactions(portfolioId)` 是 per-portfolio**（`.eq("portfolio_id", …)`），无 all-portfolio query。两条路：(a) 新增 `useAllTransactions()`（按 `user_id` join portfolios 一次拉全，**推荐** —— 备份语义 + 单次查询）；(b) 用 `usePortfolios()` 列表 + 逐个 `useTransactions` 合并（hook 数量动态，不推荐）。选 (a)：新加一个 query，`from("transactions").select(...).in("portfolio_id", <user 的 portfolio ids>)` 或经 RLS 直接按 join 拉。→ 调纯函数 → `FileSystem.writeAsStringAsync(cacheDirectory + filename)` → `Sharing.shareAsync`；错误 → Alert。
4. **`feat(mobile): /me/export screen + Me entry + i18n`** — 说明页（计数 + 按钮 + 空态禁用）；`me/index.tsx` 加入口行；`export.*` en+zh；`/me/export` 走 me 子栈（自动注册，无需改 root `_layout`，因 me 子栈是 file-based）。
5. **`docs(spec+session-state): CSV export complete`** — 标 Accepted + session-state bump。

每 commit 末：`pnpm typecheck` 6/6 + `pnpm test` 全绿 + `pnpm lint` + `pnpm lint:copy`。不 push（沿 Block C/D/E 节奏，UAT 后并入 PR #10）。

---

## 交接 prompt（复制给 Sonnet / Cursor）

```
接力 Arc Stage 3 Block F — CSV 导出（spec 已 Accepted）。

必读：CLAUDE.md → .specify/session-state.md → .specify/feature-specs/stage-3/csv-export-stage-3.md（本 spec，含 6 决策 + 5 commit 链 + 8 AC）。

参考 §七 这是 RN/CSV 类任务（Sonnet 首选）。按 commit 链 1→5 实现：
  装 expo-file-system+expo-sharing → transactions-to-csv 纯函数(+单测) →
  use-csv-export hook → /me/export 页+Me入口+i18n → docs。

铁律提醒：
- shares/price/fee 全精度 Decimal.toString()，禁 number、禁格式化、禁脱敏（备份要保真）
- 原始币种保留（法则 4），不换算成报告币种
- notes 走 RFC 4180 转义
- @arc/ui 薄封装：组件只从 @arc/ui 导
- 每 commit 末 pnpm typecheck 6/6 + test 全绿 + lint:copy 无禁忌词；不 push
```

---

## Known risks / open questions

- **决策 1a**（active portfolio vs 全部）、**决策 4**（确认页 vs 直接触发）— 待 BoyangJiao 一句话确认；spec 默认取「全部 portfolio + 确认页」。
- `expo-sharing` 在 web 输出无原生分享 → web 可降级为 `Blob` 下载或隐藏入口（Stage 3 主用 iOS，web 降级非阻塞，commit 3 注明）。
- 未来 CSV **导入**需读回此格式 → 列名/语义现在就定稳（asset_id 作 join key），导入 spec 直接复用。
