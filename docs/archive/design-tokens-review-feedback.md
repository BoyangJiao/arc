# ADR 003 Token 架构优化

> **⚠️ SUPERSEDED** by [ADR 008 — Token 使用纪律与 UI Polish Sprint](../adr/008-token-discipline-and-polish.md)（2026-05-19）。
>
> 本文档保留为历史决策记录。其中提出的 `bg-page` / `bg-card` 命名方案**已被 ADR 008 决策二回滚**，恢复 `surface` / `surface-secondary` / `surface-tertiary` 命名（HeroUI 业内事实标准，详见 [packages/ui/DESIGN-TOKENS.md](../../packages/ui/DESIGN-TOKENS.md)）。

## 目标

回应 review 中发现的两个问题：

1. Semantic 层职责混乱（UI 角色与业务语义混杂）
2. 通用 Semantic 到 Foundation 的映射缺失，只有 finance 部分给了示例

## 修改范围

仅修改 [docs/adr/003-design-tokens.md](file:///Users/boyang/Code/Arc/arc/docs/adr/003-design-tokens.md)。不改动代码（tokens 实际落地仍按原计划在 Stage 1 第一个页面前进行）。

---

## Task 1：重写「决策一」——从四层架构到四层 + 平行 Business

把原先单层 Semantic 明确拆为两个平行维度：

```
Primitive -> Foundation -> Semantic (UI 角色) -> Component
                        \-> Business (finance) /
                             |
                             映射目标是 Foundation（不是 Semantic）
```

- **Semantic (UI 角色)**：只包含 Background / Foreground / Border 三类，覆盖 figma 和常规视觉设计中的通用元素分类
- **Business**：只包含真正带业务含义的 token（gain / loss / pnl-neutral / deviation-warning / deviation-critical），映射到 Foundation
- 说明 Foreground 同时承载文字和图标（token 值共享，class 前缀 `text-*` / `fill-*` 不同，命名用 `fg-*`）

## Task 2：新增「决策 X」——完整 Semantic → Foundation 映射表

用一张表列出所有通用 UI 角色 token 在 light/dark 下的 Foundation 映射。示例结构：

| Semantic token      | 用途                | Light 映射          | Dark 映射           |
| ------------------- | ------------------- | ------------------- | ------------------- |
| `bg-page`           | 页面根背景          | `background`        | `background`        |
| `bg-card`           | 卡片/列表项背景     | `surface`           | `surface`           |
| `bg-card-secondary` | 层叠卡片第二级      | `surface-secondary` | `surface-secondary` |
| `bg-overlay`        | Modal/Popover 背景  | `overlay`           | `overlay`           |
| `bg-skeleton`       | 骨架屏占位          | `skeleton`          | `skeleton`          |
| `fg-primary`        | 主文字/图标         | `foreground`        | `foreground`        |
| `fg-secondary`      | 次要文字/图标       | `muted`             | `muted`             |
| `fg-on-accent`      | accent 背景上的文字 | `accent-foreground` | `accent-foreground` |
| `border-default`    | 通用边框            | `border`            | `border`            |
| `border-focus`      | 聚焦边框            | `focus`             | `focus`             |
| `divider`           | 分隔线              | `separator`         | `separator`         |

（具体条目在实施时按 HeroUI Native v1.0.2 实际 foundation token 对齐，上表为示意）

## Task 3：重写「决策四」——Business 层（替代原 finance 子层）

- 收敛为 5 个核心 token：`gain` / `loss` / `pnl-neutral` / `deviation-warning` / `deviation-critical`
- 明确声明：原文中的 `textPrice` / `textPriceSecondary` / `textTimestamp` / `textDisclaimer` / `bgMarketBadge` 不再作为独立 token，直接复用 Semantic 的 `fg-primary` / `fg-secondary` / `bg-card-secondary`
- Business token 映射目标是 **Foundation**（不是 Semantic），因为业务"意义"是 Foundation 级别的（success/danger/warning）
- Component 层使用时由 className 前缀决定渲染为前景（`text-gain`）还是背景（`bg-gain-soft`）

## Task 4：更新「决策五」红涨绿跌切换机制图

原图 Foundation → Semantic 改为 Foundation → Business，文字说明同步更新：切换发生在 Business 层，Semantic（UI 角色）永远不参与涨跌色切换。

## Task 5：更新「决策七」跳级规则

跳级规则改为：`Component -> Semantic | Business -> Foundation -> Primitive`，明确 Component 可以同时消费 Semantic 和 Business，但两者都不能跳 Foundation 直接到 Primitive（原有"中性灰阶"例外保留）。

## Task 6：更新实施清单

将原清单中涉及 tokens 文件的条目调整为明确的文件结构：

```
packages/ui/src/tokens/
├── index.ts
├── ui-roles.ts       # Semantic: bg-* / fg-* / border-*
├── business.ts       # Business: gain / loss / deviation-*
└── useFinanceColors.ts  # 红涨绿跌偏好 hook
```

原"`finance.ts` 实现 `financeSemantic()`"对应改为 `business.ts` + `useFinanceColors.ts`。

## Task 7：更新 token 总数核算表和「后果」章节

- 总数核算保持不变（Arc 新增仍是 info + skeleton）
- 后果章节补一条：Business 与 Semantic 解耦后，未来接入其他业务域（如非金融场景）时 Semantic 层零污染

## Task 8：更新 ADR 元信息

- `日期` 字段更新为今日（2026-05-08）
- 在文档头部 `相关 ADR` 下方加一行 `修订记录`，记录本次 review 的原因（收敛 Semantic 职责 + 补映射表）

---

## 不做的事

- 不改任何代码、不动 `packages/ui/src/tokens/*` 实际文件（仍按 ADR 原定时机 Stage 1 第一个页面前落地）
- 不修改 `apps/mobile/global.css`
- 不新增 ESLint 规则（保持原计划 Stage 1 末落地）
- 不为 `textPrice` 等被移除的 token 写迁移脚本（当前未有代码引用）
