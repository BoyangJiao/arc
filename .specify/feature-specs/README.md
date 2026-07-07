# Feature Specs

> One Markdown file per non-trivial feature, **written before code**.
>
> **当前目录结构**：按产品开发 Stage 分子目录；同一 Stage 内按创建 / 实施时间顺序排列。
> 路径格式：`.specify/feature-specs/<stage-dir>/<name>.md`
>
> 📋 **未来重构计划**：MVP 周期（Stage 5 DoD）结束后将迁移到按"能力域"分类。
> 见 [`_RESTRUCTURE-PLAN.md`](./_RESTRUCTURE-PLAN.md) — **现在不要动，仅作未来施工蓝图**。

## 目录索引（按 Stage + 时间顺序）

### Stage 1 — MVP-0 端到端骨架

| 序  | 文件                                                               | 状态 | 创建       | 说明                             |
| :-: | :----------------------------------------------------------------- | :--- | :--------- | :------------------------------- |
|  1  | [data-model-stage-1.md](./stage-1/data-model-stage-1.md)           | Done | 2026-05-14 | `packages/db` schema 与 RLS      |
|  2  | [data-sources-stage-1.md](./stage-1/data-sources-stage-1.md)       | Done | 2026-05-14 | Stage 1 行情 / 汇率 adapters     |
|  3  | [auth-magic-link.md](./stage-1/auth-magic-link.md)                 | Done | 2026-05-14 | J1 登录（OTP + magic link 双流） |
|  4  | [business-tokens-stage-1.md](./stage-1/business-tokens-stage-1.md) | Done | 2026-05-14 | 红涨绿跌 Business token 层       |

### Stage 2 — 让 3 Tab 真正跑起来

| 序  | 文件                                                             | 状态     | 创建       | 说明               |
| :-: | :--------------------------------------------------------------- | :------- | :--------- | :----------------- |
|  1  | [daily-snapshot-stage-2.md](./stage-2/daily-snapshot-stage-2.md) | Accepted | 2026-05-17 | J7 Daily Snapshot  |
|  2  | [watchlist-stage-2.md](./stage-2/watchlist-stage-2.md)           | Accepted | 2026-05-18 | J8 自选列表        |
|  3  | [rebalance-stage-2.md](./stage-2/rebalance-stage-2.md)           | Accepted | 2026-05-18 | J9 再平衡          |
|  4  | [welcome-stage-2.md](./stage-2/welcome-stage-2.md)               | Accepted | 2026-05-18 | 首次引导 / Welcome |

### Cross-stage — 跨 Stage 专项（UI / 设计基建）

> 触发于 Stage 2 中后期，影响 `@arc/ui` 与全局 token 纪律；不绑定单一 Stage gate。

| 序  | 文件                                                           | 状态 | 触发       | 说明                        |
| :-: | :------------------------------------------------------------- | :--- | :--------- | :-------------------------- |
|  1  | [token-polish-sprint.md](./cross-stage/token-polish-sprint.md) | —    | 2026-05-19 | ADR 008 Token Polish Sprint |
|  2  | [component-audit.md](./cross-stage/component-audit.md)         | —    | 2026-05-19 | @arc/ui 四方组件 audit      |
|  3  | [ui-polish-handoff.md](./cross-stage/ui-polish-handoff.md)     | —    | 2026-05-19 | UI Polish 交接与 Batch 计划 |

### Stage 3 — MVP-1 自用版

> 总路线图：[stage-3-roadmap.md](./stage-3/stage-3-roadmap.md)（Accepted 2026-05-19）

