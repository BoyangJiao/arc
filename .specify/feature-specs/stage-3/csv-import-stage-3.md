# Feature: CSV 导入（交易批量录入）— Stage 3 Block F

- **Status**: Draft — Opus 4.8 (2026-06-01); awaiting BoyangJiao review
- **Author**: Claude Opus 4.8 (draft)
- **Created**: 2026-06-01
- **Implements**: `stage-3-roadmap.md` §三 Block F 第 2 项「CSV 导入（Stage 2 下放）」
- **Conforms to**: `.specify/constitution.md`（Decimal + 禁忌文案）、`.specify/data-model-invariants.md`（法则 1 资产 ID 不变 / 法则 2 持仓 = Σ交易 / 法则 4 币种永不丢失 / 法则 5 历史≠当下）、ADR 006（`@arc/ui` 薄封装）、ADR 007（真实链路不可绕过 — 导入也走 `ensureAssetRow` + `transactions.insert` 真实写库，不短路）
- **Depends on**:
  - `transactions-to-csv.ts` 的列契约（**导入复用导出格式** —— 同一 header，`asset_id` 作 join key；导出文件可原样导回）
  - `ensureAssetRow` + transaction insert 路径（`use-transactions.ts`，已存在 — 导入须复用，不另起一套写库）
  - `usePortfolios`（目标组合选择）、`parseAssetId`（校验 `market:symbol`）
  - `expo-document-picker`（选 CSV 文件）+ `expo-file-system`（读文件，已装）
- **Scope**: 仅交易导入。**不含**持仓直接导入（违反法则 2）、券商对账单格式自动识别（仅认 Arc 自有导出格式 + 宽松列序）、撤销/回滚（导入是追加 insert，删错走现有 swipe-to-delete）
- **Touches**:
  - `apps/mobile/src/lib/` — 新增 `csv-to-transactions.ts`（**纯函数** parser + validator，可单测，核心复杂度在此）
  - `apps/mobile` — 新增 `/me/import` 流程（选文件 → 预览/校验报告 → 确认写入）+ `use-csv-import` hook + Me 入口
  - deps — `expo-document-picker`
  - `@arc/i18n`（en + zh）— `import.*`
  - **不动**：`@arc/core`（导入是展示+写库层）、DB / migration（复用现有表 + RLS）

---

## Why this feature exists

CSV 导出（Block F 第 1 项）给了「数据导出」；导入是反向闭环：

- **迁入**：从券商/支付宝/其他工具整理出交易，批量录入（避免手动一笔笔点）。
- **恢复**：导出的备份 CSV 可重新导回（换设备 / 误删后重建）。
- **roadmap 定位**：「Stage 2 下放」—— 一直想做、但属「麻烦不阻塞自用」，放 Block F 收尾。

**为什么比导出复杂得多**（决定本 spec 的重心）：导出是「内部数据 → 字符串」单向无歧义；导入是「**不可信外部字符串** → 内部数据」，必须处理解析失败、列缺失、类型非法、资产不存在、币种/市场不匹配、重复行、部分成功 —— 核心价值在 **parser/validator 的容错与清晰报错**，不在写库。

---

## 决策（待 BoyangJiao confirm）

**决策 1 — 只认 Arc 导出格式（+ 宽松列序），不做券商格式猜测**
导入 CSV 必须含导出的 10 列表头（`portfolio_id,portfolio_name,asset_id,type,shares,price_per_share,currency,fee,trade_date,notes`）。**按表头名映射**（不依赖列顺序），多余列忽略，缺必需列 → 整文件拒绝 + 指明缺哪列。券商各式 CSV 自动识别 = 明确 out of scope（复杂度爆炸、无穷格式）。**决策 1a 待确认**：`portfolio_id` 在导入时是否信任？建议**忽略 CSV 的 portfolio_id/portfolio_name**，统一导入到**用户在 UI 选定的目标组合**（CSV 来自别处时其 portfolio_id 无意义；备份恢复场景用户也该显式选组合）。

**决策 2 — 解析 = 纯函数，三段式结果（valid / invalid / 全文件错）**
`csvToTransactions(text) → { rows: ParsedRow[], fileError?: string }`，每行 `ParsedRow = { ok: true, value: ParsedTx } | { ok: false, line: number, raw: string, errors: string[] }`。**逐行独立校验**，不因一行坏掉整批失败（除非表头缺失 = fileError）。校验项：

- `type` ∈ TransactionType（BUY/SELL/DIVIDEND/SPLIT/ADJUSTMENT）
- `shares`/`price_per_share`/`fee` 可 `new Decimal()` 且有限（非 NaN/Inf）；shares > 0、price ≥ 0、fee ≥ 0（对齐 DB CHECK 约束，提前拦截）
- `asset_id` 经 `parseAssetId` 合法（`market:symbol`，market ∈ 已知集）
- `currency` ∈ Currency 枚举
- `trade_date` 可解析为合法 ISO 8601
- RFC 4180 反解析（带引号字段含逗号/换行/转义引号）

