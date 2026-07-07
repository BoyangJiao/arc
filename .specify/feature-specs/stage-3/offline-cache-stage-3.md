# Feature: 离线只读缓存（MMKV + Query 持久化）— Stage 3 Block F

- **Status**: Implemented — Sonnet 4.6 (2026-06-02). 6 commits `6c64088`→`c1d70de` on `dev/stage-3`. 7 决策全部落地；12 AC 待 BoyangJiao UAT。
- **Author**: Claude Opus 4.8 (draft)
- **Created**: 2026-06-02
- **Implements**: `stage-3-roadmap.md` §三 Block F「离线本地存储（MMKV）+ 上线时同步」+ §七 决策 5（**Stage 3 仅 MMKV 本地只读缓存；双向同步 → Stage 4**）
- **Conforms to**: `.specify/constitution.md`（Decimal 永不丢精度 — 持久化必须 Decimal-safe）、`.specify/data-model-invariants.md`（法则 5 历史≠当下 — 缓存是「上次看到的快照」，刷新到的新数据须覆盖；不可用旧缓存冒充当前）、ADR 007（真实链路不绕过 — 缓存只加速首屏，不短路 Auth/Adapter/Compute）、ADR 006（`@arc/ui` 不涉及）
- **Depends on**: TanStack Query（已用）、`query-client.ts`（singleton）、现有 `persistent-market-cache.ts`（AsyncStorage 报价/FX 缓存 — 本特性与之并存，**不强制迁移**）、root `_layout.tsx` QueryClientProvider 挂载点
- **Scope（只读缓存，决策 5）**: **仅**冷启动/弱网/断网时先显示上次的 Query 缓存 + 后台刷新。**不含** 离线编辑交易、双向同步、冲突合并（全部 Stage 4）；**不含** 把现有 market-cache 迁到 MMKV（可选 follow-up，非本轮）。
- **Touches**:
  - deps — `react-native-mmkv` + `@tanstack/react-query-persist-client` + `@tanstack/query-sync-storage-persister`（或 async variant）
  - `apps/mobile/src/lib/` — 新增 `query-persister.ts`（MMKV storage adapter + **Decimal-safe** serialize/deserialize）
  - `apps/mobile/app/_layout.tsx` — `QueryClientProvider` → `PersistQueryClientProvider`（或 `persistQueryClient` 调用）+ rehydrate gate
  - `apps/mobile/src/lib/query-client.ts` — 给需持久化的 query 标 `gcTime` ≥ persist maxAge（否则被 GC 前可能未持久化）
  - **不动**：`@arc/core`、DB、各 query hook 的业务逻辑（持久化是 QueryClient 层横切，hook 无感）

---

## Why this feature exists

### 用户价值（与 BoyangJiao 对齐 2026-06-02）

**核心痛点**：冷启动 / 弱网 / 断网时，持仓列表、组合总市值、市值曲线**全部空白等待**（转圈 / 骨架屏 / 落空态），因为这些 Supabase 派生数据只活在 TanStack Query 的**内存**缓存里，杀进程即丢。

**本特性解决**：冷启动立即显示**上次看到的完整组合视图（持仓 + 总值 + 曲线）**作为 stale 数据，后台静默刷新，新数据到了无感替换。断网时也能只读查看资产快照。

**澄清现状（避免重复造轮子）**：

- ✅ **报价（quotes）+ 汇率（FX）已有设备持久缓存**（`persistent-market-cache.ts`，AsyncStorage）—— 冷启动已能读到上次价格。
- ❌ **缺口 = Supabase 派生数据**：holdings / portfolioValuation / chart-series / snapshots / pnl / twr / rebalance —— 这些是 TanStack Query 纯内存缓存，冷启动丢失。**本特性补这一层。**

### 三个真实自用场景

