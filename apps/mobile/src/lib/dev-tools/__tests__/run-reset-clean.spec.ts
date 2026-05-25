/**
 * run-reset-clean.spec.ts — locks down cross-stage §S3-AC-RE.3 invariants:
 *
 *   1. Signed in as Real (or any non-Clean email)  → MUST throw without any
 *      mutation calls (RESET refuses to fire — the only protection against
 *      misclicks wiping the Real Env dataset).
 *   2. Signed in as Clean                          → wipes 6 tables in FK-safe
 *      order, strips matching AsyncStorage keys, and calls queryClient.clear().
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const REAL_EMAIL = "cyberjby+arc-real@gmail.com";
const CLEAN_EMAIL = "cyberjby+arc-clean@gmail.com";

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: { extra: { devRealEmail: REAL_EMAIL, devCleanEmail: CLEAN_EMAIL } },
  },
}));

// ── Supabase client mock ────────────────────────────────────────────────────

interface MockUser {
  id: string;
  email: string | null;
}
const userRef: { current: MockUser | null; error: Error | null } = {
  current: null,
  error: null,
};

const deleteCalls: Array<{ table: string; column: string; value: string }> = [];

const mockSupabase = {
  auth: {
    getUser: vi.fn(async () => ({
      data: { user: userRef.current },
      error: userRef.error,
    })),
  },
  from: vi.fn((table: string) => ({
    delete: () => ({
      eq: (column: string, value: string) => {
        deleteCalls.push({ table, column, value });
        return Promise.resolve({ error: null });
      },
    }),
  })),
};

vi.mock("../../supabase", () => ({ supabase: mockSupabase }));

// ── AsyncStorage mock ───────────────────────────────────────────────────────

const storedKeys: string[] = [];
const removedKeys: string[] = [];

const mockAsyncStorage = {
  getAllKeys: vi.fn(async () => storedKeys.slice()),
  multiRemove: vi.fn(async (keys: ReadonlyArray<string>) => {
    removedKeys.push(...keys);
  }),
};

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: mockAsyncStorage,
}));

// ── Module under test (dynamic import after mocks) ──────────────────────────

import type { QueryClient } from "@tanstack/react-query";

const importResetCleanEnv = async () => (await import("../run-reset-clean")).resetCleanEnv;

const fakeQueryClient = (): QueryClient => {
  const cleared = { value: false };
  return {
    clear: vi.fn(() => {
      cleared.value = true;
    }),
    __cleared: cleared,
  } as unknown as QueryClient;
};

const EXPECTED_TABLES_IN_ORDER = [
  "transactions",
  "target_allocations",
  "portfolio_value_snapshots",
  "watchlist_items",
  "portfolios",
  "user_preferences",
] as const;

beforeEach(() => {
  userRef.current = null;
  userRef.error = null;
  deleteCalls.length = 0;
  storedKeys.length = 0;
  removedKeys.length = 0;
  mockAsyncStorage.getAllKeys.mockClear();
  mockAsyncStorage.multiRemove.mockClear();
  mockSupabase.from.mockClear();
});

describe("resetCleanEnv", () => {
  it("refuses to run when signed in as Real and makes no mutations", async () => {
    userRef.current = { id: "user-real", email: REAL_EMAIL };
    storedKeys.push("arc.activePortfolioId", "arc.lastUsedMarket.p1");
    const qc = fakeQueryClient();
    const resetCleanEnv = await importResetCleanEnv();

    await expect(resetCleanEnv(qc)).rejects.toThrow(/Refusing to reset/);
    expect(deleteCalls).toEqual([]);
    expect(removedKeys).toEqual([]);
    expect(
      (qc as unknown as { clear: { mock: { calls: unknown[] } } }).clear.mock.calls
    ).toHaveLength(0);
  });

  it("refuses to run when signed in as an email that matches neither alias", async () => {
    userRef.current = { id: "user-other", email: "random@example.com" };
    const qc = fakeQueryClient();
    const resetCleanEnv = await importResetCleanEnv();
    await expect(resetCleanEnv(qc)).rejects.toThrow(/mode=unknown/);
    expect(deleteCalls).toEqual([]);
  });

  it("refuses to run when no user is signed in", async () => {
    userRef.current = null;
    const qc = fakeQueryClient();
    const resetCleanEnv = await importResetCleanEnv();
    await expect(resetCleanEnv(qc)).rejects.toThrow(/Not signed in/);
  });

  it("happy path: wipes all expected tables, AsyncStorage keys, and clears QueryClient", async () => {
    userRef.current = { id: "user-clean", email: CLEAN_EMAIL };
    storedKeys.push(
      "arc.activePortfolioId",
      "arc.lastUsedMarket.p1",
      "arc.lastUsedMarket.p2",
      "arc:dev-tools-fab:v1", // must NOT be removed — UI prefs, not user data
      "sb-jdvlzkictwinkgcvgwew-auth-token" // must NOT be removed — Supabase session
    );
    const qc = fakeQueryClient();
    const resetCleanEnv = await importResetCleanEnv();

    const summary = await resetCleanEnv(qc);

    // 1. Tables deleted in FK-safe order, every row scoped to user_id.
    const tablesTouched = deleteCalls.map((c) => c.table);
    expect(tablesTouched).toEqual([...EXPECTED_TABLES_IN_ORDER]);
    expect(deleteCalls.every((c) => c.column === "user_id")).toBe(true);
    expect(deleteCalls.every((c) => c.value === "user-clean")).toBe(true);

    // 2. AsyncStorage — only Clean user's data keys removed; FAB position
    //    and Supabase session keys MUST remain untouched.
    expect(removedKeys.sort()).toEqual(
      ["arc.activePortfolioId", "arc.lastUsedMarket.p1", "arc.lastUsedMarket.p2"].sort()
    );
    expect(removedKeys).not.toContain("arc:dev-tools-fab:v1");
    expect(removedKeys).not.toContain("sb-jdvlzkictwinkgcvgwew-auth-token");

    // 3. QueryClient cleared.
    expect((qc as unknown as { __cleared: { value: boolean } }).__cleared.value).toBe(true);

    // 4. Summary surface matches docs.
    expect(summary.deletedFromTables).toEqual([...EXPECTED_TABLES_IN_ORDER]);
    expect(summary.clearedAsyncStorageKeys.length).toBe(3);
  });
});