**决策 3 — 三步 UI 流程：选文件 → 预览报告 → 确认写入**

1. **选文件**：`expo-document-picker` 选 `.csv`；读文本。
2. **预览/报告**：显示「✓ N 行可导入 / ✗ M 行有问题（列出前若干行 + 原因）/ 目标组合选择器」。M>0 时用户可选择「仅导入有效行」或「取消去修文件」。
3. **确认写入**：写入目标组合 → 进度 + 结果（成功 X / 失败 Y + 原因）。

**决策 4 — 写库复用现有路径（ADR 007 不短路）+ 顺序写 + 资产 ensure**
逐行调用与 `useCreateTransaction` **同一套** `ensureAssetRow` + `transactions.insert`（不另写 SQL）。**决策 4a — US 符号网络校验**：现有 create 路径对 `US:` 走 `validateUsSymbol`（网络，有限流风险）。批量导入几十行会触发 Finnhub 限流。建议：**导入路径跳过逐行 US 在线校验**（导入语义 = 用户已确认数据，asset 元数据用 CSV 行内的 currency + symbol 作 name 兜底），仅做 `ensureAssetRow` upsert；在线校验留给单笔手动录入。**待确认**。

**决策 5 — 资产元数据来源**
CSV 无 `name`/asset 全名列（导出也没有 —— 导出列里 asset 只有 `asset_id`）。导入 `ensureAssetRow` 需要 `name`：用 `symbol` 兜底（与现有 create 的 `name: symbol` 默认一致）；若该 asset_id 已存在于 `assets` 表，upsert `ignoreDuplicates` 不会覆盖已有好名字。**结论**：导入不丢已有资产名，新资产名暂等于 symbol（后续用户进详情页可被 search 元数据丰富）。

**决策 6 — 重复处理**
不做去重（交易无自然唯一键；同标的同日同量可能是真实两笔）。导入纯追加。重复导入同一文件 = 交易翻倍 —— **UI 明确提示**「导入会追加，不会去重；重复导入同一文件会产生重复交易」。

**决策 7 — 文案合规**
全程中性描述，无「建议/预期」。错误信息具体可操作（「第 5 行：shares 不是合法数字 'abc'」）。

---

## User journey (J-F2)

### J-F2a — 选文件

**Given** 用户在 `/me/import`
**When** tap「选择 CSV 文件」→ 系统文件选择器 → 选定 .csv
**Then** 读取并解析，进入预览

### J-F2b — 预览与校验报告

**Then** 显示：目标组合选择器（默认 active）+「N 行可导入」+（若有）「M 行有问题」列表（行号 + 原因）
**And** 表头缺列 → 整文件拒绝 + 指明缺哪列
**And** 「导入有效行」按钮（M>0 时文案提示将跳过问题行）

### J-F2c — 确认写入

**When** tap「导入」
**Then** 逐行写入目标组合（走 ensureAssetRow + insert）
**And** 结果页：成功 X 笔 / 失败 Y 笔（+ 原因）
**And** 持仓/估值/图表随 invalidate 刷新（法则 2，导入后持仓 = 原 + 新交易）

### J-F2d — 往返一致性（关键回归）

**Given** 用户先导出 CSV，再原样导入到一个空组合
**Then** 该组合持仓与原组合一致（导出→导入 round-trip 保真，验证列契约闭环）

---

## Acceptance criteria（UAT）

| AC              | 测什么                                                                                           |
| :-------------- | :----------------------------------------------------------------------------------------------- |
| **S3-AC-FI.1**  | Me →「导入数据」→ `/me/import` → 选 .csv → 进预览；返回正常                                      |
| **S3-AC-FI.2**  | 合法文件：预览显示正确「可导入 N 行」+ 目标组合选择器（默认 active）                             |
| **S3-AC-FI.3**  | 缺必需列 → 整文件拒绝 + 提示缺哪列；不写入任何行                                                 |
| **S3-AC-FI.4**  | 含坏行（type 非法 / shares 非数 / asset_id 格式错 / 日期非法）→ 逐行报错 + 行号；坏行不阻塞好行  |
| **S3-AC-FI.5**  | 确认导入 → 仅有效行写入目标组合；结果页成功/失败计数准确                                         |
| **S3-AC-FI.6**  | 导入后 Portfolio 持仓 = 原持仓 + 导入交易（法则 2 闭环；估值/图表刷新）                          |
| **S3-AC-FI.7**  | **Round-trip**：导出 A 组合 → 导入到空 B 组合 → B 持仓 == A 持仓                                 |
| **S3-AC-FI.8**  | 重复导入同一文件 → 交易翻倍（无去重）+ UI 事前提示；符合预期非 bug                               |
| **S3-AC-FI.9**  | RFC 4180 反解析：notes 含逗号/引号/换行的行正确还原                                              |
| **S3-AC-FI.10** | 单测：`csvToTransactions` 覆盖 表头缺失 / 各类坏行 / 带引号字段 / Decimal 边界 / 空文件 / 仅表头 |
| **S3-AC-FI.11** | i18n en+zh 齐全 + `lint:copy` 无禁忌词；导入走真实写库（ADR 007，无 mock 短路）                  |

