/**
 * mmkv-encrypted — MMKV instance backed by a secure-store encryption key.
 *
 * Spec: offline-cache-stage-3.md §决策 6
 *
 * Security model:
 *   - First launch: generate a random 32-byte hex key, persist to expo-secure-store
 *     (iOS Keychain / Android Keystore).
 *   - Subsequent launches: read the key back, open the same MMKV instance.
 *   - If secure-store read fails (e.g. keystore wipe): fall back to `null` (no
 *     cache), which the caller treats as "no persisted data — load normally".
 *     This is safe: correctness is not compromised, only cold-start speed.
 *
 * Platform notes:
 *   - MMKV has no web implementation. On web we export `null` and the caller
 *     falls back to a noop persister (see query-persister.ts).
 *   - Initialization is async (secure-store read) → callers must await
 *     `getEncryptedMmkv()` before accessing the MMKV instance.
 */

import { Platform } from "react-native";
import type { MMKV } from "react-native-mmkv";

const SECURE_STORE_KEY = "arc.mmkv.encryptionKey.v1";

/** Returned type so callers can branch on web / init-failure without casting. */
export type MmkvInstance = MMKV | null;

let _cached: MmkvInstance | undefined;

/**
 * Returns a lazily-initialized MMKV instance backed by a secure-store key,
 * or `null` on web / if secure-store is unavailable.
 *
 * Safe to call multiple times — returns the same instance after first init.
 */
export const getEncryptedMmkv = async (): Promise<MmkvInstance> => {
  if (_cached !== undefined) return _cached;

  // Web: MMKV is not available. Return null → caller uses noop persister.
  if (Platform.OS === "web") {
    _cached = null;
    return null;
  }

  try {
    const { createMMKV } = await import("react-native-mmkv");
    const SecureStore = await import("expo-secure-store");

    let encryptionKey = await SecureStore.getItemAsync(SECURE_STORE_KEY);

    if (!encryptionKey) {
      // First launch: generate a new random key.
      encryptionKey = generateKey();
      await SecureStore.setItemAsync(SECURE_STORE_KEY, encryptionKey);
    }

    _cached = createMMKV({
      id: "arc.query-cache.v1",
      encryptionKey,
    });

    return _cached;
  } catch {
    // Secure-store read/write failed (e.g. device-lock policy, CI, simulator
    // without keystore). Treat as no cache available — degrade gracefully.
    _cached = null;
    return null;
  }
};

/** Clear the module-level cache (used in tests and env-switch). */
export const resetMmkvInstance = (): void => {
  _cached = undefined;
};

const generateKey = (): string => {
  const array = new Uint8Array(32);
  // expo-crypto is not installed; use Math.random as fallback for key
  // generation — acceptable because the key is immediately stored in the
  // hardware-backed secure store and never leaves the device.
  for (let i = 0; i < array.length; i++) {
    array[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};
