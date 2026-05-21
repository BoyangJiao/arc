/**
 * resolveActivePortfolio — fallback paths (Stage 3 Block B commit #3).
 */

import { describe, expect, it } from "vitest";

import { resolveActivePortfolio } from "../src/portfolio/resolve-active-portfolio";
import type { Portfolio } from "../src/domain/types";

const mkPortfolio = (
  overrides: Partial<Portfolio> & Pick<Portfolio, "id" | "name">
): Portfolio => ({
  userId: "user-1",
  reportingCurrency: "CNY",
  createdAt: "2026-01-01T00:00:00Z",
  archivedAt: null,
  ...overrides,
});

describe("resolveActivePortfolio", () => {
  const p1 = mkPortfolio({ id: "p1", name: "My Portfolio" });
  const p2 = mkPortfolio({ id: "p2", name: "401k", reportingCurrency: "USD" });
  const pArchived = mkPortfolio({
    id: "p-archived",
    name: "Old",
    archivedAt: "2026-05-01T00:00:00Z",
  });

  it("stored id hits unarchived portfolio → use it, no store sync", () => {
    const result = resolveActivePortfolio("p2", [p1, p2]);
    expect(result.portfolio?.id).toBe("p2");
    expect(result.effectiveId).toBe("p2");
    expect(result.shouldSyncStore).toBe(false);
  });

  it("stored id points to archived portfolio → fallback first unarchived + sync store", () => {
    const result = resolveActivePortfolio("p-archived", [pArchived, p1, p2]);
    expect(result.portfolio?.id).toBe("p1");
    expect(result.effectiveId).toBe("p1");
    expect(result.shouldSyncStore).toBe(true);
  });

  it("stored id missing (deleted) → fallback first unarchived + sync store", () => {
    const result = resolveActivePortfolio("deleted-id", [p1, p2]);
    expect(result.portfolio?.id).toBe("p1");
    expect(result.effectiveId).toBe("p1");
    expect(result.shouldSyncStore).toBe(true);
  });

  it("portfolios empty (loading) → keep stored id, no store sync", () => {
    expect(resolveActivePortfolio("p1", [])).toEqual({
      portfolio: null,
      effectiveId: "p1",
      shouldSyncStore: false,
    });
    expect(resolveActivePortfolio(null, [])).toEqual({
      portfolio: null,
      effectiveId: null,
      shouldSyncStore: false,
    });
  });

  it("stored null with portfolios → first unarchived + sync store", () => {
    const result = resolveActivePortfolio(null, [p1, p2]);
    expect(result.portfolio?.id).toBe("p1");
    expect(result.effectiveId).toBe("p1");
    expect(result.shouldSyncStore).toBe(true);
  });

  it("all portfolios archived → null + clear store", () => {
    const result = resolveActivePortfolio("p-archived", [pArchived]);
    expect(result.portfolio).toBeNull();
    expect(result.effectiveId).toBeNull();
    expect(result.shouldSyncStore).toBe(true);
  });
});
