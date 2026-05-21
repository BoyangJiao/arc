/**
 * EOD chart window helpers — Block C time-range selector.
 */

import type { TimeRange } from "@arc/ui";

export interface TimeWindow {
  readonly from: Date;
  readonly to: Date;
}

export const rangeToWindow = (range: TimeRange, now: Date = new Date()): TimeWindow => {
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);

  const from = new Date(now);
  from.setHours(0, 0, 0, 0);

  switch (range) {
    case "1D":
      break;
    case "1W":
      from.setDate(from.getDate() - 7);
      break;
    case "1M":
      from.setDate(from.getDate() - 30);
      break;
    case "3M":
      from.setDate(from.getDate() - 90);
      break;
    case "YTD":
      return { from: new Date(now.getFullYear(), 0, 1), to };
    case "1Y":
      from.setDate(from.getDate() - 365);
      break;
    case "ALL":
      return { from: new Date("2020-01-01T00:00:00.000Z"), to };
    default: {
      const _exhaustive: never = range;
      return _exhaustive;
    }
  }

  return { from, to };
};
