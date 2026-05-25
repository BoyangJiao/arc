# checkpoint

Update `.specify/session-state.md` so the next session (Cursor or Claude Code) can resume cold.

Follow the full workflow in `.claude/skills/checkpoint/SKILL.md`:

1. Gather git status, recent commits, branch, CI if relevant, active todos
2. Diff against existing `session-state.md` — update only changed sections
3. Set **Last updated** timestamp and author (tool name)
4. If session-state lists **Context bundle**, Read that file after spec (Repomix auto — user does not run commands)

Invoke when ending a work block, before switching IDE, or when the user asks to save state.
