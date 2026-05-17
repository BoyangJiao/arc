# Edge Function: `dev-seed`

Dev-only portfolio seeding for the **Arc Dev Tools** panel in the mobile app (`__DEV__` builds).

Uses the same scenario registry as `pnpm seed:dev` — see `supabase/functions/_shared/seed-core.ts`.

## One-time setup (dev Supabase project)

Install CLI (pick one):

```bash
# A) Via this repo (recommended)
pnpm install
pnpm postinstall:supabase-cli   # pnpm may block supabase's postinstall — run once manually
pnpm supabase --version         # should print 2.x

# B) One-off without repo install:
npx supabase --version

# C) macOS global (needs Homebrew):
brew install supabase/tap/supabase
```

Deploy (from repo root; first time: `pnpm supabase login`):

```bash
pnpm supabase link --project-ref jdvlzkictwinkgcvgwew
pnpm functions:secrets:dev-tools
pnpm functions:deploy:dev-seed
```

## Security model

| Layer   | Mechanism                                                                |
| :------ | :----------------------------------------------------------------------- |
| Project | `DEV_TOOLS_ENABLED=true` secret; refuses if URL contains `prod`          |
| Caller  | Must send a valid **user JWT** (the signed-in dev account)               |
| Writes  | `SUPABASE_SERVICE_ROLE_KEY` on the server only — never in the app bundle |
| Scope   | Only mutates data for `auth.uid()` of the caller                         |

## Manual test

```bash
# After signing in on the app, copy access_token from Supabase session (or use supabase auth)
curl -X POST \
  -H "Authorization: Bearer <USER_ACCESS_TOKEN>" \
  -H "apikey: <SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"scenario":"daily-snapshot:first-day"}' \
  https://jdvlzkictwinkgcvgwew.supabase.co/functions/v1/dev-seed
```

## App usage

Me → Settings → **Dev tools** → tap a scenario → Portfolio Tab refreshes (⌘D → Reload if needed).
