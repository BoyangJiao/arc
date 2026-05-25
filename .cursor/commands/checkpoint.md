# checkpoint

Update `.specify/session-state.md` so the next session (Cursor or Claude Code) can resume cold.

Follow the full workflow in `.claude/skills/checkpoint/SKILL.md`:

1. Gather git status, recent commits, branch, CI if relevant, active todos
2. Diff against existing `session-state.md` — update only changed sections
3. Set **Last updated** timestamp and author (tool name)
4. **Optional**: if working on a Stage 3 feature, run `pnpm ctx:dump <slug>` and tell the user the output path (gitignored; attach in next session)

Invoke when ending a work block, before switching IDE, or when the user asks to save state.