---

## Implementation plan（commit chain — 交接 Sonnet）

1. **`chore(mobile): add expo-document-picker (SDK 55)`** — `npx expo install`；web 降级（`<input type=file>`）留注释。
2. **`feat(mobile): csv-to-transactions parser + validator + tests`** — `src/lib/csv-to-transactions.ts`（**纯函数**，本特性核心）：RFC 4180 反解析 + 按表头映射 + 逐行校验（决策 2）→ `{ rows, fileError? }`。**重单测**（AC.10）：表头缺失/坏行各类/引号字段/Decimal 边界/空/仅表头。复用导出的 `CSV_HEADER` 常量保证列契约对齐。
3. **`feat(mobile): use-csv-import hook (pick + parse + write to target portfolio)`** — document-picker 选文件 → 读文本 → 调纯函数 → 暴露 `{ parsed, validCount, invalidRows, importValid(targetPortfolioId) }`；`importValid` 顺序复用 `ensureAssetRow`+insert（决策 4，US 跳在线校验 per 决策 4a）；结果计数 + invalidate（`["transactions", pid]` + `["portfolios"]`）。
4. **`feat(mobile): /me/import 3-step screen + Me entry + i18n`** — 选文件 → 预览报告（计数 + 坏行列表 + 组合选择器 + 重复提示）→ 结果页；`me/index.tsx` 加入口；`import.*` en+zh。
5. **`docs(spec+session-state): CSV import complete`** — 标 Accepted + bump。

每 commit 末：`pnpm typecheck` 6/6 + `pnpm test` 全绿 + `pnpm lint` + `pnpm lint:copy`。不 push（沿 Block C/D/E/F 节奏，UAT 后并入 PR #10）。pre-commit 现已带 typecheck gate。

---

## 交接 prompt（复制给 Sonnet / Cursor）

```
接力 Arc Stage 3 Block F — CSV 导入（spec 已 Accepted）。

必读：CLAUDE.md → .specify/session-state.md → csv-import-stage-3.md（7 决策 + 5 commit 链 + 11 AC）
     + csv-export-stage-3.md（列契约必须对齐：导入复用导出的 CSV_HEADER + asset_id join key）。

参考 §七 这是 RN/CSV 类（Sonnet 首选）。按 commit 链 1→5：
  装 expo-document-picker → csv-to-transactions 纯函数 parser/validator(+重单测) →
  use-csv-import hook（复用 ensureAssetRow+insert，US 跳在线校验）→
  /me/import 三步页（选文件→预览报告→确认）+Me入口+i18n → docs。

铁律提醒：
- 解析层纯函数，逐行独立校验，坏行不阻塞好行；表头缺列才整文件拒
- shares/price/fee 用 Decimal，提前拦 shares>0 / price≥0 / fee≥0（对齐 DB CHECK）
- 写库走现有 ensureAssetRow + transactions.insert（ADR 007 不短路，不另写 SQL）
- 忽略 CSV 的 portfolio_id，统一导入到 UI 选定的目标组合（决策 1a）
- 导入纯追加不去重，UI 须事前提示
- round-trip：导出再导入到空组合 → 持仓必须一致（AC.FI.7）
- 每 commit 末 pnpm typecheck 6/6 + test 全绿 + lint:copy 无禁忌词；不 push
```

---

## Known risks / open questions

- **决策 1a**（忽略 CSV portfolio_id，用 UI 选定组合）、**决策 4a**（导入跳过 US 在线符号校验，避免 Finnhub 限流）— 待 BoyangJiao 确认；spec 默认取上述。
- **大文件**：纯字符串解析 + 顺序 insert，几百行 OK；上千行 insert 串行会慢 → 可后续批量 insert 优化（Stage 3 自用量级不阻塞）。
- **部分成功的语义**：顺序 insert 中途网络失败 → 已写入的保留（追加语义无事务回滚），结果页如实报「成功 X / 失败 Y」；用户可修文件后重导（会重复，靠提示）。
- **币种/市场新增**：若 CSV 含未知 market（如未来 LME）→ `parseAssetId` 校验失败该行报错，不静默吞。
