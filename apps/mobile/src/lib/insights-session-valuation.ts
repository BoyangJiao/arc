/**
 * Insights / rebalance — at most one live (AV) valuation fetch per app session.
 *
 * Pull-to-refresh and revisiting the tab reuse priceCache / fxCache only.
 * Resets on sign-out so the next login may fetch live quotes once again.
 */

const sessionLiveFetched = new Set<string>();

export const insightsSessionValuationKey = (
  portfolioId: string,
  reportingCurrency: string
): string => `${portfolioId}:${reportingCurrency}`;

/** Returns true the first time this key is seen this session (caller should run live fetch). */
export const claimInsightsSessionLiveFetch = (key: string): boolean => {
  if (sessionLiveFetched.has(key)) return false;
  sessionLiveFetched.add(key);
  return true;
};

export const resetInsightsSessionValuation = (): void => {
  sessionLiveFetched.clear();
};
