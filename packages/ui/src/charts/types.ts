/** EOD time-range options — Block C spec decision #2 (no 1H). */
export type TimeRange = "1D" | "1W" | "1M" | "3M" | "YTD" | "1Y" | "ALL";

export const TIME_RANGE_OPTIONS: readonly TimeRange[] = [
  "1D",
  "1W",
  "1M",
  "3M",
  "YTD",
  "1Y",
  "ALL",
] as const;

/**
 * Default time range for Portfolio Hero + Asset Detail.
 *
 * 3M balances:
 *   - Long enough to show meaningful market movement past intraday noise
 *   - Aligns with quarterly rebalance cadence (Arc's core differentiation)
 *   - Short enough to keep chart density high (true historical bootstrap)
 *
 * Smart default in `pickDefaultRangeForFirstTrade` narrows this for new
 * portfolios (< 90d of history) so the chart isn't a long flat lead-in.
 */
export const DEFAULT_TIME_RANGE: TimeRange = "3M";

export interface ChartPoint {
  readonly x: number;
  readonly y: number;
  /** Optional axis / tooltip label (e.g. trade date YYYY-MM-DD). */
  readonly label?: string;
  /** ISO timestamp for scrub subtitle (EOD snapshot as_of). */
  readonly asOf?: string;
}