1. **冷启动秒开**：杀进程重开 → 立即显示上次持仓 + 曲线（stale 标记可选）→ 后台刷新。现状：空白 → 转圈 → 等 Supabase + 报价。
2. **断网 / 地铁弱网**：无网也能看上次资产快照（只读）。现状：拉取失败 → 空态/错误。
3. **省重复加载**：不必每次冷启动从零重建持仓视图。

---

## 决策（待 BoyangJiao confirm）

**决策 1 — MMKV 作为持久化后端 + TanStack Query persist-client**
用 `react-native-mmkv`（同步、JSI、比 AsyncStorage 快）作存储，配 `@tanstack/react-query-persist-client` 把整个 Query 缓存持久化到磁盘，冷启动 rehydrate。**不**手写每个 query 的存取（那是 market-cache 的模式，对 Supabase 派生数据维护成本太高）。

**决策 2 — Decimal-safe 序列化（本特性最大技术风险，P0）**
Query data 充满 `Decimal` 实例（`PortfolioValuation` / `MarketValuation` 等几乎每个字段）。**默认 JSON 序列化会把 Decimal 变成 `{}` 或丢失** → 反序列化后 `.times()` 等炸裂。必须自定义 serialize/deserialize：

- 序列化：遍历时把 `Decimal` 标记为 `{ __dec: "123.45" }`（或用 superjson 风格 meta）。
- 反序列化：识别标记还原 `new Decimal(...)`。
- **复用 `persistent-market-cache.ts` 已验证的 `.toString()` ↔ `new Decimal()` 往返思路**，但要做成**通用递归** serializer（因为 Query 缓存的对象形状不固定）。
- **单测必测**（AC.6）：含 Decimal 的 valuation round-trip 后 `.equals()` 原值、精度不丢。

**决策 3 — 白名单持久化（不是全持久化）**
只持久化「冷启动想立即看到」的 query，**dehydrate 时按 queryKey 前缀过滤**：

| 持久化 ✅                                                            | 不持久化 ❌（理由）                         |
| :------------------------------------------------------------------- | :------------------------------------------ |
| `portfolios` / `portfolio`                                           | `symbol-search`（瞬时输入态）               |
| `transactions`（含 `["transactions","all"]`）                        | `historical`（按需大数据，量大）            |
| `portfolioValuation`                                                 | `watchlist-quote`（已有 market-cache 层）   |
| `portfolio-chart-series` / `portfolio-value-snapshots`               | `fx` / 报价类（已有 market-cache 层）       |
| `pnl-analysis` / `twr-portfolio` / `rebalance` / `targetAllocations` | `portfolioTransactionCount`（轻量，可重拉） |
| `dailySnapshot`                                                      | —                                           |

**决策 3a — ✅ 已确认（不持久化 historical）**：详情页历史曲线（`historical`，按标的+时间窗）不落盘 —— 数据量按标的×时间窗爆炸，详情页可接受短暂加载。只缓存主页持仓/总值/组合曲线。

**决策 4 — stale 显示策略：先显示缓存 + 后台刷新（stale-while-revalidate）**
rehydrate 后 query 立即以 stale 数据渲染，`staleTime`（现 60s）到期触发后台 refetch。**法则 5 红线**：缓存是「上次看到的」，UI 不可把它当「当前实时」误导用户。

**决策 4a — ✅ 已确认（「更新于 HH:MM」常显 + 断网行 + 跳变缓解，三者都做）**。BoyangJiao 的核心顾虑：冷启动首屏显示 stale，后台刷新完成后数字/图表**突然跳变**会造成认知失调（「我刚才看错了？」）。设计决策：

1. **常显「更新于 HH:MM」时间戳**（Hero 区，轻量 muted 文案）—— 不止是法则 5 透明度，更是**给跳变一个叙事**：用户看到 `更新于 09:30` → 刷新后变 `更新于 现在`，数字变化被时间戳「解释」了，而非神秘跳动。时间来源 = query data 的 `priceAsOf`/`fxAsOf` 或 dataUpdatedAt。
2. **刷新中软提示**：后台 refetch 进行时，时间戳旁加一个细微 in-progress 态（如 `更新中…` 或时间戳轻脉冲），**预告**即将到来的更新，跳变不再突兀。
3. **断网提示行**：真无网时（`onlineManager` / NetInfo）显示一行 offline 提示，区别于「在线但显示缓存」。
4. 文案仍遵守现有「仅供参考，可能延迟」体系 + 禁忌词。

