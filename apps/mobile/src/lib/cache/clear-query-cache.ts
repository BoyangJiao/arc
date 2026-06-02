/**
 * clearQueryCache — clears both the in-memory TanStack Query cache and the
 * MMKV on-disk persist cache.
 *
 * Spec: offline-cache-stage-3.md §决策 9 (AC.OF.9)
 *
 * Called on:
 *   - Sign-out  → prevents a new user (or re-login) from seeing another
 *     user's cached holdings on cold start.
 *   - resetCleanEnv → DEV env reset must wipe disk cache so the clean user
 *     starts fresh, not with stale cached data.
 *
 * Order: in-memory first, then disk. If the MMKV instance is not yet
 * initialised (never been used), getEncryptedMmkv() will return null quickly
 * and we skip the disk clear — this is safe because there's nothing to clear.
 */

import { queryClient } from "../query-client";
import { getEncryptedMmkv } from "./mmkv-encrypted";

export const clearQueryCache = async (): Promise<void> => {
  // 1. Clear in-memory Query cache (same as queryClient.clear() in resetCleanEnv).
  queryClient.clear();

  // 2. Clear on-disk MMKV persist cache.
  try {
    const mmkv = await getEncryptedMmkv();
    mmkv?.clearAll();
  } catch {
    // Non-fatal: if MMKV is unavailable, in-memory clear above is sufficient.
  }
};
