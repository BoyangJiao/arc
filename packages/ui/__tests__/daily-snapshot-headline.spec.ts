/**
 * Daily snapshot headline — all-new-positions fallback (P1).
 */

import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";

import type { DailySnapshotDelta } from "../src/finance/DailySnapshotCard";
import {
  shouldShowAllNewPositionsHeadline,
  visibleDailySnapshotMovers,
} from "../src/finance/daily-snapshot-headline";

const dec = (n: number): Decimal => new Decimal(n);

const mkDelta = (movers: DailySnapshotDelta["movers"], total = 0): DailySnapshotDelta => ({
  status: "ok",
  totalDeltaReporting: dec(total),
  totalDeltaPercent: dec(0),
  movers,
  baselineAsOf: "2026-05-16T23:00:00.000Z",
  currentReportingCurrency: "CNY",
});

describe("shouldShowAllNewPositionsHeadline", () => {
  it("shows fallback when all movers have zero overnight delta", () => {
    const delta = mkDelta([
      {
        assetId: "US:003015",
        deltaReporting: dec(0),
        deltaPercent: dec(0),
        currentValueReporting: dec(32034.4),
      },
    ]);
    expect(shouldShowAllNewPositionsHeadline(delta)).toBe(true);
    expect(visibleDailySnapshotMovers(delta)).toHaveLength(0);
  });

  it("shows change line when overnight movers exist", () => {
    const delta = mkDelta(
      [
        {
          assetId: "US:AAPL",
          deltaReporting: dec(100),
          deltaPercent: dec(1),
          currentValueReporting: dec(10100),
        },
      ],
      100
    );
    expect(shouldShowAllNewPositionsHeadline(delta)).toBe(false);
    expect(visibleDailySnapshotMovers(delta)).toHaveLength(1);
  });
});
