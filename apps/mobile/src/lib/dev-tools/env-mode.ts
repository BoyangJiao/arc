/**
 * Dev env detection — Real vs Clean vs unknown.
 *
 * Cross-stage spec: `.specify/feature-specs/cross-stage/real-env-dev-tools.md`
 *
 * The two DEV envs are separated by Gmail `+alias` auth users:
 *   - Real Env   = signed in as `<gmail>+arc-real@…`  → persistent dogfooding
 *                  data (real positions, never wiped by DEV buttons).
 *   - Clean Env  = signed in as `<gmail>+arc-clean@…` → resettable testbed
 *                  for scenarios + onboarding flows.
 *
 * Emails are surfaced via `app.config.ts` → `Constants.expoConfig.extra.*`
 * so they are NOT bundled as raw `process.env` reads on the device.
 *
 * Decisions locked 2026-05-25 (spec §决策 1).
 */

import Constants from "expo-constants";

export type DevEnvMode = "real" | "clean" | "unknown";

const EXTRA = Constants.expoConfig?.extra as
  | {
      devRealEmail?: string;
      devCleanEmail?: string;
    }
  | undefined;

export const REAL_EMAIL_FROM_CONFIG: string | undefined = EXTRA?.devRealEmail;
export const CLEAN_EMAIL_FROM_CONFIG: string | undefined = EXTRA?.devCleanEmail;

const norm = (s: string | undefined | null): string | undefined =>
  s ? s.trim().toLowerCase() : undefined;

/**
 * Detect the active DEV env from a signed-in user's email.
 *
 * Returns "unknown" when:
 *   - signed out (email is undefined),
 *   - the email does not match either configured alias,
 *   - or the env vars are missing (developer skipped the spec § J-RE.1 setup).
 *
 * Callers that need to gate destructive actions (e.g. resetCleanEnv) MUST
 * treat anything other than "clean" as a hard refusal — see spec §决策 3 +
 * §S3-AC-RE.3 (Reset wipes Clean only) / §S3-AC-RE.4 (Real env scenario guard).
 */
export const detectEnvMode = (email: string | null | undefined): DevEnvMode => {
  const e = norm(email);
  if (!e) return "unknown";
  const real = norm(REAL_EMAIL_FROM_CONFIG);
  const clean = norm(CLEAN_EMAIL_FROM_CONFIG);
  if (real && e === real) return "real";
  if (clean && e === clean) return "clean";
  return "unknown";
};
