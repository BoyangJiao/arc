本项目的开发规范来源：

1. **冷启动**：`.specify/session-state.md` → `CLAUDE.md` → `.specify/constitution.md`（详见 `.cursor/rules/00-session-bootstrap.mdc`）
2. **完整规范**：根目录 `CLAUDE.md`

Cursor 用户：项目 rules 在 `.cursor/rules/`；slash 命令 `/checkpoint` 在 `.cursor/commands/`。Skills 从 `.claude/skills/` 同步到 `.cursor/skills/`（`pnpm sync:skills`）。

请先完整阅读上述文件，然后遵循所有规则执行任务。不要绕过或忽略任何条目。
