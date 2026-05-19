# seed-dev

Run dev seed data for UAT (Layer 4). Requires `DEV_SEED_EMAIL` in repo-root `.env.dev.local`.

## When the user invokes this command

1. Read their message for a **scenario** (aliases below). Default: `default`.
2. Run the matching **pnpm shortcut** from repo root (Shell tool, `required_permissions` if needed for network to Supabase):

| User says (examples)       | Command                  |
| :------------------------- | :----------------------- |
| default, happy, 日常, +2%  | `pnpm seed:default`      |
| gain, big-gain, 大涨, +10% | `pnpm seed:ds:gain`      |
| loss, big-loss, 大跌, -5%  | `pnpm seed:ds:loss`      |
| mixed, movers, 红绿, 排序  | `pnpm seed:ds:mixed`     |
| first-day, 首日, 占位      | `pnpm seed:ds:first-day` |
| empty, 空仓, 空组合        | `pnpm seed:ds:empty`     |

3. If seed succeeds, tell the user: **iOS Simulator ⌘D → Reload** (not ⌘R — that's often screenshot) on Portfolio Tab; force-quit app only if stale.
4. If seed fails (missing `DEV_SEED_EMAIL`, migration, user not found), diagnose from terminal output and point to `docs/dev-seed-cheatsheet.md`.

## Do not

- Put service role keys in chat or commit them.
- Use in-app mock to replace seed unless user explicitly wants UI-only preview (Layer 5).

## Reference

- Cheatsheet: `docs/dev-seed-cheatsheet.md`
- Full scenario list: `pnpm seed:dev --help`
