/**
 * computeDailyDelta — pure function comparing today's valuation against
 * yesterday's stored snapshot.
 *
 * Stage 2 J7 (Daily Snapshot). No I/O, no React, no Decimal-imported-from-
 * anywhere-but-decimal.js. Fully testable in isolation.
 *
 * See .specify/feature-specs/stage-2/daily-snapshot-stage-2.md §"Data model" and
 * §"Acceptance criteria" for the contract these tests pin.
 *
 * Mover sort: by absolute deltaPercent descending (per user-journeys.md
 * open question resolved 2026-05-17 — percentage emphasizes "news" over
 * "big position", which is the right Stage 2 default).
 */

import Decimal from "decimal.js";

import type {
  AssetDelta,
  DailyDelta,
  PortfolioDailySnapshot,
  PortfolioValuation,
  SnapshotAsset,
} from "../domain/types";

const ZERO = new Decimal(0);

/**
 * Compute the day-over-day delta from current valuation + baseline snapshot.
 *
 * Edge cases handled:
 *   - baseline is null                          → status: "no-baseline"
 *   - current has zero perAsset entries        → status: "empty-portfolio"
 *   - baseline.totalValue is 0 (degenerate)    → totalDeltaPercent = 0
 *   - an asset appears in current but not baseline (new buy)
 *                                              → deltaPercent = 0 (avoid Inf)
 *   - an asset appears in baseline but not current (sold off / deleted)
 *                                              → NOT included in movers or totals
 *                                                 (realized P&L / portfolio edits are separate)
 *   - an asset appears in current but not baseline (new buy today)
 *                                              → deltaReporting = 0 (not full market value);
 *                                                 listed in movers; excluded from headline total
 *
 * Headline total = Σ (current − baseline) for **currently held** assets that existed in
 * the baseline snapshot with value > 0 — NOT `current.totalValue − baseline.totalValue`.
 *
 * Currency: deltas are computed in each asset's NATIVE currency (the only
 * currency-stable basis) and converted into today's reporting currency with the
 * FX rate today's valuation used. The baseline's stored `valueReporting` is
 * frozen in whatever reporting currency the snapshot was written with and is
 * intentionally NOT compared against today's `valueReporting` (which follows the
 * user's current reporting currency) — doing so was a cross-currency subtraction
 * bug. See data-model-invariants §4.
 */
export const computeDailyDelta = (
  current: PortfolioValuation,
  baseline: PortfolioDailySnapshot | null
): DailyDelta => {
  // 1) Empty portfolio (no current holdings) → hide card entirely
  if (current.perAsset.length === 0) {
    return {
      status: "empty-portfolio",
      totalDeltaReporting: ZERO,
      totalDeltaPercent: ZERO,
      movers: [],
      baselineAsOf: null,
      currentReportingCurrency: current.reportingCurrency,
    };
  }

  // 2) No baseline (first day) → placeholder card
  if (baseline === null) {
    return {
      status: "no-baseline",
      totalDeltaReporting: ZERO,
      totalDeltaPercent: ZERO,
      movers: [],
      baselineAsOf: null,
      currentReportingCurrency: current.reportingCurrency,
    };
  }

  // Index baseline per-asset by assetId for O(1) lookup
  const baselineByAsset = new Map<string, SnapshotAsset>();
  for (const a of baseline.perAsset) {
    baselineByAsset.set(a.assetId, a);
  }

  const movers: AssetDelta[] = [];
  let totalDeltaReporting = ZERO;
  let heldBaselineReporting = ZERO;

  for (const asset of current.perAsset) {
    const baselineAsset = baselineByAsset.get(asset.assetId);

    // Compare in the asset's NATIVE currency, never the frozen reporting value.
    // The baseline snapshot's `valueReporting` is pinned to whatever reporting
    // currency the portfolio used when the Edge Function wrote it (e.g. CNY),
    // while today's `valueReporting` follows the user's current (possibly
    // switched, e.g. USD) reporting currency. Subtracting them directly is a
    // cross-currency bug (data-model-invariants §4: history uses its own rate;
    // never compare pre-converted values across currencies). `valueNative` is
    // currency-stable, so the overnight move is well-defined there; we then
    // convert it into today's reporting currency with the same FX rate today's
    // valuation used. This also makes `deltaPercent` invariant to currency
    // switches (it's a pure native ratio).
    const sameCurrency = baselineAsset != null && baselineAsset.currency === asset.nativeCurrency;
    const baselineNative = sameCurrency ? baselineAsset!.valueNative : ZERO;

    // baseline 0 / absent / currency-mismatch (new buy or unreconcilable) →
    // reporting + percent both 0 (avoid Inf / misleading cross-currency ¥).
    const deltaNative = baselineNative.isZero() ? ZERO : asset.valueNative.minus(baselineNative);
    const deltaReporting = deltaNative.times(asset.fxRateUsed);
    const deltaPercent = baselineNative.isZero()
      ? ZERO
      : deltaNative.dividedBy(baselineNative).times(100);

    movers.push({
      assetId: asset.assetId,
      deltaReporting,
      deltaPercent,
      currentValueReporting: asset.valueReporting,
    });

    // Headline total: overnight-held assets only (exclude new buys + sold-off).
    // Denominator is the baseline native value converted at *today's* FX, so the
    // headline % stays currency-consistent with the numerator.
    if (!baselineNative.isZero()) {
      totalDeltaReporting = totalDeltaReporting.plus(deltaReporting);
      heldBaselineReporting = heldBaselineReporting.plus(baselineNative.times(asset.fxRateUsed));
    }
  }

  const totalDeltaPercent = heldBaselineReporting.isZero()
    ? ZERO
    : totalDeltaReporting.dividedBy(heldBaselineReporting).times(100);

  // Sort movers by abs(deltaPercent) descending. Stable sort:
  // ties broken by assetId so test/render output is deterministic.
  movers.sort((a, b) => {
    const aMag = a.deltaPercent.abs();
    const bMag = b.deltaPercent.abs();
    if (aMag.gt(bMag)) return -1;
    if (aMag.lt(bMag)) return 1;
    return a.assetId.localeCompare(b.assetId);
  });

  return {
    status: "ok",
    totalDeltaReporting,
    totalDeltaPercent,
    movers,
    baselineAsOf: baseline.asOf,
    currentReportingCurrency: current.reportingCurrency,
  };
};
