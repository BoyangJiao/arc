# Handoff — Context bundle (Repomix)

> **Paste this block into any `.specify/handoffs/*-kickoff.md`** after the "必读" section.
> Keeps cross-IDE cold starts consistent with `docs/HARNESS.md` Layer 6.

---

## Code context bundle（Repomix，可选但推荐）

本任务相关代码已可通过 Repomix 一键打包。**新会话冷启动时**，在读完 spec 后运行：

```bash
pnpm ctx:feature <slug>
# 输出：.specify/codectx/<slug>.xml — gitignored，attach 到 chat 或 pbcopy
```

**本 handoff 对应 slug**：`<FILL: e.g. twr>`

| 方式                               | 命令                                         |
| :--------------------------------- | :------------------------------------------- |
| 稳定 bundle（覆盖写入）            | `pnpm ctx:feature <slug>`                    |
| 带时间戳 snapshot（checkpoint 用） | `pnpm ctx:dump <slug>`                       |
| 直出 stdout                        | `pnpm ctx:feature <slug> --stdout \| pbcopy` |

**不要**用 Repomix 输出替代 spec / ADR / session-state — 它只补 **代码长什么样**，不解释 **为什么这样设计**。

Config 路径：`.specify/feature-specs/stage-3/<slug>.repomix.json`