> 注（BoyangJiao 洞察）：此跳变问题在 **Stage 4 离线数据同步**落地后基本消解（届时缓存即本地真相，断网仅在用户浏览时偶发不同步）。故本决策是 Stage 3 的**过渡期 UX 缓解**，不是永久复杂度。

**决策 5 — maxAge + gcTime 对齐**
persist `maxAge`（缓存过期丢弃阈值）建议 **24h**（隔天冷启动仍先显示昨天快照，后台刷新即可；更久的 stale 意义不大）。**必须** `gcTime ≥ maxAge`（默认 5min 会让 query 在持久化窗口前被 GC → 持久化拿不到数据）；给白名单 query 设 `gcTime: 24h`。`buster`（版本串）随 schema 变更升，防旧格式 rehydrate 崩。

**决策 6 — 敏感金额是否加密落盘**
缓存含真实持仓金额，落 MMKV 明文。`react-native-mmkv` 支持 `encryptionKey`。**决策 6 — ✅ 已确认（加密落盘）**：MMKV 用 `encryptionKey`，key 存 `expo-secure-store`（iOS Keychain / Android Keystore）。金额是隐私，与脱敏特性同源。实现：首次生成随机 key 写 secure-store，后续读回；MMKV 实例**异步取 key 后初始化** → rehydrate gate 须等 key ready 再 hydrate（决策 7 的 gate 顺带覆盖）。secure-store 读失败兜底：当作无缓存、走正常网络加载（不崩）。

**决策 7 — rehydrate gate（首帧不闪烁）**
`PersistQueryClientProvider` 在 rehydrate 完成前不渲染依赖缓存的屏（用现有 splash/loading）。auth-gate 已在 AppShell；persist gate 包在其外或内需测试不冲突（决策：包在 QueryClientProvider 层，rehydrate 完再进 AppShell 路由判断）。

---

## User journeys

### J-F3a — 冷启动秒开

**Given** 用户上次正常用过 App（持仓/曲线已加载并被持久化）
**When** 杀进程后冷启动
**Then** rehydrate 后**立即**显示上次的持仓列表 + 总市值 + 曲线（stale）
**And** 后台 refetch 完成后无感替换为最新
**And** Decimal 金额精度与上次完全一致（无精度丢失 / NaN）

### J-F3b — 断网只读

**Given** 设备无网络
**When** 打开 App
**Then** 显示上次缓存的组合视图（只读），不落全空错误态
**And**（决策 4a）可选 offline 提示行

### J-F3c — 缓存过期 / 版本变更

**Given** 缓存超过 maxAge（24h）或 app schema buster 变更
**Then** 丢弃旧缓存，走正常网络加载（不 rehydrate 坏数据）

---

## Acceptance criteria（UAT）

