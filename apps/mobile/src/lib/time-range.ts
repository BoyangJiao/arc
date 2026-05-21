/**
 * EOD chart window helpers — Block C time-range selector.
 * Snapshots are stored at 23:00 UTC; windows use UTC to avoid dropping the latest point.
 */

import type { TimeRange } from "@arc/ui";

export interface TimeWindow {
  readonly from: Date;
  readonly to: Date;
}

const endOfUtcDay = (d: Date): Date => {
  const out = new Date(d);
  out.setUTCHours(23, 59, 59, 999);
  return out;
};

const startOfUtcDay = (d: Date): Date => {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  return out;
};

export const rangeToWindow = (range: TimeRange, now: Date = new Date()): TimeWindow => {
  const to = endOfUtcDay(now);
  const from = startOfUtcDay(now);

  switch (range) {
    case "1D":
      break;
    case "1W":
      from.setUTCDate(from.getUTCDate() - 7);
      break;
    case "1M":
      from.setUTCDate(from.getUTCDate() - 30);
      break;
    case "3M":
      from.setUTCDate(from.getUTCDate() - 90);
      break;
    case "YTD":
      return { from: startOfUtcDay(new Date(Date.UTC(now.getUTCFullYear(), 0, 1))), to };
    case "1Y":
      from.setUTCDate(from.getUTCDate() - 365);
      break;
    case "ALL":
      return { from: new Date(Date.UTC(2020, 0, 1)), to };
    default: {
      const _exhaustive: never = range;
      return _exhaustive;
    }
  }

  return { from, to };
};
