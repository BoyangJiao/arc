# ADR 008a — Dev 行情数据策略：FixtureAdapter + Settings 双档开关 (Retired)

- **状态**: **已 retire（PR #8, 2026-05-19）** —— superseded by [ADR 010 — Dev 缓存信任策略](./010-dev-cache-trust-strategy.md)。Finnhub 切换后 fixture 路径被移除；Settings 双档开关随之撤掉；本文档仅保留作为决策史。
- **历史编号**: 与 [ADR 008 — Token 使用纪律](./008-token-discipline-and-polish.md) 撞号；本文件 2026-05-19 重命名为 `008a-` 以消歧（原 `008-dev-market-data-strategy.md`）。
- **日期**: 2026-05-17
- **作者**: BoyangJiao + Claude (Opus 4.7)
- **相关 ADR**: 001（Tech Stack — Supabase + Alpha Vantage adapter），007（Dev Auth & 种子数据策略 — 真实链路不可绕过），**010（继任 ADR — dev 缓存信任策略）**
- **触发**: Stage 1 收尾期间 Cursor 引入了 `cache-first` 策略缓解 Alpha Vantage 25/day 免费配额，但只解决了 70% —— 加新 ticker 时仍打 AV、下拉刷新仍打 AV。用户提议改为「Settings 里的双档开关」明确控制是否走网络，统一支持多市场扩展。

---

## 背景

Alpha Vantage 美股免费档 25 calls/day。Stage 1 dev 阶段一旦超额，整个 portfolio 显示 0 市值（无报价回退）。Cursor 引入的 `cache-first` 策略缓解了多数场景：

- 内存 → AsyncStorage → Supabase price_snapshots 三层缓存
- 任何缓存命中都视为新鲜
- 只有下拉刷新 / 新 ticker 才打 AV

但仍有两个网络触发点 dev 期间无法避免：

1. **加新 ticker**：`validate-us-symbol` 必须确认代号存在，缓存空 → 打 AV
2. **下拉刷新**：用户主动触发的真实请求

Stage 2/3 加 A 股（Tushare）/ 港股 / 加密（CoinGecko）/ 基金（天天基金）后，dev 时每个新市场都会引入新的 API quota 问题。我们需要一个**一次解决、覆盖所有市场**的方案。

同时项目宪法 §3.5「真实链路不可绕过」铁律明确禁止 `if (DEV) return mock` 类短路代码（ADR 007 §决策五）—— 这意味着任何 dev 优化必须在 adapter 实现层做，不能在 hook / page 层短路。

---

## 决策

### 决策一：用户面对的是单一布尔开关，不是 3 档枚举

Me → Settings 增加一行（仅 `__DEV__` 渲染）：

```
┌──────────────────────────────────────────┐
│ 🛠️ 仅开发模式可见                          │
│                                          │
│ 拉取真实行情                  [ Switch ] │
│ 关闭后所有报价来自本地 fixture            │
└──────────────────────────────────────────┘
```

- 默认 **OFF**（dev 期 90% 的开发场景：UI 调试、流程验证、加页面）
- 用户随时可切，**无需重启 Metro**（adapter 工厂层每次请求读 store）
- 状态通过 Zustand persist 到 AsyncStorage，冷启动保留
- Production build 强制忽略该开关（始终走 `live` 行为）

**为什么 1 个布尔比 3 档枚举好**（替代了我们前期讨论的 `fixture | cache-first | live` env 变量方案）：

| 维度       | 双档 UI 开关               | 3 档 env 变量                                                     |
| :--------- | :------------------------- | :---------------------------------------------------------------- |
| 发现性     | ✅ Settings 里一眼可见     | ❌ 藏在 `.env` 里                                                 |
| 切换成本   | ✅ 即时生效                | ❌ 改 env + Metro `--clear`                                       |
| 中途切换   | ✅ 调 UI 时 OFF，验证时 ON | ❌ 只能启动时定                                                   |
| 心智简单   | ✅ ON / OFF 二元           | ❌ 三档需要解释每档意图                                           |
| 中间档价值 | —                          | 「cache-first」实际是「half-measure」，没真正解决加新 ticker 问题 |

### 决策二：内部仍有 3 个 effective 行为，由 (build + toggle) 派生

```ts
type EffectivePolicy = "fixture" | "cache-first" | "live";

getEffectivePolicy = () => {
  if (!__DEV__) return "live";
  return store.useRealMarketData ? "cache-first" : "fixture";
};
```

| Build | Toggle | EffectivePolicy | 行为                                                |
| :---- | :----: | :-------------- | :-------------------------------------------------- |
| prod  |   —    | **live**        | 15min 价 / 4h FX freshness；cache miss → 真 adapter |
| dev   |   ON   | **cache-first** | 任何缓存即新鲜；下拉刷新 / 新 ticker 才打 AV        |
| dev   |  OFF   | **fixture**     | FixtureAdapter；零网络                              |

「cache-first」中间档保留**仅为实现细节**，不暴露给用户。它是 `live` 在 dev 环境的「省 quota 变体」。

### 决策三：用 FixtureAdapter 实现「OFF」语义，而不是在 hook 层 mock

不允许的方案（违反铁律 §3.5）：

```ts
// ❌ 短路 hook — 业务链路被绕过
const usePrice = (assetId) => {
  if (isFixtureMode()) return MOCK_QUOTE; // <- ADR 007 §决策五 明令禁止
  return useQuery({...});
};
```

正确方案：**adapter 工厂层 swap**

