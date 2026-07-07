# Feature Specs 目录重构计划（延期执行）

> **本文件不是当前规范** —— 当前 `.specify/feature-specs/` 仍按 Stage 分目录组织（见 [README.md](./README.md)）。
>
> 本文件捕获已论证的**长期目标结构**与**触发执行条件**，作为 MVP 周期结束后的施工蓝图。
> 当触发条件满足时，按本文件 §五 步骤执行；执行完毕后删除本文件（README 改写为新结构的索引）。

- **决策日期**: 2026-05-24
- **决策者**: BoyangJiao + Claude Opus 4.7
- **背景讨论**: 本会话上文（"feature-specs 如何分类最好" 设计讨论）
- **执行时机**: Stage 5（V1.0 公开发布）DoD 达成之后，进入持续迭代期之前
- **预计工作量**: 2-4h（一次性 git mv + 引用更新 + frontmatter 补齐）

---

## 一、为什么延期执行

| 现在不做的理由                                                                               | 备注                                                     |
| :------------------------------------------------------------------------------------------- | :------------------------------------------------------- |
| Stage 3 active development 中段，目录调整会污染 Stage gate review 的信号                     | P0 — 重构最忌穿插在 active feature work 中               |
| 当前 Stage-by-Stage 测试节奏与 Stage 目录天然对齐，便于 J11-J16 验收                         | Stage 3 验收对照 `stage-acceptance-criteria.md` §Stage 3 |
| 现有 20 份 spec 量级未达到"必须改"阈值；当前 4 个子目录尚可读                                | 阈值在 §二 触发条件量化                                  |
| Stage 4 / 5 还会产出新 spec（AI 导入 / 公开发布 / Pro 订阅），等他们全到位再统一重构成本更低 | 一次性做，比分两次更省                                   |

## 二、触发条件（满足**任一**即启动）

| 触发器                                         | 量化阈值                                                                | 当前状态                     |
| :--------------------------------------------- | :---------------------------------------------------------------------- | :--------------------------- |
| **A. MVP 周期结束**                            | Stage 5 DoD 100% ✅（App Store 上架 + Pro 首单 + 官网 + AI evals 通过） | ⏳ 未达                      |
| **B. Spec 量级超过 Stage 目录承载力**          | 总 spec 数 ≥ 30 **且** 任一 stage 子目录 ≥ 10                           | 当前 20 份 / 最大子目录 8 份 |
| **C. 出现第一个 v2 spec（演进信号）**          | 任何已 Done 的 feature 进入 v2 设计（如 `watchlist-v2.md`）             | ⏳ 未发生                    |
| **D. 引入 spec-kit 风格的 per-feature 子目录** | 任一 spec 需要拆出 `spec.md + plan.md + tasks.md` 多产物                | ⏳ 未发生                    |
| **E. 用户显式要求**                            | "现在重构 feature-specs"                                                | 否决当前                     |

> **判定权**：BoyangJiao（user）。AI agent **不得自动**触发重构。

## 三、目标结构（按能力域）

```
.specify/feature-specs/
├── README.md                  ← 多视图索引（按域 / 按 Stage / 按状态 / 时间线）
├── _template.md               ← 标准 spec 模板（含 frontmatter schema）
│
├── data-model/                ← schema、不变量、迁移
├── data-sources/              ← 外部 adapter（tushare / akshare / coingecko / alphavantage / finnhub）
├── auth/                      ← 登录、CN/Global 双区身份
├── portfolio/                 ← 多组合管理、持仓、交易、跨组合划转
├── analytics/                 ← TWR / MWR / 归因 / 回撤
├── snapshot/                  ← daily snapshot、历史 NAV
├── rebalance/                 ← 再平衡引擎
├── watchlist/                 ← 自选清单
├── onboarding/                ← welcome、首次引导、business tokens
├── design-system/             ← @arc/ui、token 纪律、component audit、UI polish
│
└── roadmaps/                  ← Stage 级路线图（**唯一保留时间轴的目录**）
    └── stage-3-roadmap.md     ← 未来 stage-4/5-roadmap.md 自然落点
```

**设计原则**：

