# Handoff — Context bundle (Repomix, automatic)

> Repomix is **agent-automated** — do not instruct the developer to run `pnpm ctx:feature`.
> Paste only if you need to remind the **next agent**.

---

## Code context（自动，开发者无感）

下一 agent 应：

1. 读 `session-state.md`（含 **Context slug** / **Context bundle** 行，checkpoint 写入）
2. 运行 `pnpm ctx:auto --ensure`（或依赖 session-start hook）
3. Read `.specify/codectx/.active.json` 或 session-state 中的 bundle 路径

**本 handoff 预期 slug**：`<FILL: e.g. twr>`

Config：`.specify/feature-specs/stage-3/<slug>.repomix.json`

Repomix 补代码全文；spec / ADR / session-state 补 intent — 不互相替代。
