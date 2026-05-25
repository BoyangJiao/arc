---
name: checkpoint
description: Update .specify/session-state.md with current project progress so the next AI session (Cursor, Claude Code, etc.) can resume cold without losing context. Trigger at end of major work blocks ("commit-equivalent moments"), before context window fills, or on user request ("checkpoint", "save state", "/checkpoint", "before I close, save").
---

# checkpoint

Snapshot the live project state into `.specify/session-state.md` so any future AI session (Cursor, Claude Code, this repo) can resume from cold with zero context loss.

## When to invoke

- User explicitly asks: "checkpoint", "save state", "before I close, save progress", "/checkpoint"
- Context window is approaching capacity (~80%) and current work is at a natural pause
- After completing a Stage step, ADR, major feature spec, or 5+ commits worth of work
- Before switching to a new model / new session deliberately

## When NOT to invoke

- Mid-implementation of a single function (not a natural pause)
- Trivial commits (typo fixes, single-line changes)
- If `session-state.md` was updated within the last hour and nothing material changed since

## Workflow

### Step 1 — Gather current state

Run, in parallel where possible:

```bash
# 1. What branch + recent commits
git status --short
git log --oneline -10
git rev-parse --abbrev-ref HEAD

# 2. Current TodoWrite state — read from your conversation, list active todos

# 3. CI status (if `gh` not installed, use API directly)
curl -sL "https://api.github.com/repos/$REPO/actions/runs?per_page=3" | \
  python3 -c "import json,sys; d=json.load(sys.stdin); \
  [print(f'{r[\"conclusion\"]} | {r[\"head_sha\"][:7]} | {r[\"name\"]}') for r in d.get('workflow_runs',[])[:3]]"

# 4. Background tasks still running (Metro, etc.) — list from your context
```

### Step 2 — Diff against existing session-state.md

Read `.specify/session-state.md` and identify which sections changed:

- **Always update**: §"Last updated" timestamp, §"You are here" table, §"Stage progress" status column
- **Update if changed**: §"Recent decisions", §"Active blockers", §"Immediate next actions"
- **Append-only (don't rewrite)**: §"Critical mental model" — only add new gotchas, don't remove
- **Refresh if stale**: §"Active env / config snapshot"

### Step 3 — Write updated file

Use Edit (preferred over full Write) to modify only the changed sections. Preserve the file's structure exactly — the section names and table formats are part of the contract that future Claude sessions read.

Set the "Last updated" line:

```md
> **Last updated**: YYYY-MM-DD by <model name from your context>
```

### Step 4 — Stage + commit (do not push)

```bash
git add .specify/session-state.md
git commit -m "chore(state): checkpoint — <one-line summary of what changed>

Updated by /checkpoint skill at session pause.
- <bullet 1: what step is now done>
- <bullet 2: what's the next thing>
- <bullet 3: any new decision worth capturing>
"
```

**Don't push** — let user push at their cadence (or future commit will carry it). This avoids noisy CI runs for state-only commits.

### Step 5 — Report to user

```
Checkpoint saved → .specify/session-state.md (commit <sha>)

Summary:
- Stage / step: <X.Y → X.Z>
- Last commits captured: N
- Open blockers: M
- Updated sections: A, B, C

Next session can resume by reading CLAUDE.md → session-state.md → starting work.
```

### Step 6 — Optional: dump code context bundle (Repomix)

If the session was working on a **known feature slug** (Stage 3 Block A–D), offer to dump a timestamped code snapshot for the next session:

```bash
# Ask user or infer slug from active feature spec / handoff doc
pnpm ctx:dump <slug>
# e.g. pnpm ctx:dump twr  →  .specify/codectx/twr-20260525-112100.xml
```

- Output is **gitignored** (`.specify/codectx/`) — never commit
- Mention the path in your report so the user can attach it when starting the next IDE session
- Slugs: `twr`, `performance-attribution`, `drawdown`, `tushare-adapter`, `coingecko-adapter`, `multi-portfolio`, `holdings-and-transactions`, `stage-3-roadmap`; scope shortcuts: `core`, `data-sources`, `mobile-portfolio`
- Skip if no active feature scope or user declines — this is opt-in, not every checkpoint

See `docs/HARNESS.md` Layer 6 for full Repomix workflow.

## Anti-patterns (do NOT)

- ❌ Push the checkpoint commit — pollutes CI and creates noise. Let the next real commit carry it forward.
- ❌ Rewrite `session-state.md` from scratch — Edit specific sections; preserve structure.
- ❌ Add transient state (e.g., "currently typing X")— only durable handoff info.
- ❌ Duplicate info already in `constitution.md` / ADR / feature-spec — link to those instead.
- ❌ Run on every commit — this skill is for natural pauses, not every change.

## Resume protocol (for the NEXT session)

When a new Claude session starts (per CLAUDE.md "P0 必读"):

1. Read `.specify/session-state.md` first
2. Cross-reference last commit's hash in `git log -1` to verify state file is fresh
3. If state file > 24h old AND repo has new commits since: re-derive state from `git log` + report stale-checkpoint to user
4. Begin work on the "Immediate next actions" section
