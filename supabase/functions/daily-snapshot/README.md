# Edge Function: `daily-snapshot`

Per Stage 2 J7 feature spec ([.specify/feature-specs/daily-snapshot-stage-2.md](../../../.specify/feature-specs/daily-snapshot-stage-2.md)).

Reads cached `price_snapshots` + `fx_rates`, computes each portfolio's current valuation, upserts one row per portfolio into `portfolio_value_snapshots` with `as_of` = today 23:00:00Z.

**Idempotent**: same `(portfolio_id, as_of)` PK + `ON CONFLICT DO UPDATE`. Retrying the GitHub Actions workflow on the same UTC day overwrites; never duplicates.

**Zero outbound external API calls.** We snapshot what's already cached.

---

## Deploy (one-time)

`supabase/config.toml` sets **`verify_jwt = false`** for this function. The cron sends a
shared hex secret in `Authorization: Bearer …`, not a Supabase user JWT. Without this
flag the gateway returns `UNAUTHORIZED_INVALID_JWT_FORMAT` before your handler runs.

```bash
# Install Supabase CLI if you don't have it
brew install supabase/tap/supabase

# Link to the dev project
supabase link --project-ref jdvlzkictwinkgcvgwew

# Set the shared secret on the project (used by GH Actions workflow auth)
# Generate a random secret first; save the same value into a GitHub Actions repo secret
# named DAILY_SNAPSHOT_SECRET (see .github/workflows/daily-snapshot.yml).
openssl rand -hex 32
# Then:
supabase secrets set DAILY_SNAPSHOT_SECRET=<that-value>

# Deploy the function
supabase functions deploy daily-snapshot
```

Function URL becomes `https://jdvlzkictwinkgcvgwew.supabase.co/functions/v1/daily-snapshot`.

## Manual trigger (testing)

```bash
curl -X POST \
  -H "Authorization: Bearer <DAILY_SNAPSHOT_SECRET>" \
  https://jdvlzkictwinkgcvgwew.supabase.co/functions/v1/daily-snapshot
```

Expected response (JSON):

```json
{
  "asOf": "2026-05-18T23:00:00.000Z",
  "portfoliosProcessed": 1,
  "summary": [
    {
      "portfolio_id": "9ac70cda…",
      "status": "written",
      "perAssetCount": 3,
      "totalValue": "84719.20"
    }
  ]
}
```

## Local dev

```bash
supabase functions serve daily-snapshot --env-file ./supabase/functions/.env

# In another shell:
curl -X POST -H "Authorization: Bearer test-secret" \
  http://localhost:54321/functions/v1/daily-snapshot
```

`./supabase/functions/.env` is gitignored (covered by repo `.gitignore` `.env.*.local` pattern won't catch it; ensure it's `supabase/functions/.env` listed in `.gitignore`).

## Notes for reviewers / future-self

- **Why no `@arc/core` import**: Deno bundles each Edge Function in isolation at deploy time. The `computeHoldings` + `computeSnapshot` logic is duplicated here from the @arc/core spirit. If divergence becomes a real risk (Stage 3+), we can publish `@arc/core` as a separate package and `import` from JSR. For Stage 2 the duplication is tiny + audited via spec.
- **Stage 2 supports BUY only** (mirrors mobile `validate-us-symbol` constraint). Stage 3 will add SELL / DIVIDEND / SPLIT.
- **Skip semantics**: portfolios with no priceable holdings (cache empty) produce `status: "skipped-empty"` instead of an empty row. Keeps the table tidy.
