/**
 * avatar-gradients.ts — Raw gradient palette for AssetAvatar monogram fallback (ADR 004).
 *
 * These are decorative, deterministic gradient pairs picked by hashing the asset
 * seed — they are NOT semantic Foundation colors and have no light/dark variant
 * (the avatar monogram sits on its own gradient regardless of theme). React Native
 * LinearGradient requires literal color strings, so raw hex lives here.
 *
 * NOTE: This file is under packages/ui/src/tokens/** which is exempt from the
 * no-hardcoded-color lint rule (see eslint.config.mjs §决策七 ignores).
 */

/** Decorative gradient pairs for asset avatars; index chosen by seed hash. */
export const AVATAR_GRADIENT_PAIRS: readonly (readonly [string, string])[] = [
  ["#6366f1", "#8b5cf6"],
  ["#0ea5e9", "#06b6d4"],
  ["#10b981", "#059669"],
  ["#f59e0b", "#d97706"],
  ["#ec4899", "#db2777"],
  ["#64748b", "#475569"],
];
