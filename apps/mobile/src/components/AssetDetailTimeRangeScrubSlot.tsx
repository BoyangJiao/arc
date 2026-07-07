/**
 * Asset detail — time-range row above chart.
 *
 * Scrub swaps segment → date inside a fixed-height slot; chart offset is stable
 * because slot height + gap below are constant (see asset-detail-chart-layout).
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import {
  Text,
  TimeRangeSelector,
  TYPO_CAPTION,
  type ChartScrubState,
  type TimeRange,
} from "@arc/ui";

import { ASSET_DETAIL_TIME_RANGE_SLOT_HEIGHT } from "../lib/asset-detail-chart-layout";

export interface AssetDetailTimeRangeScrubSlotProps {
  readonly range: TimeRange;
  readonly onRangeChange: (range: TimeRange) => void;
  readonly scrub: ChartScrubState | null;
  readonly formatScrubDate: (isoTimestamp: string) => string;
}

export function AssetDetailTimeRangeScrubSlot({
  range,
  onRangeChange,
  scrub,
  formatScrubDate,
}: AssetDetailTimeRangeScrubSlotProps): ReactNode {
  const scrubDate =
    scrub?.asOf !== undefined && scrub.asOf !== "" ? formatScrubDate(scrub.asOf) : null;
  const showScrubDate = scrub !== null && scrubDate !== null;

  return (
    <View
      className="justify-center overflow-hidden"
      style={{ height: ASSET_DETAIL_TIME_RANGE_SLOT_HEIGHT }}
      accessibilityLiveRegion={showScrubDate ? "polite" : "none"}
    >
      {showScrubDate ? (
        <Text className={`${TYPO_CAPTION} text-center`} numberOfLines={1}>
          {scrubDate}
        </Text>
      ) : (
        <TimeRangeSelector value={range} onChange={onRangeChange} />
      )}
    </View>
  );
}
