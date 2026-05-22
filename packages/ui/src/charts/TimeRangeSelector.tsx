/**
 * TimeRangeSelector — full-width Segment row for EOD chart windows (default 1M).
 *
 * Unselected: transparent; selected: sliding `Segment.Indicator` pill only.
 */

import type { ReactNode } from "react";
import { Segment } from "heroui-native-pro/segment";

import { TYPO_CONTROL_LABEL } from "../tokens/typography";
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
    <Segment
      className="w-full gap-0"
      value={selected}
      size="sm"
      onValueChange={(next) => onChange(next as TimeRange)}
    >
      <Segment.Group className="w-full self-stretch flex-row bg-transparent p-0 gap-0 rounded-none shadow-none">
        <Segment.Indicator className="bg-surface-secondary shadow-none" />
        {TIME_RANGE_OPTIONS.map((range) => (
          <Segment.Item key={range} value={range} className="flex-1 min-w-0 px-0 py-1">
            <Segment.Label className={`${TYPO_CONTROL_LABEL} text-center`}>{range}</Segment.Label>
          </Segment.Item>
        ))}
      </Segment.Group>
    </Segment>
  );
}
