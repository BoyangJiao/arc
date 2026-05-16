---
name: design-snapshot
description: Capture design provenance for an Arc feature — iOS/Web screenshots + Pencil .pen files. Trigger only when user explicitly requests it ("snapshot the design", "出设计稿", "/design-snapshot"). Used for major iterations, journey-completion milestones, or before PR review. Skip for small tweaks (字段、间距、文案).
---

# design-snapshot

Capture **visual provenance** for an Arc feature: iOS screenshot + Web screenshot + Pencil `.pen` design file. Used to:
- Track UI iteration history (commit-level "what did this PR change visually")
- Build a flow-level overview of user journeys (canvas view of all screens in a journey)
- Provide a structured visual spec to the next AI agent / designer

## When to invoke

**ONLY** when the user explicitly asks for it. Examples:
- "snapshot the portfolio detail page"
- "出一份设计稿留痕"
- `/design-snapshot <feature-name>`
- "before this PR, make a design snapshot"

**Do NOT** auto-trigger after every code change. The full flow is expensive (token + time) and isn't worth it for tweaks.

## When to skip (even if implicitly suggested)

- Field-level changes (label text, padding, single icon swap)
- Bug fixes that don't change layout/interaction
- Refactors with no visual impact
- Theme/token changes that re-render existing screens identically

If unsure, ask: "Do you want a design snapshot for this change? It will take ~3-5 min and create files in `designs/<name>/` and `docs/screenshots/<name>/`."

## Pre-conditions

- The feature/journey is implemented and currently runnable on iOS sim (mobile-start or mobile-ios server running)
- The user has Pencil installed and a working Pencil MCP connection (or Pencil CLI in PATH)
- A feature name from the user (will be used as folder name, e.g. `portfolio-detail`, `add-transaction`)

If Pencil is not available, fall back to **screenshots only** and tell the user explicitly.

## Workflow

### Step 1 — Confirm scope

Ask the user (if not already given):
1. **Feature name** for the snapshot folder (kebab-case, e.g. `add-transaction`)
2. **Screens to capture** — list each route + state (empty / filled / error / loading)
3. **Whether to include Pencil** (default: yes, unless Pencil unavailable)

### Step 2 — Capture screenshots

For each screen × state combination:

1. **iOS sim**: ensure app is on the target screen. Use:
   ```bash
   # If sim already shows it: use Xcode menu Window → Capture Screen
   # Or via simctl:
   xcrun simctl io booted screenshot --type=png "/tmp/<feature>-<screen>-<state>-ios.png"
   ```

2. **Web**: use `mcp__Claude_Preview__preview_screenshot` with the active server.

3. **Move both to** `docs/screenshots/<feature>/` with naming `<screen>-<state>-{ios|web}.png`.

### Step 3 — Generate Pencil design files (if available)

For each captured screen, generate a corresponding `.pen` file in `designs/<feature>/`:

1. Check Pencil availability: try `mcp__pencil__get_editor_state` (with `include_schema: true`).
   - If error mentions "failed to connect" → Pencil not available → skip Pencil step, note in summary.

2. For each screen, call `mcp__pencil__open_document` (or `batch_design`) to create `designs/<feature>/<screen>.pen` based on:
   - Screen content (what's actually rendered)
   - Token references (use Foundation/Semantic names from ADR 003, not hex values)
   - Layout structure (Stack / Card / Row, not pixel-perfect)

3. The `.pen` file is **a structured spec, not a pixel-perfect mock**. Goal: AI/human reviewer can read it as design intent.

### Step 4 — Generate flow overview (optional, only when user asks)

For a complete journey (e.g. J2 — Add first transaction), create one `.pen` file with all screens laid out side-by-side on the canvas:

1. Create `designs/<feature>/_flow.pen`
2. Place each screen as a node on the canvas in order
3. Add arrows showing transitions (state, action that triggers each)

### Step 5 — Update PR description

If a PR is open, append to its body:
```markdown
## Design provenance

### Screens
- ![add-transaction empty](docs/screenshots/add-transaction/empty-ios.png) (also: [web](docs/screenshots/add-transaction/empty-web.png))
- ![add-transaction filled](docs/screenshots/add-transaction/filled-ios.png) (also: [web](docs/screenshots/add-transaction/filled-web.png))

### Pencil design files
- `designs/add-transaction/index.pen`
- `designs/add-transaction/_flow.pen`
```

If no PR yet, just print the asset paths to the user with a note "ready to attach to PR description".

### Step 6 — Commit hygiene

- `.pen` files **are checked in** (versioned design provenance)
- `docs/screenshots/<feature>/*.png` **are checked in** (small, journey-defining shots)
- **Never** check in:
  - `*.pen.bak`, `*.pen.tmp`, Pencil session caches → add to `.gitignore` if they appear
  - High-res / debug screenshots not part of journey provenance → put in `/tmp/`

## Output to user

At the end, report:
```
Design snapshot complete: <feature>
- Screenshots: <count> files in docs/screenshots/<feature>/
- Pencil files: <count> files in designs/<feature>/  (or: skipped — Pencil unavailable)
- PR updated: <yes / no>

Next steps:
- Open designs/<feature>/_flow.pen in Pencil to review the journey overview
- Adjust spec there; AI agents will read your changes as the canonical UI spec on the next iteration
```

## Failure modes & fallbacks

| Failure | Fallback |
|:---|:---|
| iOS sim not booted | Tell user, ask them to boot sim before retrying |
| Web preview server not running | Skip Web screenshots, note in summary |
| Pencil MCP unreachable | Run `mcp__pencil__get_editor_state` first to detect; if fails, fall back to screenshots-only and tell user explicitly |
| `xcrun simctl io` fails | Try alternative: ask user to manually screenshot via `Cmd+S` in sim and place file in `docs/screenshots/<feature>/` |

## Anti-patterns (do NOT)

- ❌ Auto-trigger after every code change without user asking
- ❌ Generate `.pen` files for screens that haven't been built yet (no point — content would be guessed)
- ❌ Capture screens with placeholder data; always wait for realistic content
- ❌ Check in massive screenshot dumps; only journey-defining shots
- ❌ Skip the user-facing summary at the end