- **能力域 = 永恒话题**（5 年后 "watchlist" 仍是 watchlist）
- **Stage / status = 时间性元信息**，走 frontmatter
- **roadmaps/ 是例外**——Stage 路线图本质就是时间轴产物，保留
- 当某个域的 spec 复杂到需要 spec + plan + tasks 多文件时，自然升级为 `<domain>/<feature>/` 子目录（spec-kit 风格的渐进式演进，无需提前规划）

## 四、Frontmatter Schema（每份 spec 顶部）

迁移时给每份 spec 加上：

```yaml
---
title: Watchlist
status: Draft | Accepted | Implementing | Done | Superseded
stage: 1 | 2 | 3 | 4 | 5 | continuous
created: 2026-05-18 # 原创建日期保留
updated: 2026-05-20 # 最近实质性修改
journey: J8 # docs/user-journeys.md 中的 journey ID
adrs: [008, 011] # 关联 ADR 编号
supersedes: [] # 被本 spec 替代的旧 spec 路径
superseded-by: null # 替代本 spec 的新 spec 路径
tags: [adapter, ui, cn-market] # 自由分类标签
---
```

**收益**：

- AI 可程序化抓取（`grep -A 10 "^---" **/*.md`）生成多种视图
- 状态变更不动文件位置，只改 frontmatter，git diff 干净
- README 多视图索引可由脚本自动生成（见 §六）

## 五、执行步骤

### 阶段 1：准备（重构前 1 周）

1. **域名最终敲定**：BoyangJiao review §三 的 10 个域名，必要时调整（如 `analytics/` vs `returns/`、`portfolio/` vs `holdings/`）
2. **Frontmatter schema 锁定**：必要时增减字段
3. **统计当前引用点**：`rg -l "\.specify/feature-specs/" --type-not lock` 留存 baseline
4. **创建独立分支**：`refactor/feature-specs-restructure`

### 阶段 2：执行（单次 commit / PR）

5. **创建新目录**：按 §三 创建 10 个能力域目录 + `roadmaps/`
6. **git mv 文件**：按 §七 映射表逐一 `git mv`（保留 git history）
7. **添加 frontmatter**：每份 spec 顶部插入 §四 yaml block，从原 spec 头部 `- **Status**` / `- **Created**` 等字段迁移
8. **批量更新引用**：用 Python 脚本（参考本会话上次重构）替换全仓库 40+ 处路径
9. **改写 `README.md`**：删旧的"按 Stage"索引，替换为 4 视图入口（按域 / 按 Stage / 按状态 / 时间线）
10. **写 `_template.md`**：标准 spec 模板（含 frontmatter 示例 + 各章节占位）
11. **删除本文件**：`rm .specify/feature-specs/_RESTRUCTURE-PLAN.md`

### 阶段 3：可选自动化

12. **写 `tools/build-feature-specs-index.ts`**：扫描所有 spec 的 frontmatter，自动重生成 README 的 4 视图表格
13. **加 husky pre-commit hook**：检测 spec 文件变化时自动跑 index 重生成
14. **加 frontmatter schema 校验**：用 zod / yaml-schema 校验所有 spec 的 frontmatter 合法性

### 阶段 4：跟进文档更新

15. **更新 `CLAUDE.md`**：路径约定从 `<stage-dir>/<name>.md` 改为 `<domain>/<feature>.md`
16. **更新 `.specify/constitution.md`**：同上
17. **更新 `.specify/README.md`**：同上
18. **更新 `docs/HARNESS.md`**：同上
19. **更新 `docs/ux/README.md`**：同上

## 六、验证清单

迁移 PR 必须通过以下检查才能合并：

- [ ] `pnpm typecheck` 通过（spec 路径出现在代码注释中，不影响编译，但 ts 文件中的 `// 见 .specify/...` 应同步更新）
- [ ] `pnpm lint` 通过
- [ ] `pnpm test` 通过
- [ ] 全仓库 grep 无 stale 引用：`rg "feature-specs/(stage-[1-5]|cross-stage)/" --type-not lock` 应返回 0 结果
- [ ] 每份 spec 的 frontmatter 通过 schema 校验
- [ ] README 4 视图均可点击跳转（手工抽查 5 份）
- [ ] git log 显示所有文件均通过 `git mv` 重命名（保留 history）
- [ ] 手工打开 3 份关键 spec（rebalance / twr / daily-snapshot），确认 spec 内部相对链接（如 `../../../docs/adr/...`）也已更新

## 七、文件映射表（重构日参考）