| 序  | Block | 文件                                                                                   | 状态     | 创建       | 说明                                                 |
| :-: | :---- | :------------------------------------------------------------------------------------- | :------- | :--------- | :--------------------------------------------------- |
|  0  | —     | [stage-3-roadmap.md](./stage-3/stage-3-roadmap.md)                                     | Accepted | 2026-05-19 | 依赖排序 + 模型路由 + 风险登记                       |
|  1  | A     | [tushare-adapter-stage-3.md](./stage-3/tushare-adapter-stage-3.md)                     | Accepted | 2026-05-19 | CN 行情（Tushare + AKShare reshape）                 |
|  2  | A     | [coingecko-adapter-stage-3.md](./stage-3/coingecko-adapter-stage-3.md)                 | Accepted | 2026-05-20 | CRYPTO 行情（Block A 漏单收口）                      |
|  3  | B     | [multi-portfolio-stage-3.md](./stage-3/multi-portfolio-stage-3.md)                     | Accepted | 2026-05-20 | 多组合管理 + 跨组合现金划转                          |
|  4  | C     | [holdings-and-transactions-stage-3.md](./stage-3/holdings-and-transactions-stage-3.md) | Accepted | 2026-05-20 | 持仓表 / 资产详情 / 图表 / 跨市场录入                |
|  5  | D     | [twr-stage-3.md](./stage-3/twr-stage-3.md)                                             | Draft    | 2026-05-24 | TWR / MWR 算法                                       |
|  6  | D     | [performance-attribution-stage-3.md](./stage-3/performance-attribution-stage-3.md)     | Draft    | 2026-05-24 | 业绩归因                                             |
|  7  | D     | [drawdown-stage-3.md](./stage-3/drawdown-stage-3.md)                                   | Draft    | 2026-05-24 | 回撤分析                                             |
|  8  | D     | [insights-enrichment-stage-3.md](./stage-3/insights-enrichment-stage-3.md)             | Accepted | 2026-06-15 | Insights 扩充（敞口/基准/风险卡 + 图表复用）         |
|  9  | D     | [benchmark-comparison-stage-3.md](./stage-3/benchmark-comparison-stage-3.md)           | Draft    | 2026-06-16 | 组合 vs 基准 + beta（用户可选基准 · 需指数 adapter） |
| 10  | D     | [realized-pnl-fx-stage-3.md](./stage-3/realized-pnl-fx-stage-3.md)                     | Draft    | 2026-06-16 | 收益报告「已实现」列（历史 FX）                      |

---

## When to write a feature spec

**Required** for:

- Any new user-facing flow (e.g. "add transaction modal", "rebalance setup")
- Any new domain logic in `packages/core/` (e.g. TWR computation, fx-chain)
- Any new external adapter in `packages/data-sources/`
- Cross-package refactors

**Not required** for:

- Bug fixes (use ADR instead if architectural)
- Style tweaks
- Copy / i18n updates
- Dependency upgrades

## 新建 spec 放哪？

| 场景                   | 目录           | 命名                                       |
| :--------------------- | :------------- | :----------------------------------------- |
| Stage 1 范围的功能     | `stage-1/`     | `<feature>-stage-1.md` 或语义化 kebab-case |
| Stage 2 范围的功能     | `stage-2/`     | `<feature>-stage-2.md`                     |
| Stage 3 范围的功能     | `stage-3/`     | `<feature>-stage-3.md`                     |
| 跨 Stage 基建 / polish | `cross-stage/` | 语义化 kebab-case                          |
| Stage 3 总览 / 路线图  | `stage-3/`     | `stage-3-roadmap.md`（唯一）               |

## Spec template

Save under the appropriate stage subdirectory. Example: `stage-2/csv-import-stage-2.md`.

```markdown
# Feature: <name>

- **Status**: Draft | Accepted | Implementing | Done
- **Author**: <name>
- **Created**: YYYY-MM-DD
- **Stage**: 1 / 2 / 3 / 4 / 5
- **Related journey**: J<n> (from docs/user-journeys.md)
- **Related ADRs**: ###

## Goal

1-3 sentences. What user problem does this solve?

## User-facing behavior

Given/When/Then format. Aligns with stage-acceptance-criteria.md.

## Data contract

- Inputs: schema + types
- Outputs: schema + types
- Side effects: persistence / API calls / UI state changes

## Constraints

What invariants from constitution.md or data-model-invariants.md apply?

## Out of scope

What this spec does NOT address (explicitly).

## Test plan

- Property tests to add (`packages/core/__tests__/`)
- Manual verification steps
- Cross-platform considerations (iOS / Android / Web)

## Migration / rollout

If touching existing data: how to migrate?
```

## Lifecycle

1. **Draft** → Author writes spec, opens Discussion / PR with spec only
2. **Accepted** → Open questions resolved; ready for implementation
3. **Implementing** → After spec review, code follows
4. **Done** → Code merged + acceptance criteria met. Spec stays as historical record.

## Related docs

- Stage DoD：[`../stage-acceptance-criteria.md`](../stage-acceptance-criteria.md)
- 开发计划：[`../../docs/development-plan.md`](../../docs/development-plan.md) §七
- 用户旅程：[`../../docs/user-journeys.md`](../../docs/user-journeys.md)
- Repomix context bundles：[`../../docs/HARNESS.md`](../../docs/HARNESS.md) Layer 6

## Context bundle (Repomix)

Each Stage 3 spec has a sibling `<slug>.repomix.json`. **Agents auto-run** `pnpm ctx:auto` — developers do not run ctx commands manually.

Add to new specs:

```markdown
## Context bundle

Auto: `pnpm ctx:auto` (agent/hook). Config: `.specify/feature-specs/stage-3/<slug>.repomix.json`
```