| AC              | 测什么                                                                                                             |
| :-------------- | :----------------------------------------------------------------------------------------------------------------- |
| **S3-AC-OF.1**  | 冷启动（杀进程重开）→ 持仓/总值/曲线**立即可见**（来自缓存），非空白转圈                                           |
| **S3-AC-OF.2**  | 缓存显示后后台刷新生效；数值更新到最新（stale-while-revalidate）                                                   |
| **S3-AC-OF.3**  | **断网**冷启动 → 仍显示上次组合视图（只读），不报全局错误                                                          |
| **S3-AC-OF.4**  | Decimal 金额冷启动后精度无损（抽查总市值 / 某持仓成本 == 重启前；无 NaN / `[object]`）                             |
| **S3-AC-OF.5**  | 白名单生效：`symbol-search` / `historical` 不被持久化（决策 3a；不污染磁盘 / 不显示陈旧搜索）                      |
| **S3-AC-OF.6**  | 单测：Decimal-safe serializer round-trip（valuation 对象 → 字符串 → 还原 `.equals()` 原值）+ 非 Decimal 字段不破坏 |
| **S3-AC-OF.7**  | 缓存过期（maxAge）/ buster 变更 → 丢弃旧缓存，正常加载，不崩                                                       |
| **S3-AC-OF.8**  | MMKV 文件落盘**加密**，明文不可读；key 在 secure-store；secure-store 读失败 → 当无缓存正常加载（不崩）             |
| **S3-AC-OF.9**  | 登出 / 切换 Real↔Clean 环境 → 缓存清除或按 user 隔离（不串号；复用现有 reset 路径）                                |
| **S3-AC-OF.10** | rehydrate gate：首帧不闪「空 → 有数据」跳变                                                                        |
| **S3-AC-OF.11** | Hero 常显「更新于 HH:MM」；后台刷新时有 in-progress 软提示；刷新完时间戳更新（决策 4a 跳变缓解）                   |
| **S3-AC-OF.12** | 断网时显示 offline 提示行；恢复网络后消失                                                                          |

---

## Implementation plan（commit chain — Opus 写 serializer 核心 / Sonnet 接 wiring）

> 路由：决策 2 的 Decimal serializer + 决策 5 的 GC/maxAge 边界是**正确性核心（Opus）**；provider wiring + 白名单 + UI 提示是 RN 接线（Sonnet）。建议 Opus 出 serializer + 其单测后交接。

1. ✅ **`6c64088` `chore(mobile): add react-native-mmkv + query-persist-client + secure-store + netinfo`** — SDK 55 对齐安装 5 个包；`expo-secure-store` 插件写入 `app.json`。
2. ✅ **`cb6ccbd`（Opus）`feat(mobile): Decimal-safe JSON serializer + tests`** — `decimal-safe-json.ts`：`encodeDecimals`/`decodeDecimals`/`serialize`/`deserialize`（`{__arc_dec__}` 标记）。11 测试（AC.OF.6）。
3. ✅ **`d3f0db3` `feat(mobile): encrypt MMKV at rest with secure-store key`** — `mmkv-encrypted.ts`：异步取/生成 key → `createMMKV`；web/failure → null；`resetMmkvInstance()` 供测试/env-switch。
4. ✅ **`30b0308` `feat(mobile): persist gate + whitelist dehydrate + gcTime`** — `query-persister.ts`（MMKV adapter + Decimal-safe）；`_layout.tsx` → `PersistQueryClientProvider`（buster + maxAge 24h + `shouldDehydrateQuery`）；`query-client.ts` 白名单 `gcTime=24h`；rehydrate gate（null → splash）。
5. ✅ **`1228a80` `feat(mobile): cache timestamp UX — "更新于 HH:MM" + refresh prompt + offline row`** — `CacheStatusBar`（NetInfo 订阅 + 3 态）；Portfolio Tab 接 `valuationUpdatedAt`；i18n `cache.*` en+zh。
6. ✅ **`c1d70de` `feat(mobile): cache lifecycle on logout / env switch (AC.OF.9)`** — `clear-query-cache.ts`；`auth.tsx` signOut 接入；`run-reset-clean.ts` 替换 `queryClient.clear()`；测试 mock 修正。
7. ✅ **（本 commit）`docs(spec+session-state): offline cache complete`**。

每 commit 末：`pnpm typecheck` 6/6 + `pnpm test` 全绿 + `pnpm lint` + `pnpm lint:copy`；不 push（沿 Block C/D/E/F 节奏，UAT 后并入 PR #10）。pre-commit typecheck gate 已生效。

**执行顺序提醒**：commit 2 已完成。建议 Sonnet 顺序 = 1 → 4（加密先于 wiring，避免明文缓存迁移）→ 3 → 5 → 6 → 7。

