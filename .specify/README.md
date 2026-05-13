# `.specify/` — Spec-Driven Development Layer

This directory is Arc's formal **specification layer**, adapted from the
[GitHub Spec-Kit](https://github.com/github/spec-kit) convention. It complements
(but does not replace) `CLAUDE.md`, ADRs, `docs/development-plan.md`, and
`docs/user-journeys.md`.

## Purpose

Specifications here are the **non-negotiable contract** that any AI agent or
human contributor must honor when writing code. Where `CLAUDE.md` reads as
project orientation, this directory reads as **enforceable constraints**.

## Files

| File                           | Role                                                                                                                                                 | Read order |
| :----------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- | :--------: |
| `constitution.md`              | Project-wide invariants (code constraints, forbidden phrases, principles). **Read first.**                                                           |     1      |
| `data-model-invariants.md`     | The 5 immutability laws (Asset ID, single source, adapter abstraction, currency preservation, history vs current). Formal version of CLAUDE.md §3.2. |     2      |
| `stage-acceptance-criteria.md` | Per-Stage DoD in BDD format. Aligns with `docs/development-plan.md` stages and `docs/user-journeys.md`.                                              |     3      |
| `feature-specs/`               | One Markdown file per non-trivial feature, created before coding. Empty until Stage 1 features land.                                                 | as-needed  |

## How specs are enforced

| Layer                      | What it enforces                                                                                       |
| :------------------------- | :----------------------------------------------------------------------------------------------------- |
| `typecheck`                | Type constraints (Decimal types, readonly fields)                                                      |
| `eslint`                   | Code-style constraints (no `number` for money, no hard-coded colors, no hard-coded strings) — Stage 2+ |
| `pre-commit hook` (husky)  | Lint + format on changed files                                                                         |
| `pre-push CI gate`         | Typecheck + lint + property-based tests on every push                                                  |
| `Claude Code SessionStart` | Re-reads constitution on session start; reminds AI                                                     |
| Human review               | Anything machines can't enforce                                                                        |

## Relationship to `.claude/skills/`

| `.specify/`                               | `.claude/skills/`                       |
| :---------------------------------------- | :-------------------------------------- |
| What the code **must do**                 | How the AI **should work**              |
| Read by humans + AI alike                 | Loaded only by Claude Code skill system |
| Slow-changing (constitution rarely edits) | Can iterate skills freely               |

## When to update

- **Adding a new project-wide rule** → `constitution.md`
- **Adding / changing data model** → `data-model-invariants.md` + update `packages/core/src/domain/types.ts` to match
- **Stage gate adjustments** → `stage-acceptance-criteria.md` + sync with `docs/development-plan.md`
- **Writing a new feature** → Create `feature-specs/<name>.md` BEFORE writing code

## Inspiration

- GitHub Spec-Kit: https://github.com/github/spec-kit
- Anthropic Claude Code best practices
- Microsoft Azure SDK design guidelines