```ts
// packages/data-sources/src/adapters/fixture-adapter.ts
export const createFixturePriceAdapter = (market, data) => ({
  market,
  source: "fixture",
  async fetchLatest(symbol) {
    const q = data.quotes[composeAssetId(market, symbol.toUpperCase())];
    if (!q) throw new NotFoundError(...);
    return { ...q, price: new Decimal(q.price), source: "fixture" };
  },
});

// apps/mobile/src/lib/market-data.ts
const liveRegistry = createRegistry({...real adapters});
const fixtureRegistry = createFixtureRegistry(fixtureData);
export const getRegistry = () => isFixtureMode() ? fixtureRegistry : liveRegistry;
```

**为什么这不违反铁律**：

- 业务代码（页面 / hooks / computeMarketValue / cache）**完全不感知**当前是 fixture 还是 live
- adapter 实现切换，**接口契约相同**
- 整条链路（query → adapter.fetchLatest → cache write-back → compute → render）**每一步都真实跑**
- adapter-side bug（响应解析错、字段缺失、Decimal 类型错）在 fixture 模式下**照样会被发现**

### 决策四：FixtureData 是单一 JSON 文件，多市场共用

`apps/mobile/src/lib/dev-fixtures/quotes.json`：

```json
{
  "quotes": {
    "US:AAPL": { "price": "189.50", "currency": "USD" },
    "CN:600519": { "price": "1680.00", "currency": "CNY" },
    "HK:00700": { "price": "350.00", "currency": "HKD" },
    "CRYPTO:BTC": { "price": "65000", "currency": "USD" }
  },
  "fx": {
    "USD->CNY": { "rate": "7.20" },
    "HKD->CNY": { "rate": "0.92" }
  }
}
```

- **加新市场零代码改动**：Stage 2/3 接 A 股 / 港股 / 加密 / 基金时，往 JSON 加几行即可
- **加新资产零代码改动**：用户加 TSLA 测试 → 暂时不能验？编辑 fixture 加一行 TSLA = $250
- **FX 反向自动派生**：JSON 只需 USD→CNY，CNY→USD 由 `createFixtureFxAdapter` 自动 `1/rate`
- **同市场所有 ticker 共用同一 PriceAdapter 实例的逻辑**，但 registry 仍按 market 注册（保持与 live registry 的接口对称）

### 决策五：toggle 切换不刷新已显示数据

切换 ON 后，已渲染的 fixture 价格**不会自动重新拉取**。TanStack Query 的 cache 不感知 policy 切换，已缓存的 query 直到下拉刷新前不重新执行。

**这是设计而非缺陷**：

- 切换是用户故意的，应该看到「下次操作生效」而不是「悄无声息地全屏闪烁」
- 下拉刷新 = 用户的「确认重新拉取」语义
- 实现简单（不需要 store subscribe → query invalidate 联动）

文档要在 Settings 副标题告诉用户「下拉刷新生效」（i18n: `useRealMarketDataOnHint`）。

---

## 后果

### 正面

- **Dev 体验提升**：UI 调试 / 加页面 / 加新 ticker 全程零网络，冷启动秒进
- **AV quota 不再是 dev 阻力**：25/day 配额留给真验证 / Stage 4 验收
- **多市场扩展自然适配**：A 股 / 港股 / 加密的 dev 验证不需要 API key、不需要 quota
- **铁律遵守**：业务链路每步都跑，FixtureAdapter 是合规的实现层 swap
- **toggle 显性化**：状态在 Settings 可见，比环境变量更易理解 + 调试

### 负面

- 多了 1 个新依赖（Zustand）—— 但 Stage 3+ 还会大量用到（rebalance 状态 / Watchlist 状态等），早装早摊销
- 多了 1 个数据维护点（`quotes.json`）—— 但只需在引入新 ticker 时加几行
- FixtureAdapter 自身需要测试覆盖 —— 已落地（`packages/data-sources/__tests__/fixture-adapter.spec.ts`，13 tests）

### 中性

- Pro build 强制忽略 toggle，所以 dev 时即使 toggle OFF 也不会污染 release：用户拿到的永远是 `live`

---

## 实施清单

- [x] `packages/data-sources/src/adapters/fixture-adapter.ts` — FixtureAdapter + 全市场 registry helper
- [x] `packages/data-sources/__tests__/fixture-adapter.spec.ts` — 13 tests (Decimal 反序列化、cross-market 隔离、反向 FX 派生、教育性 NotFound 错误信息)
- [x] `packages/data-sources/src/index.ts` — re-export
- [x] `apps/mobile/src/lib/dev-fixtures/quotes.json` — 初始 fixture（AAPL/MSFT/NVDA/HOOD + USD↔CNY）
- [x] `apps/mobile/src/lib/market-data-policy.ts` — Zustand store + getEffectivePolicy()
- [x] `apps/mobile/src/lib/market-data.ts` — getRegistry() 工厂 + dual-registry 构造
- [x] 5 个 callsite 更新：`registry` const → `getRegistry()` 函数（validate-us-symbol, use-price, use-fx-rate, use-portfolio-valuation）
- [x] `apps/mobile/app/me/settings.tsx` — dev-only toggle 行
- [x] `packages/i18n/src/locales/{en,zh}.ts` — 4 个新字符串
- [x] `apps/mobile/package.json` — 加 `zustand` 依赖
- [x] Verification: typecheck 6/6 ✅ / lint 6/6 ✅ / test 3/3 ✅（data-sources 47 tests）

---

## 后续

- Stage 2 加 A 股 / 港股时，往 quotes.json 加 8-10 个常用代号 + HKD↔CNY 汇率（同 ADR，不需要新决策）
- Stage 4 上架前可能想加一个「fixture is also recorded into Supabase price_snapshots so QA dev 数据库可被 share」—— 当且仅当出现此场景时再写 ADR 009
- 如未来发现 fixture-vs-live 行为差异频繁踩坑（应该不会，但留个监控点）：考虑加一个 CI smoke test 周期性跑 `live` 模式做契约比对