---

## 交接 prompt（复制给 Sonnet / Cursor）

```
接力 Arc Stage 3 Block F 最后一项 — 离线只读缓存 wiring（spec 已 Accepted，serializer 核心已由 Opus 完成）。

必读：CLAUDE.md → .specify/session-state.md → offline-cache-stage-3.md（7 决策 + commit 链 + 12 AC）。

已完成（不要重做）：commit 2 `decimal-safe-json.ts`（Decimal-safe serialize/deserialize + 11 测试，commit cb6ccbd）。
你的 query-persister 直接 import 它。

参考 §七 这是 RN 接线（Sonnet 首选）。顺序 1 → 4 → 3 → 5 → 6 → 7：
  1. 装 react-native-mmkv + @tanstack/react-query-persist-client（npx expo install 对齐 SDK 55；web 无 MMKV → noop persister 降级，留注释）
  4. MMKV 加密：随机 key 写 expo-secure-store，异步取 key 初始化 MMKV（先于 wiring，无明文迁移；secure-store 读失败 → 当无缓存正常加载，不崩）
  3. query-persister.ts（MMKV adapter + 复用 decimal-safe-json 的 serialize/deserialize）→ _layout.tsx 接 PersistQueryClientProvider（buster + maxAge 24h + shouldDehydrateQuery 白名单见决策 3 表）→ query-client.ts 给白名单 query 设 gcTime ≥ maxAge（关键陷阱！否则 5min 后 GC，persist 写空）→ rehydrate gate（决策 7）
  5. Hero「更新于 HH:MM」常显 + 后台刷新软提示 + onlineManager/NetInfo 断网行（决策 4a；i18n en+zh；遵守「仅供参考可能延迟」文案体系 + 禁忌词）
  6. 登出/Real↔Clean 切换清缓存（复用现有 run-reset-clean 路径，防串号）

铁律提醒：
- 白名单只持久化决策 3 表里的 query；historical/symbol-search/报价类不持久化
- gcTime ≥ maxAge（24h）—— 忘了这个冷启动还是没数据
- 法则 5：缓存纯展示只读，不参与任何写入决策（交易录入仍走实时）
- 加密：金额是隐私，MMKV 必须 encryptionKey
- 每 commit 末 pnpm typecheck 6/6 + test 全绿 + lint:copy 无禁忌词；不 push
- AC.OF.1–OF.12 是 UAT 验收清单
```

---

## Known risks / open questions

- **决策 2（Decimal 序列化）= 本特性成败关键**。若 serializer 漏掉某个嵌套 Decimal → 该字段反序列化成普通对象 → 运行时 `.times is not a function`。单测必须覆盖真实 valuation/holdings 形状，不能只测玩具对象。建议 serializer 实现后，拿一个真实 `PortfolioValuation` fixture 做 round-trip 断言。
- ~~**决策 3a / 4a / 6**~~ — ✅ Resolved 2026-06-02：不持久化 historical / 「更新于 HH:MM」常显+断网行+跳变缓解 / 加密落盘。
- **gcTime 陷阱**：忘记给白名单 query 提 `gcTime` → query 在 5min 后被 GC，persist 写空 → 冷启动还是没数据。决策 5 已点明，实现必查。
- **web 输出**：MMKV 无 web 实现 → web 用 noop 或 IndexedDB persister；本轮主用 iOS，web 降级非阻塞。
- **与现有 market-cache 并存**：本轮不迁移 `persistent-market-cache.ts`；两层缓存共存（market-cache 管报价/FX，query-persist 管 Supabase 派生）。统一到 MMKV 是 future cleanup，记 follow-up，不阻塞。
- **法则 5**：缓存绝不能被当成实时数据参与新的写入决策（如再平衡下单基于 stale 估值）——本轮纯展示只读，写路径（交易录入）仍走实时；spec 红线，review 必查。
