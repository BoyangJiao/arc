/**
 * scenarios.spec.ts — verifies §S3-AC-RE.4 envMode → visible feature filter.
 *
 * Today every feature is `requiredEnv: "clean"`. Real / unknown env therefore
 * must surface an empty list, which is what hides the FAB scenario picker.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: { extra: { devRealEmail: "r@x.com", devCleanEmail: "c@x.com" } },
  },
}));

import { DEV_SEED_FEATURES, visibleFeaturesForEnv } from "../scenarios";

describe("visibleFeaturesForEnv", () => {
  it("returns all features when envMode='clean'", () => {
    const visible = visibleFeaturesForEnv("clean");
    expect(visible).toHaveLength(DEV_SEED_FEATURES.length);
  });

  it("returns only requiredEnv='any' features in Real env (currently none)", () => {
    const visible = visibleFeaturesForEnv("real");
    expect(visible).toHaveLength(0);
  });

  it("returns only requiredEnv='any' features in unknown env (currently none)", () => {
    const visible = visibleFeaturesForEnv("unknown");
    expect(visible).toHaveLength(0);
  });

  it("every current feature is gated to Clean (locks §S3-AC-RE.4 invariant)", () => {
    for (const feature of DEV_SEED_FEATURES) {
      expect(feature.requiredEnv).toBe("clean");
    }
  });
});
