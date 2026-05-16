# AGENTS.md — 多工具 AI 开发入口

Cursor、Claude Code、Qoder 等**共用同一套规范**，不要维护多份平行规则。

## 新会话必读（顺序）

1. `.specify/session-state.md` — 当前进度与下一步
2. `CLAUDE.md` — 项目铁律与结构
3. `.specify/constitution.md` — P0 约束与禁忌文案

## 会话结束

更新 `session-state.md` 后再切换工具或关会话：

- **Cursor**：`/checkpoint`（`.cursor/commands/checkpoint.md`）
- **Claude Code**：`/checkpoint` skill（`.claude/skills/checkpoint/`）

## 工具配置（仅路径映射，规则正文只在 CLAUDE.md / .cursor/rules）

| 能力       | Cursor                    | Claude Code                        | Qoder                    |
| :--------- | :------------------------ | :--------------------------------- | :----------------------- |
| 项目 rules | `.cursor/rules/*.mdc`     | —                                  | —                        |
| 会话 hooks | `.cursor/hooks.json`      | `.claude/settings.json`            | —                        |
| Skills     | `.cursor/skills/`（镜像） | `.claude/skills/`（**canonical**） | `.qoder/skills/`（镜像） |

`pnpm sync:skills` 或 husky 自动把 canonical 同步到各 IDE 镜像目录。

完整 harness 说明：`docs/HARNESS.md`
