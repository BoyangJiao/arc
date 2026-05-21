/**
 * TimeRangeSelector — segmented control for EOD chart windows (default 1M).
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import { Segment } from "heroui-native-pro/segment";

import { DEFAULT_TIME_RANGE, TIME_RANGE_OPTIONS, type TimeRange } from "./types";

export interface TimeRangeSelectorProps {
  readonly value?: TimeRange;
  readonly defaultValue?: TimeRange;
  readonly onChange: (range: TimeRange) => void;
}

export function TimeRangeSelector({
  value,
  defaultValue = DEFAULT_TIME_RANGE,
  onChange,
}: TimeRangeSelectorProps): ReactNode {
  const selected = value ?? defaultValue;

  return (
    <View className="w-full">
      <Segment value={selected} onValueChange={(next) => onChange(next as TimeRange)}>
        <Segment.ScrollView>
          {TIME_RANGE_OPTIONS.map((range) => (
            <Segment.Item key={range} value={range}>
              <Segment.Label>{range}</Segment.Label>
            </Segment.Item>
          ))}
        </Segment.ScrollView>
      </Segment>
    </View>
  );
}
