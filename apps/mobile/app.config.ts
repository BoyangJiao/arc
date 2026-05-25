/**
 * Expo dynamic config — extends the static `app.json` so we can surface
 * non-`EXPO_PUBLIC_` env vars (e.g. DEV_REAL_EMAIL / DEV_CLEAN_EMAIL) to the
 * runtime via `Constants.expoConfig.extra.*`.
 *
 * Static fields (name, slug, ios, plugins, …) stay in `app.json`. Anything
 * that needs `process.env` belongs here. See
 * `.specify/feature-specs/cross-stage/real-env-dev-tools.md` §决策 1.
 */

import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  extra: {
    ...config.extra,
    // Real / Clean DEV env emails (DEV only — not used in production builds).
    // Read from .env (gitignored); ok to ship into the JS bundle since these
    // are just inbox aliases of a single Gmail account.
    devRealEmail: process.env.DEV_REAL_EMAIL,
    devCleanEmail: process.env.DEV_CLEAN_EMAIL,
  },
});
