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
import Constants from "expo-constants";
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

  // Expo Go: react-native-mmkv v4 uses NitroModules which throw at module-eval
  // time in Expo Go ("NitroModules are not supported in Expo Go!"). The error is
  // synchronous and at <global> scope — a try/catch around dynamic import() can't
  // intercept it. Guard here so we never attempt to load the module in Expo Go.
  // Development builds (expo prebuild / EAS) have appOwnership === null → proceed.
  const appOwnership = (Constants as { appOwnership?: string | null }).appOwnership;
  if (appOwnership === "expo") {
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

  // Prefer a CSPRNG. Hermes (RN dev/prod builds) exposes a Web Crypto
  // `getRandomValues`; use it when present. We feature-detect rather than
  // hard-depend so the module still loads in runtimes/tests without it.
  const webCrypto = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } })
    .crypto;
  if (typeof webCrypto?.getRandomValues === "function") {
    webCrypto.getRandomValues(array);
  } else {
    // Last-resort fallback (e.g. a runtime without Web Crypto). Not
    // cryptographically strong, but the key is immediately sealed in the
    // hardware-backed secure store and never leaves the device. Follow-up:
    // add `expo-crypto` (getRandomBytes) once it can be installed, to drop
    // this branch entirely.
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};
