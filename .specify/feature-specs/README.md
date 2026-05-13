# Feature Specs

> One Markdown file per non-trivial feature, **written before code**.

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

## Spec template

Save as `<kebab-case-feature-name>.md`. Example: `add-transaction-modal.md`.

```markdown
# Feature: <name>

- **Status**: Draft | Implementing | Done
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
2. **Implementing** → After spec review, code follows
3. **Done** → Code merged + acceptance criteria met. Spec stays as historical record.

## Examples (to come)

Empty until first non-trivial feature lands. Anticipated first specs:

- `signup-magic-link.md` (J1, Stage 1)
- `add-transaction-modal.md` (J2, Stage 1)
- `daily-snapshot.md` (J7, Stage 2)
- `rebalance-setup.md` (J9, Stage 2)
- `csv-import.md` (J10, Stage 2)

These will be created as their respective stages begin implementation.
