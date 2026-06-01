/**
 * L2 — Import format profiles.
 *
 * Each ImportProfile describes how a specific CSV source (Arc-native, Alipay, IBKR, …)
 * maps its column names to canonical fields.
 *
 * Adding a new platform: create one profile object + its unit tests.
 * L1 (raw parse) and L3 (validator/writer) require zero changes.
 *
 * Spec: .specify/feature-specs/stage-3/csv-import-stage-3.md §决策 1
 */

import type { CanonicalField } from "./csv-to-transactions";

// ─── Types ────────────────────────────────────────────────────────────────

export interface ImportProfile {
  /** Stable identifier used in logging and future UI selectors. */
  readonly id: string;
  /** i18n key for the human-readable label (UI selector). */
  readonly labelKey: string;
  /**
   * Return true if the given CSV header row indicates this profile.
   * Used for auto-detection. Should be cheap and reliable.
   */
  matches: (header: readonly string[]) => boolean;
  /**
   * Maps canonical field → one or more candidate column names in this source format.
   * First match found in the actual CSV header wins.
   * Notes is optional (column may be absent).
   */
  readonly columnMap: Readonly<Record<CanonicalField, string | readonly string[]>>;
  /**
   * Optional per-field normalizer: raw string → normalized string.
   * Applied before L3 validation. Use for date reformatting, stripping symbols, etc.
   */
  readonly normalize?: Partial<Record<CanonicalField, (raw: string) => string>>;
}

// ─── Arc-native profile ───────────────────────────────────────────────────

/**
 * Arc's own export format (csv-export-stage-3.md §决策 2).
 * Column names are already canonical — normalizer is empty.
 *
 * Header: portfolio_id,portfolio_name,asset_id,type,shares,
 *         price_per_share,currency,fee,trade_date,notes
 */
export const arcNativeProfile: ImportProfile = {
  id: "arc-native",
  labelKey: "import.profileArcNative",
  matches: (header) => {
    // Must contain the 7 required canonical columns
    const required = [
      "asset_id",
      "type",
      "shares",
      "price_per_share",
      "currency",
      "fee",
      "trade_date",
    ] as const;
    return required.every((col) => header.includes(col));
  },
  columnMap: {
    asset_id: "asset_id",
    type: "type",
    shares: "shares",
    price_per_share: "price_per_share",
    currency: "currency",
    fee: "fee",
    trade_date: "trade_date",
    notes: "notes",
  },
};

// ─── Registry ────────────────────────────────────────────────────────────

/**
 * Ordered list of all known import profiles.
 * Auto-detection tries each in order and returns the first match.
 * Future profiles: append here + add unit tests.
 */
export const IMPORT_PROFILES: readonly ImportProfile[] = [arcNativeProfile];

/**
 * Auto-detect the best matching profile for a CSV header.
 *
 * @returns The first matching profile, or undefined if none match.
 *          When undefined, the UI should present a manual profile selector.
 */
export const detectProfile = (header: readonly string[]): ImportProfile | undefined => {
  return IMPORT_PROFILES.find((p) => p.matches(header));
};
