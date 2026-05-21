/**
 * resolveActivePortfolio — 将持久化的 activePortfolioId 解析为当前活跃组合。
 *
 * 仅考虑 archivedAt === null 的组合；归档/缺失 ID 回退到列表第一项。
 */

import type { Portfolio } from "../domain/types";

export interface ResolveActivePortfolioResult {
  readonly portfolio: Portfolio | null;
  readonly effectiveId: string | null;
  /** true 时调用方应 setActivePortfolioId(effectiveId) 以修正持久化中的 stale id */
  readonly shouldSyncStore: boolean;
}

const unarchived = (portfolios: ReadonlyArray<Portfolio>): ReadonlyArray<Portfolio> =>
  portfolios.filter((p) => p.archivedAt === null);

/**
 * @param storedId — Zustand persist（AsyncStorage）中的 activePortfolioId（可为 null）
 * @param portfolios — usePortfolios 返回的列表（created_at 升序）
 */
export const resolveActivePortfolio = (
  storedId: string | null,
  portfolios: ReadonlyArray<Portfolio>
): ResolveActivePortfolioResult => {
  const active = unarchived(portfolios);

  if (portfolios.length > 0 && active.length === 0) {
    return {
      portfolio: null,
      effectiveId: null,
      shouldSyncStore: storedId !== null,
    };
  }

  if (active.length === 0) {
    // Query still loading — keep persisted id; do not overwrite AsyncStorage.
    return {
      portfolio: null,
      effectiveId: storedId,
      shouldSyncStore: false,
    };
  }

  if (storedId !== null) {
    const hit = active.find((p) => p.id === storedId);
    if (hit) {
      return {
        portfolio: hit,
        effectiveId: hit.id,
        shouldSyncStore: false,
      };
    }
  }

  const fallback = active[0];
  return {
    portfolio: fallback,
    effectiveId: fallback.id,
    shouldSyncStore: storedId !== fallback.id,
  };
};
