/**
 * env-mode.spec.ts — verifies the Real / Clean / unknown classifier
 *
 * Covers cross-stage spec §S3-AC-RE.1 + §S3-AC-RE.4 (Real-env guard
 * depends on `detectEnvMode` returning "real" for the configured email).
 *
 * `expo-constants` is RN-runtime-only, so it's mocked at module load.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

const REAL_EMAIL = "cyberjby+arc-real@gmail.com";
const CLEAN_EMAIL = "cyberjby+arc-clean@gmail.com";

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      extra: {
        devRealEmail: REAL_EMAIL,
        devCleanEmail: CLEAN_EMAIL,
      },
    },
  },
}));

// Dynamic import is required so the mock is in place before module init.
let detectEnvMode: (email: string | null | undefined) => "real" | "clean" | "unknown";

beforeAll(async () => {
  ({ detectEnvMode } = await import("../env-mode"));
});

describe("detectEnvMode", () => {
  it("returns 'unknown' when signed out (no email)", () => {
    expect(detectEnvMode(undefined)).toBe("unknown");
    expect(detectEnvMode(null)).toBe("unknown");
    expect(detectEnvMode("")).toBe("unknown");
  });

  it("returns 'real' for the configured Real email (case-insensitive)", () => {
    expect(detectEnvMode(REAL_EMAIL)).toBe("real");
    expect(detectEnvMode(REAL_EMAIL.toUpperCase())).toBe("real");
    expect(detectEnvMode(`  ${REAL_EMAIL}  `)).toBe("real");
  });

  it("returns 'clean' for the configured Clean email (case-insensitive)", () => {
    expect(detectEnvMode(CLEAN_EMAIL)).toBe("clean");
    expect(detectEnvMode(CLEAN_EMAIL.toUpperCase())).toBe("clean");
  });

  it("returns 'unknown' for an email that matches neither alias", () => {
    expect(detectEnvMode("random@example.com")).toBe("unknown");
    expect(detectEnvMode("cyberjby@gmail.com")).toBe("unknown"); // base email, no alias
    expect(detectEnvMode("cyberjby+other@gmail.com")).toBe("unknown");
  });
});
