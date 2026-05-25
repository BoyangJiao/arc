# Arc Engineering Harness

> The "harness" is everything around your code that catches mistakes before
> they become incidents — git hooks, CI gates, type system, tests, automated
> sessions. This document explains what's wired up and how to use it.

Inspired by Red Hat's "harness engineering" practice (2026) and adapted to
Arc's solo + AI-pair-programming workflow.

---

## Layer 1 — Session automation (Claude Code + Cursor)

Shared scripts live in `.claude/hooks/`. Both IDEs run the same checks.

| Script             | Claude Code (`settings.json`) | Cursor (`.cursor/hooks.json`) | What it does                                                                                                                                                                                                                        |
| :----------------- | :---------------------------- | :---------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `session-start.sh` | SessionStart                  | `sessionStart`                | (remote only) `pnpm install --silent`<br>(always) checks `.specify/constitution.md` mtime → reminds AI to re-read if updated within 7 days<br>(always) runs `pnpm typecheck` and reports 6/6 status; surfaces first 5 errors if any |
| `quality-gate.sh`  | Stop                          | `stop` (120s timeout)         | Blocks task completion if `pnpm typecheck` or `@arc/core` tests fail                                                                                                                                                                |

**Cursor rules**: `.cursor/rules/*.mdc` — P0 bootstrap, financial invariants, copy compliance; file-scoped UI/i18n rules.

**Effect**: any new AI session starts with a known-good baseline; ending a Cursor agent run is gated the same way as Claude Code Stop.

---

## Layer 2 — `.husky/` — Git Hooks

