# UX 设计规范（Pattern Library）

本目录存放**跨功能、可复用**的交互与体验规范，供产品设计、移动端实现与 AI 辅助开发对齐。

## 与仓库其他文档的分工

| 目录 / 文件                        | 用途                                                             |
| :--------------------------------- | :--------------------------------------------------------------- |
| **`docs/ux/`（本目录）**           | 交互模式、Sheet/Overlay、导航语义、动效与 a11y 等 **UX pattern** |
| **`docs/adr/`**                    | 架构与技术决策（何时用哪套技术栈，而非像素级交互）               |
| **`.specify/feature-specs/`**      | 单个功能的验收契约与范围（可引用本目录 pattern ID）              |
| **`docs/design/`**                 | Pencil 等设计资产（`.pen`），与文字规范互补                      |
| **`packages/ui/DESIGN-TOKENS.md`** | 色值与语义 token，视觉层                                         |

## 规范索引

| 文档                                                     | 主题                                                           | 状态    |
| :------------------------------------------------------- | :------------------------------------------------------------- | :------ |
| [patterns/sheet-overlay.md](./patterns/sheet-overlay.md) | Sheet / Overlay / Dialog 选型、导航栏语义、Grabber、嵌套与动效 | ✅ v1.0 |

新增规范时：在本表增加一行，并在文末 **更新日志** 记一笔日期与摘要。

## 命名与存放约定

- **路径**：`docs/ux/patterns/<topic>.md`，文件名使用 **kebab-case**，一主题一文件。
- **标题**：首行 `# …`，与文件名主题一致，便于搜索。
- **版本**：文内保留「最后更新」与附录 **更新日志**；大改版可 bump `v1` → `v2`。
- **与 Arc 对齐**：若规范涉及实现层（如必须用 `InScreenHeader`、HeroUI `BottomSheet`），在文内或 PR 描述中链接对应 ADR / `@arc/ui` 组件，避免与 ADR 006/008 冲突。

## 开发工作流

1. 新模态、新流程 → 先查本目录是否有适用 pattern。
2. 实现 → 在 PR / feature spec 中写明「遵循 `docs/ux/patterns/xxx.md` §N」。
3. 产品迭代导致 pattern 变更 → 先改 markdown，再改代码，避免口头约定漂移。

---

_维护者：与 `docs/information-architecture.md`、`docs/user-journeys.md` 同层级的产品/设计输入；会话入口见根目录 `CLAUDE.md` 按需阅读。_
