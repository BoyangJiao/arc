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

export const DEFAULT_TIME_RANGE: TimeRange = "1M";

export interface ChartPoint {
  readonly x: number;
  readonly y: number;
}