Managed via [husky](https://typicode.github.io/husky/) (set automatically by `prepare` script in `package.json`).

| Hook            | Trigger                       | What it does                                                                                                                                                                                                                         |
| :-------------- | :---------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pre-commit`    | `git commit`                  | 1. Runs `pnpm exec lint-staged` on staged files only (fast, ~2s). Currently: prettier on `.{ts,tsx,json,md,css,yml,yaml}`.<br>2. If `.claude/skills` has staged changes → runs `tools/sync-skills.sh` to keep local mirrors in sync. |
| `post-checkout` | `git checkout` / `git switch` | Runs `tools/sync-skills.sh` quietly (sync canonical skills → local mirrors).                                                                                                                                                         |
| `post-merge`    | `git pull` (if merge happens) | Same as `post-checkout`.                                                                                                                                                                                                             |

**Setup**: hooks install automatically when running `pnpm install` (via `prepare` lifecycle script). Manual install: `pnpm exec husky init`.

**Bypass**: `git commit --no-verify` (use sparingly; CI gate will still catch).

**Migration note**: `tools/git-hooks/` (custom `core.hooksPath` approach) was removed in favor of husky. The old `pnpm setup:hooks` script no longer exists.

---

### Skills 同步架构

项目采用 **canonical source + 本地镜像** 模式管理跨 IDE 的 skills：

- **Canonical source**：`.claude/skills/` — 纳入 Git 版本控制，随代码提交推送
- **本地镜像**：`.qoder/skills/`、`.cursor/skills/` — 在 `.gitignore` 中，仅本地可见
- **同步方向**：单向，canonical → 镜像
- **同步脚本**：`tools/sync-skills.sh`（以 `.claude/skills` 为 source of truth）

新 IDE 只需在 `tools/sync-skills.sh` 的 `MIRROR_DIRS` 增加目标路径。

| 触发时机   | Hook            | 说明                                       |
| :--------- | :-------------- | :----------------------------------------- |
| 提交代码时 | `pre-commit`    | 检测 `.claude/skills` 有 staged 变更才执行 |
| 切换分支后 | `post-checkout` | 静默执行，确保镜像与当前分支一致           |
| 拉取代码后 | `post-merge`    | 静默执行，同步远程新增/变更的 skills       |

手动同步：`pnpm sync:skills`

---

## Layer 3 — `.github/workflows/` — CI Gates

| Workflow       | Trigger                                           | Steps                                               | Time    |
| :------------- | :------------------------------------------------ | :-------------------------------------------------- | :------ |
| `pre-push.yml` | Every push to any branch + PRs to `main`/`dev/**` | pnpm install → typecheck → lint → `@arc/core` tests | ~60-90s |

**Concurrency**: per-ref cancellation (newer push cancels older job).

**Failure modes**:

- Typecheck fail → check `pnpm typecheck` locally first, fix and force push
- Lint fail → `pnpm lint --fix` + commit
- Test fail → `pnpm --filter @arc/core test` locally to reproduce; fix code or test; never disable the test

---

## Layer 4 — `packages/core/__tests__/` — Property-Based Tests

Powered by [vitest](https://vitest.dev) + [fast-check](https://fast-check.dev).

| Test file                | What it enforces                                                                                                       | Lines (approx) |
| :----------------------- | :--------------------------------------------------------------------------------------------------------------------- | :------------: |
| `decimal.spec.ts`        | Decimal arithmetic invariants (commutativity, associativity, identity, inverse) + the canonical `0.1 + 0.2 = 0.3` test |    6 tests     |
| `asset-id.spec.ts`       | `composeAssetId` / `parseAssetId` round-trip + invalid input rejection (Law 1 from data-model-invariants)              |    4 tests     |
| `types-readonly.spec.ts` | TypeScript readonly enforcement on Asset / Transaction / Holding                                                       |    3 tests     |

**Run**:

```bash
pnpm test                                # all workspaces (turbo cached)
pnpm --filter @arc/core test             # @arc/core only
pnpm --filter @arc/core test:watch       # interactive watch mode
```

**Adding new tests**: drop `*.spec.ts` in `packages/core/__tests__/`. Naming: one file per invariant or feature module. Use `fc.assert(fc.property(...))` for property tests; use `expect()` for example-based tests. **Mix both** — property tests cover infinite input space, example tests pin specific behaviors.

**Why property-based for Arc**: financial calculations have many edge cases (negative quantities, zero, very large/small numbers, rounding boundaries). Property tests find these automatically by sampling thousands of random inputs.

---

## Layer 5 — `.specify/` — Spec-Driven Development Layer

Not a runtime mechanism but a **read-time contract** for AI agents and humans. Every Claude session reads `constitution.md` (surfaced via SessionStart hook); every PR honors `data-model-invariants.md`.

| File                                  | Read by                                    | Purpose                                                                                         |
| :------------------------------------ | :----------------------------------------- | :---------------------------------------------------------------------------------------------- |
| `README.md`                           | New contributors                           | What is `.specify/`, when to update each file                                                   |
| `constitution.md`                     | All AI sessions, all PR reviewers          | Project-wide invariants (P0 + P1 constraints, forbidden phrases)                                |
| `data-model-invariants.md`            | When changing domain types or computations | The 5 immutability laws (formal version of CLAUDE.md §3.2)                                      |
| `stage-acceptance-criteria.md`        | At Stage gates / PR review                 | Per-Stage DoD in BDD format, tied to user-journeys.md                                           |
| `feature-specs/<stage-dir>/<name>.md` | Before implementing a non-trivial feature  | Spec-first development — write the contract before the code（索引见 `feature-specs/README.md`） |

See `.specify/README.md` for full workflow.

---

## Layer 6 — Context packaging (Repomix, agent-automated)

[Repomix](https://github.com/yamadashy/repomix) packs selected source files into one LLM-friendly XML bundle. Arc uses it to **reduce cold-start grep cost** when switching IDE, model, or feature scope. It complements SDD (intent in specs) — it does **not** replace `session-state.md`, ADRs, or feature specs.

**Developer experience: zero manual commands.** Agents and hooks run Repomix; the developer only reads session-state as today.

| Trigger                              | Who runs                           | Command                                                |
| :----------------------------------- | :--------------------------------- | :----------------------------------------------------- |
| Session start (Cursor / Claude Code) | `session-start.sh` hook            | `node tools/repomix-auto-context.mjs --ensure --quiet` |
| New feature implementation session   | Agent (rule `05-repomix-auto.mdc`) | `pnpm ctx:auto --ensure`                               |
| `/checkpoint`                        | Agent (checkpoint skill Step 3)    | `pnpm ctx:auto --ensure` + optional `--dump`           |
| Slug inference debug                 | Agent / maintainer                 | `pnpm ctx:infer --json`                                |

**Machine pointers** (gitignored):

- `.specify/codectx/.active.json` — `{ slug, path, generatedAt }` written on every auto run
- `session-state.md` §You are here — **Context slug** + **Context bundle** rows (checkpoint maintains)

| Command                   | Purpose                                                              |
| :------------------------ | :------------------------------------------------------------------- |
| `pnpm ctx:auto`           | **Default** — infer slug from session-state/git, ensure bundle fresh |
| `pnpm ctx:auto --dump`    | Timestamped snapshot (handoff history)                               |
| `pnpm ctx:infer`          | Debug slug inference only                                            |
| `pnpm ctx:feature <slug>` | Manual override (legacy; agents prefer `ctx:auto`)                   |
| `pnpm ctx`                | Full monorepo snapshot (heavy; rare)                                 |

**Slug inference** (`tools/repomix-infer-slug.mjs` + `tools/repomix-slug-registry.json`): scores session-state, handoffs, and recent git paths against Stage 3 feature slugs. Explicit `**Context slug**` in session-state wins.

**Typical workflow (no user steps)**

1. Agent reads `session-state.md` + feature spec
2. Hook or agent runs `ctx:auto` → Read `.specify/codectx/twr.xml` (example)
3. Checkpoint writes slug + path back to session-state for next session

**Rules (do not violate SDD)**

- Output lives in `.specify/codectx/` — **gitignored**, never commit
- Repomix is **not** a quality gate — do not add to husky or `quality-gate.sh`
- Generated code context ≠ design rationale — keep ADRs and feature specs as source of truth for _why_

---

## Quick Reference

### Common commands

```bash
pnpm install                  # installs deps + auto-runs husky
pnpm typecheck                # all workspaces (cached via turbo)
pnpm lint                     # all workspaces
pnpm test                     # all property tests
pnpm test:watch               # interactive
pnpm format                   # prettier on full repo (rare; lint-staged handles per-commit)
pnpm sync:skills              # manual skill sync (post-checkout/merge auto-runs this)
pnpm ctx:auto                 # agent/hook: infer slug + refresh bundle (developer: no-op)
pnpm ctx:infer                # debug slug inference
```

### Adding a new test

```bash
# 1. Create file
touch packages/core/__tests__/my-feature.spec.ts

# 2. Write tests (see existing files for pattern)

# 3. Run locally
pnpm --filter @arc/core test

# 4. Commit — pre-push CI will verify
git commit -m "test(core): cover X invariant"
```

### Bypassing the harness (when justified)

| Action               | Bypass                                   | When justified                                        |
| :------------------- | :--------------------------------------- | :---------------------------------------------------- |
| Skip pre-commit hook | `git commit --no-verify`                 | Emergency fixes, never skip lint/format intentionally |
| Skip CI gate         | force-merge in GitHub UI                 | Never — fix the code or fix the test                  |
| Skip typecheck       | `// @ts-expect-error` with reason        | Specific known issues with library type definitions   |
| Skip property test   | `test.skip()` with TODO + tracking issue | Test is wrong, not the code                           |

---

## What's NOT in the harness (by design)

- **E2E tests** (Detox/Playwright) — Stage 4 P0
- **LLM eval harness** (promptfoo / inspect_ai) — Stage 4+ when AI features ship
- **Persistent code graph DB** (GitNexus / CodeGraph) — Repomix covers Arc's solo cold-start need
- **Dev container** — solo dev, not needed
- **Pre-push hook** locally — CI gate is sufficient; husky `pre-push` would slow local workflow
- **Branch protection rules** on `main` — single contributor, low value vs friction

These will be added at the appropriate Stage per `docs/development-plan.md`.

---

## Maintenance

- Husky version: 9.x (uses simple shell scripts; future v10 may bring breaking changes — review release notes)
- vitest version: 4.x (active, stable; updates regularly)
- fast-check version: 4.x (mature, stable API)

When upgrading any of these, run the full harness once before committing the upgrade:

```bash
pnpm install
pnpm typecheck && pnpm lint && pnpm test
```

---

## See also

- `.specify/constitution.md` — what the harness enforces
- `.specify/data-model-invariants.md` — the 5 laws property tests verify
- `CLAUDE.md` §十二 — quick pointer to this harness for AI agents
- ADR 003 v3.1 — token architecture (subject to harness via lint rules in Stage 2+)
