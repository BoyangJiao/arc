# AKShare wrapper (Vercel Python)

HTTP facade for Arc `@arc/data-sources` AKShare adapters (ADR 011).

## Deploy (user)

```bash
cd services/akshare-wrapper
vercel link
vercel env add AKSHARE_WRAPPER_TOKEN
vercel deploy
```

Set in `apps/mobile/.env`:

- `EXPO_PUBLIC_AKSHARE_WRAPPER_URL=https://<your-project>.vercel.app`
- `EXPO_PUBLIC_AKSHARE_WRAPPER_TOKEN=<same secret>`

## Endpoints

- `GET /api/quote?market=CN|HK|FUND&symbol=...` — `X-Arc-Token` header required when `AKSHARE_WRAPPER_TOKEN` is set
- `GET /api/historical?market=...&symbol=...&from=ISO&to=ISO` — Stage 3 returns latest row array (extend later)
