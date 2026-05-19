/**
 * Default portfolio naming — stored in DB as a canonical marker; UI resolves via i18n.
 *
 * Signup / seed always persist `DEFAULT_PORTFOLIO_CANONICAL_NAME` ("My Portfolio").
 * Display layers map known default stored values → `portfolio.myPortfolio` translation.
 * User-renamed portfolios use any other string and are shown as-is across locale switches.
 */

/** Canonical value written by auth trigger, seed scripts, and useEnsureDefaultPortfolio. */
export const DEFAULT_PORTFOLIO_CANONICAL_NAME = "My Portfolio";

/**
 * All stored `portfolios.name` values treated as "not user-customized".
 * Include canonical EN plus legacy/alternate locale literals for safety.
 */
const DEFAULT_PORTFOLIO_STORED_NAMES: ReadonlySet<string> = new Set([
  DEFAULT_PORTFOLIO_CANONICAL_NAME,
  "我的组合",
]);

export function isDefaultPortfolioStoredName(name: string): boolean {
  return DEFAULT_PORTFOLIO_STORED_NAMES.has(name.trim());
}

/** Resolve display label: localized default or user custom name. */
export function resolvePortfolioDisplayName(
  storedName: string,
  localizedDefaultName: string
): string {
  return isDefaultPortfolioStoredName(storedName) ? localizedDefaultName : storedName;
}