| 现路径                                         | 目标路径                                 | 备注                      |
| :--------------------------------------------- | :--------------------------------------- | :------------------------ |
| `stage-1/data-model-stage-1.md`                | `data-model/stage-1-schema.md`           |                           |
| `stage-1/data-sources-stage-1.md`              | `data-sources/stage-1-adapters.md`       |                           |
| `stage-1/auth-magic-link.md`                   | `auth/magic-link.md`                     |                           |
| `stage-1/business-tokens-stage-1.md`           | `design-system/business-tokens.md`       |                           |
| `stage-2/daily-snapshot-stage-2.md`            | `snapshot/daily-snapshot.md`             |                           |
| `stage-2/watchlist-stage-2.md`                 | `watchlist/v1-basic.md`                  | 预留 v2 演进              |
| `stage-2/rebalance-stage-2.md`                 | `rebalance/v1-engine.md`                 | 预留 v2 演进              |
| `stage-2/welcome-stage-2.md`                   | `onboarding/welcome.md`                  |                           |
| `cross-stage/token-polish-sprint.md`           | `design-system/token-polish-sprint.md`   |                           |
| `cross-stage/component-audit.md`               | `design-system/component-audit.md`       |                           |
| `cross-stage/ui-polish-handoff.md`             | `design-system/ui-polish-handoff.md`     |                           |
| `stage-3/stage-3-roadmap.md`                   | `roadmaps/stage-3-roadmap.md`            |                           |
| `stage-3/tushare-adapter-stage-3.md`           | `data-sources/tushare-akshare.md`        | reshape 2026-05-20 已合并 |
| `stage-3/coingecko-adapter-stage-3.md`         | `data-sources/coingecko.md`              |                           |
| `stage-3/multi-portfolio-stage-3.md`           | `portfolio/multi-portfolio.md`           |                           |
| `stage-3/holdings-and-transactions-stage-3.md` | `portfolio/holdings-and-transactions.md` |                           |
| `stage-3/twr-stage-3.md`                       | `analytics/twr-mwr.md`                   |                           |
| `stage-3/performance-attribution-stage-3.md`   | `analytics/performance-attribution.md`   |                           |
| `stage-3/drawdown-stage-3.md`                  | `analytics/drawdown.md`                  |                           |

> **Stage 4 / 5 新增的 spec**：在本计划执行前，依然按 Stage 目录放（`stage-4/<name>-stage-4.md` 等），届时一并迁移。

## 八、回滚预案

如果迁移后发现重大问题：

```bash
git revert <migration-commit-sha>
git push
```

由于全部改动收敛在一个 PR / commit 内（包括引用更新），revert 即完整回到 Stage 目录形态，零残留。

## 九、现在可以做的低成本准备（可选）

以下动作**对当前开发零干扰**，但能让未来重构更顺：

1. **新 spec 起始就加 frontmatter**（哪怕路径还在 Stage 目录里）
   - Stage 4 / 5 的新 spec 一开始就用 §四 yaml block
   - 重构日不需要补 frontmatter，只需 git mv
2. **保持 spec 文件命名简洁**
   - 避免在文件名里塞 `-stage-N` 后缀（已存在的不动）
   - 新 spec 命名直接用功能名：`ai-screenshot-import.md` 而非 `ai-screenshot-import-stage-4.md`
3. **关键 spec 互相引用时用绝对路径**
   - `.specify/feature-specs/stage-2/rebalance-stage-2.md` 而非相对路径
   - 未来重构时只要全局替换路径即可，相对路径不会失效

## 十、关联文档

- 当前 README：[`./README.md`](./README.md)
- 项目宪法：[`../constitution.md`](../constitution.md) §spec-driven development
- 工程 harness：[`../../docs/HARNESS.md`](../../docs/HARNESS.md)
- SDD 总入口：[`../README.md`](../README.md)
- Stage 验收：[`../stage-acceptance-criteria.md`](../stage-acceptance-criteria.md)

---

## 维护

- 本文件**仅在以下情况编辑**：
  - 域名敲定 / 调整（§三）
  - Frontmatter schema 调整（§四）
  - 触发条件量化阈值变更（§二）
  - 新增映射表行（§七，Stage 4 / 5 新 spec 出现时）
- 重构执行完毕后**删除本文件**（其内容已被新 README + 实际目录结构取代）
