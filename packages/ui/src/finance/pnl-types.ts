/**
 * pnl-types — shared sign vocabulary for the Insights 盈亏分析 cards.
 *
 * Cards are presentational: the mobile layer formats strings + resolves the
 * `PnlSign` (gain/loss/neutral) from Decimal values, keeping @arc/ui free of
 * finance math. Color resolution honors the finance color mode (ADR 003).
 */

import type { BusinessClassMap } from "../tokens/business-classes";

export type PnlSign = "gain" | "loss" | "neutral";

/** Resolve the gain/loss/neutral text color class for a sign. */
export const pnlTextClass = (sign: PnlSign, classes: BusinessClassMap): string =>
  sign === "gain"
    ? classes.gain.text
    : sign === "loss"
      ? classes.loss.text
      : classes.pnlNeutral.text;
